/**
 * Cloudflare Worker for FocusFlow Task Manager
 * Provides 100% feature parity with the Node.js backend:
 * - Real-time database sync (/api/db) using Cloudflare KV
 * - 3-Hour automatic backups with 8 daily slots & Jalali date folders (/api/backups)
 * - 10-day backup history retention with automatic cleanup
 * - Backup restore with instant atomic snapshot swap (/api/backups/restore)
 * - File sharing & transfer up to 250MB using Cloudflare R2 (/api/shared-files)
 * - Cloudflare Cron Trigger (Scheduled event) for periodic backups
 * - In-memory fallback if bindings are not configured yet
 */

export interface Env {
  DB_KV?: any;
  FILES_BUCKET?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: any;
}

// In-memory fallback store when KV / R2 bindings are not yet provisioned
const memoryStore = new Map<string, any>();
const memoryFiles = new Map<string, { buffer: ArrayBuffer; type: string }>();

// 8 three-hour slot labels
const SLOT_TIMES = [
  "",
  "۰۰:۰۰ تا ۰۳:۰۰",
  "۰۳:۰۰ تا ۰۶:۰۰",
  "۰۶:۰۰ تا ۰۹:۰۰",
  "۰۹:۰۰ تا ۱۲:۰۰",
  "۱۲:۰۰ تا ۱۵:۰۰",
  "۱۵:۰۰ تا ۱۸:۰۰",
  "۱۸:۰۰ تا ۲۱:۰۰",
  "۲۱:۰۰ تا ۲۴:۰۰"
];

// Gregorian to Jalali (Solar Hijri) date conversion
function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  let jy: number;
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

function getJalaliDateString(): string {
  const now = new Date();
  const gy = now.getFullYear();
  const gm = now.getMonth() + 1;
  const gd = now.getDate();
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  return `${jy}-${jm}-${jd}`;
}

// Database empty check to protect against accidental overwrite
function isDatabaseEmpty(data: any): boolean {
  if (!data || typeof data !== "object") return true;
  const userKeys = [
    "focusflow_tasks",
    "focusflow_recurring_activities",
    "focusflow_habits",
    "focusflow_habit_groups",
    "focusflow_topics",
    "focusflow_quiz_subjects",
    "focusflow_quiz_entries",
    "focusflow_timeline_entries",
    "focusflow_notes",
    "focusflow_memories",
    "focusflow_going_up_evaluated_days",
    "focusflow_planner",
    "focusflow_planner_presets"
  ];
  for (const key of userKeys) {
    const val = data[key];
    if (Array.isArray(val) && val.length > 0) return false;
    if (val && typeof val === "object" && !Array.isArray(val) && Object.keys(val).length > 0) {
      if (key === "focusflow_planner" && val.slots && Object.keys(val.slots).length > 0) {
        return false;
      }
    }
  }
  return true;
}

// KV Helper functions
async function kvGet(env: Env, key: string): Promise<any | null> {
  if (env.DB_KV && typeof env.DB_KV.get === "function") {
    try {
      const val = await env.DB_KV.get(key, "json");
      return val;
    } catch {
      const text = await env.DB_KV.get(key);
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return text;
      }
    }
  }
  return memoryStore.get(key) ?? null;
}

async function kvPut(env: Env, key: string, value: any): Promise<void> {
  const stringified = typeof value === "string" ? value : JSON.stringify(value);
  if (env.DB_KV && typeof env.DB_KV.put === "function") {
    await env.DB_KV.put(key, stringified);
  } else {
    memoryStore.set(key, typeof value === "string" ? JSON.parse(value) : value);
  }
}

// 3-Hour Backup Routine on Cloudflare
async function performAutomaticBackup(env: Env, force: boolean = false): Promise<void> {
  try {
    const dbRecord = await kvGet(env, "current_db");
    if (!dbRecord || !dbRecord.data || isDatabaseEmpty(dbRecord.data)) {
      return;
    }

    const dateStr = getJalaliDateString();
    const hour = new Date().getHours();
    const slot = Math.floor(hour / 3) + 1; // 1 to 8

    const backupKey = `backup:${dateStr}:${slot}`;
    const existing = await kvGet(env, backupKey);

    // If backup already exists and not forced, only update if newer
    if (existing && !force && existing.lastUpdated >= dbRecord.lastUpdated) {
      return;
    }

    const backupPayload = {
      date: dateStr,
      slot,
      data: dbRecord.data,
      lastUpdated: dbRecord.lastUpdated || Date.now(),
      size: JSON.stringify(dbRecord.data).length
    };

    await kvPut(env, backupKey, backupPayload);

    // Update backups index
    let backupsIndex: Array<{ date: string; score: number; slots: any[] }> =
      (await kvGet(env, "backups_index")) || [];

    let dayRecord = backupsIndex.find((d) => d.date === dateStr);
    if (!dayRecord) {
      const [y, m, d] = dateStr.split("-").map(Number);
      dayRecord = {
        date: dateStr,
        score: y * 10000 + m * 100 + d,
        slots: []
      };
      backupsIndex.push(dayRecord);
    }

    // Update slot in day record
    dayRecord.slots = dayRecord.slots.filter((s: any) => s.slot !== slot);
    dayRecord.slots.push({
      slot,
      time: SLOT_TIMES[slot] || "",
      size: backupPayload.size,
      mtime: backupPayload.lastUpdated
    });
    dayRecord.slots.sort((a: any, b: any) => b.slot - a.slot);

    // Sort days from newest to oldest
    backupsIndex.sort((a, b) => b.score - a.score);

    // Retain only last 10 days of backups
    if (backupsIndex.length > 10) {
      const toRemove = backupsIndex.slice(10);
      for (const oldDay of toRemove) {
        for (let s = 1; s <= 8; s++) {
          if (env.DB_KV && typeof env.DB_KV.delete === "function") {
            await env.DB_KV.delete(`backup:${oldDay.date}:${s}`);
          } else {
            memoryStore.delete(`backup:${oldDay.date}:${s}`);
          }
        }
      }
      backupsIndex = backupsIndex.slice(0, 10);
    }

    await kvPut(env, "backups_index", backupsIndex);
  } catch (err) {
    console.error("Worker auto backup error:", err);
  }
}

// JSON Response helper with CORS
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export default {
  // 1. HTTP Request Handler
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    // --- PWA Route: /manifest.json ---
    if (pathname === "/manifest.json") {
      const manifestJson = {
        id: "/",
        name: "FocusFlow",
        short_name: "FocusFlow",
        description: "سامانه جامع مدیریت هوشمند برنامه‌ریزی روزانه، عادات، تسک‌ها و آزمون‌ها",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#121214",
        theme_color: "#f59e0b",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/pwa-192x192.png",
            type: "image/png",
            sizes: "192x192",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "maskable",
          },
          {
            src: "/icon.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "any",
          },
        ],
      };
      return new Response(JSON.stringify(manifestJson), {
        status: 200,
        headers: {
          "Content-Type": "application/manifest+json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // --- API ROUTE 1: GET /api/db ---
    if (pathname === "/api/db" && request.method === "GET") {
      try {
        const dbRecord = await kvGet(env, "current_db");
        if (!dbRecord || !dbRecord.data) {
          return jsonResponse({ data: {}, lastUpdated: 0 });
        }
        return jsonResponse({
          data: dbRecord.data,
          lastUpdated: dbRecord.lastUpdated || 0
        });
      } catch (err) {
        console.error("Worker GET /api/db error:", err);
        return jsonResponse({ error: "خطا در بازیابی اطلاعات دیتابیس از کلودفلر" }, 500);
      }
    }

    // --- API ROUTE 2: POST /api/db ---
    if (pathname === "/api/db" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { data } = body || {};

        if (!data || typeof data !== "object") {
          return jsonResponse({ error: "فرمت اطلاعات فرستاده شده معتبر نیست" }, 400);
        }

        const isReset = url.searchParams.get("reset") === "true" || url.searchParams.get("force") === "true";
        const currentDb = await kvGet(env, "current_db");

        // Server-side empty overwrite guard
        if (!isReset && currentDb && currentDb.data) {
          if (!isDatabaseEmpty(currentDb.data) && isDatabaseEmpty(data)) {
            return jsonResponse(
              {
                error: "SERVER_HAS_DATA_PROTECTION",
                message: "دیتابیس سرور دارای اطلاعات معتبر است اما درخواست ارسالی حاوی داده‌های خالی است."
              },
              409
            );
          }
        }

        const lastUpdated = Date.now();
        await kvPut(env, "current_db", { data, lastUpdated });

        // Trigger backup check in background
        performAutomaticBackup(env).catch(() => {});

        return jsonResponse({ success: true, lastUpdated });
      } catch (err) {
        console.error("Worker POST /api/db error:", err);
        return jsonResponse({ error: "خطا در نوشتن و ذخیره‌سازی اطلاعات روی کلودفلر" }, 500);
      }
    }

    // --- API ROUTE 3: GET /api/backups ---
    if (pathname === "/api/backups" && request.method === "GET") {
      try {
        const backups = (await kvGet(env, "backups_index")) || [];
        return jsonResponse({ backups });
      } catch (err) {
        console.error("Worker GET /api/backups error:", err);
        return jsonResponse({ error: "خطا در دریافت لیست بکاپ‌های خودکار" }, 500);
      }
    }

    // --- API ROUTE 4: POST /api/backups/restore ---
    if (pathname === "/api/backups/restore" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { date, slot } = body || {};

        if (!date || !slot) {
          return jsonResponse({ error: "پارامترهای تاریخ و بازه معتبر ارسال نشده است" }, 400);
        }

        const backupKey = `backup:${date}:${slot}`;
        const backupRecord = await kvGet(env, backupKey);

        if (!backupRecord || !backupRecord.data) {
          return jsonResponse({ error: "فایل پشتیبان انتخابی یافت نشد" }, 404);
        }

        const lastUpdated = Date.now();
        await kvPut(env, "current_db", {
          data: backupRecord.data,
          lastUpdated
        });

        return jsonResponse({ success: true, message: "اطلاعات با موفقیت بازیابی شد" });
      } catch (err) {
        console.error("Worker restore error:", err);
        return jsonResponse({ error: "خطا در عملیات بازیابی بکاپ روی سرور" }, 500);
      }
    }

    // --- API ROUTE 5: GET /api/network-ips ---
    if (pathname === "/api/network-ips" && request.method === "GET") {
      return jsonResponse({
        ips: ["شبکه ابری سراسری کلودفلر (Cloudflare Global Edge)"],
        port: 443
      });
    }

    // --- API ROUTE 6: GET /api/shared-files ---
    if (pathname === "/api/shared-files" && request.method === "GET") {
      try {
        const files = (await kvGet(env, "shared_files_index")) || [];
        return jsonResponse({ files });
      } catch (err) {
        console.error("Worker GET /api/shared-files error:", err);
        return jsonResponse({ error: "خطا در دریافت لیست فایل‌ها" }, 500);
      }
    }

    // --- API ROUTE 7: POST /api/shared-files/upload ---
    if (pathname === "/api/shared-files/upload" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          return jsonResponse({ error: "هیچ فایلی برای آپلود فرستاده نشده است" }, 400);
        }

        const originalName = file.name;
        const ext = originalName.includes(".") ? `.${originalName.split(".").pop()}` : "";
        const baseName = originalName.replace(ext, "");
        const safeName = baseName.replace(/[^a-zA-Z0-9آ-یضصثقفغعهخحجچپگکنتامویژزدذرزطظءآأإؤئۀ\s-_]/g, "");
        const filename = `${Date.now()}-${safeName}${ext}`;

        const arrayBuffer = await file.arrayBuffer();

        // Save to R2 bucket if available, else memory fallback
        if (env.FILES_BUCKET && typeof env.FILES_BUCKET.put === "function") {
          await env.FILES_BUCKET.put(filename, arrayBuffer, {
            httpMetadata: {
              contentType: file.type || "application/octet-stream"
            }
          });
        } else {
          memoryFiles.set(filename, {
            buffer: arrayBuffer,
            type: file.type || "application/octet-stream"
          });
        }

        // Update files index
        let filesList: any[] = (await kvGet(env, "shared_files_index")) || [];
        const fileMeta = {
          filename,
          originalName,
          size: file.size,
          uploadedAt: Date.now()
        };
        filesList.unshift(fileMeta);
        await kvPut(env, "shared_files_index", filesList);

        return jsonResponse({
          success: true,
          file: fileMeta
        });
      } catch (err) {
        console.error("Worker upload error:", err);
        return jsonResponse({ error: "خطا در ذخیره‌سازی فایل در کلودفلر" }, 500);
      }
    }

    // --- API ROUTE 8: GET /api/shared-files/download/:filename ---
    if (pathname.startsWith("/api/shared-files/download/") && request.method === "GET") {
      try {
        const filename = decodeURIComponent(pathname.replace("/api/shared-files/download/", ""));

        let arrayBuffer: ArrayBuffer | null = null;
        let contentType = "application/octet-stream";

        if (env.FILES_BUCKET && typeof env.FILES_BUCKET.get === "function") {
          const r2Obj = await env.FILES_BUCKET.get(filename);
          if (r2Obj) {
            arrayBuffer = await r2Obj.arrayBuffer();
            contentType = r2Obj.httpMetadata?.contentType || contentType;
          }
        } else {
          const memFile = memoryFiles.get(filename);
          if (memFile) {
            arrayBuffer = memFile.buffer;
            contentType = memFile.type;
          }
        }

        if (!arrayBuffer) {
          return new Response("فایل مورد نظر یافت نشد", { status: 404 });
        }

        // Extract original name
        const parts = filename.split("-");
        let originalName = filename;
        if (parts.length > 1 && !isNaN(Number(parts[0]))) {
          originalName = parts.slice(1).join("-");
        }

        const encodedName = encodeURIComponent(originalName);
        return new Response(arrayBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`
          }
        });
      } catch (err) {
        console.error("Worker download error:", err);
        return new Response("خطا در بارگیری فایل", { status: 500 });
      }
    }

    // --- API ROUTE 9: DELETE /api/shared-files/:filename ---
    if (pathname.startsWith("/api/shared-files/") && request.method === "DELETE") {
      try {
        const filename = decodeURIComponent(pathname.replace("/api/shared-files/", ""));

        if (env.FILES_BUCKET && typeof env.FILES_BUCKET.delete === "function") {
          await env.FILES_BUCKET.delete(filename);
        } else {
          memoryFiles.delete(filename);
        }

        let filesList: any[] = (await kvGet(env, "shared_files_index")) || [];
        filesList = filesList.filter((f) => f.filename !== filename);
        await kvPut(env, "shared_files_index", filesList);

        return jsonResponse({ success: true, message: "فایل با موفقیت حذف شد" });
      } catch (err) {
        console.error("Worker delete error:", err);
        return jsonResponse({ error: "خطا در حذف فایل" }, 500);
      }
    }

    // Static Assets Fallback (Cloudflare Workers Static Assets or Pages)
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const response = await env.ASSETS.fetch(request);
      if (pathname === "/sw.js") {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Content-Type", "application/javascript; charset=utf-8");
        newHeaders.set("Service-Worker-Allowed", "/");
        newHeaders.set("Cache-Control", "no-cache");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      if (pathname === "/manifest.json") {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Content-Type", "application/manifest+json; charset=utf-8");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return response;
    }

    return new Response("FocusFlow Worker API Ready", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  },

  // 2. Cloudflare Cron Trigger (Runs periodically to take 3-hour backups)
  async scheduled(_event: any, env: Env): Promise<void> {
    console.log("Cloudflare Cron Trigger: Running FocusFlow 3-hour backup check...");
    await performAutomaticBackup(env);
  }
};
