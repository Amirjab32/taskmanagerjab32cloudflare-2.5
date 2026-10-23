/**
 * سیستم هماهنگ‌سازی خودکار دیتابیس با سرور ابری کلادفلر (Cloudflare Worker & KV)
 * تمام دستگاه‌ها (گوشی، لپ‌تاپ و تبلت) به صورت مستقل و مستقیم با کلادفلر تبادل اطلاعات دارند.
 */
import { exportDatabase, importDatabase } from "./store";

// تابع کمکی جهت بررسی خالی بودن دیتابیس ارسالی کلاینت یا سرور
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

// تعریف انواع وضعیت هماهنگی
export type SyncStatus = "connected" | "syncing" | "offline" | "idle";

// رویداد هماهنگی سراسری کلاینت برای مطلع ساختن کامپوننت‌های فرانت‌اند
export const SYNC_EVENT = "focusflow-db-synced";
export const SYNC_STATUS_EVENT = "focusflow-sync-status-changed";

class SyncManager {
  private lastSyncedMtime: number = 0;
  private isPushing: boolean = false;
  private pendingPushTimeout: NodeJS.Timeout | null = null;
  private pollIntervalId: NodeJS.Timeout | null = null;
  private currentStatus: SyncStatus = "idle";
  private hasUnsavedLocalChanges: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      // لود کردن آخرین مهر زمانی هماهنگ شده از localStorage
      const cachedTime = localStorage.getItem("focusflow_last_synced_mtime");
      if (cachedTime) {
        this.lastSyncedMtime = parseFloat(cachedTime);
      }

      // شنود تغییرات دیتابیس محلی برای ارسال به سرور (Push)
      window.addEventListener("focusflow-data-changed", () => {
        this.hasUnsavedLocalChanges = true;
        this.setStatus("syncing");
        this.schedulePush();
      });

      // ارسال فوری تغییرات تایمر زنده (استارت/استپ) بدون تاخیر دی‌بونس
      window.addEventListener("focusflow-planner-timer-change", () => {
        this.triggerImmediatePush();
      });

      // پایش فوری وضعیت سرور هنگام باز کردن قفل گوشی یا بازگشت به تب مرورگر
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.pullFromServer(true);
        }
      });
      window.addEventListener("focus", () => {
        this.pullFromServer(true);
      });

      // شروع همگام‌سازی دوره‌ای و خودکار در پس‌زمینه
      this.startPolling();
    }
  }

  // تغییر وضعیت اتصال و اطلاع‌رسانی به کامپوننت‌ها
  private setStatus(status: SyncStatus) {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: status }));
    }
  }

  public getStatus(): SyncStatus {
    return this.currentStatus;
  }

  // ارسال فوری اطلاعات به سرور بدون تاخیر
  public triggerImmediatePush() {
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
      this.pendingPushTimeout = null;
    }
    this.hasUnsavedLocalChanges = true;
    this.pushLocalToServer();
  }

  // فرستادن اطلاعات محلی به سرور با تکنیک Debounce برای بهینه‌سازی ترافیک شبکه
  private schedulePush() {
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
    }

    this.pendingPushTimeout = setTimeout(async () => {
      await this.pushLocalToServer();
    }, 500); // ارسال با نیم ثانیه تاخیر جهت ادغام تغییرات پشت سر هم
  }

  // متد اصلی ارسال اطلاعات کلاینت به فایل لپ‌تاپ
  private async pushLocalToServer() {
    if (this.isPushing) return;

    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);

      // محافظت کلاینت: اگر دیتای محلی کلاینت خالی است و کلاینت هرگز با سرور همگام‌سازی نکرده (Incognito یا پاک شدن کش)
      // نباید اجازه دهیم کلاینت اطلاعات خالی را روی سرور بفرستد و آن را رونویسی کند.
      const isLocalEmpty = isDatabaseEmpty(parsedData);

      if (isLocalEmpty && this.lastSyncedMtime === 0) {
        console.warn("Sync: Local database is empty and never synced before. Skipping push to protect server database.");
        await this.pullFromServer();
        return;
      }

      this.isPushing = true;
      this.setStatus("syncing");

      const response = await fetch("/api/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: parsedData }),
      });

      if (response.ok) {
        const resBody = await response.json();
        if (resBody.success && resBody.lastUpdated) {
          this.lastSyncedMtime = resBody.lastUpdated;
          localStorage.setItem("focusflow_last_synced_mtime", this.lastSyncedMtime.toString());
          this.hasUnsavedLocalChanges = false;
          this.setStatus("connected");
        }
      } else if (response.status === 409) {
        const errBody = await response.json().catch(() => ({}));
        if (errBody.error === "SERVER_HAS_DATA_PROTECTION") {
          console.warn("Sync: Server blocked empty push because it holds valid database. Pulling server data to restore client...");
          this.lastSyncedMtime = 0; // ریست کردن برای لود اجباری
          this.hasUnsavedLocalChanges = false; // بازنشانی وضعیت تغییرات محلی جهت پذیرش دیتای معتبر سرور
          await this.pullFromServer(true);
        }
      } else {
        this.setStatus("offline");
      }
    } catch (err) {
      console.warn("Sync: Network is offline, saving locally first...", err);
      this.setStatus("offline");
    } finally {
      this.isPushing = false;
    }
  }

  // هماهنگ‌سازی دستی فوری (بکاپ سریع)
  public async forceSync() {
    this.setStatus("syncing");
    await this.pullFromServer();
    await this.pushLocalToServer();
  }

  // پاک کردن دیتابیس محلی و ارسال دیتابیس خالی به سرور جهت ریست همه دستگاه‌ها به صورت هماهنگ
  public async clearDatabaseAndSync() {
    this.setStatus("syncing");
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    // ۱. پاک کردن کامل دیتای محلی برنامه در مرورگر
    localStorage.clear();

    // ۲. صفر کردن مهر زمانی هماهنگ شده کلاینت
    this.lastSyncedMtime = 0;
    this.hasUnsavedLocalChanges = false;

    // ۳. ارسال سریع یک درخواست ریست به بک‌اند لپ‌تاپ تا فایل db.json هم خالی شود
    try {
      const response = await fetch("/api/db?reset=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: {} }), // دیتابیس کاملاً خالی
      });

      if (response.ok) {
        const resBody = await response.json();
        this.lastSyncedMtime = resBody.lastUpdated || Date.now();
        localStorage.setItem("focusflow_last_synced_mtime", this.lastSyncedMtime.toString());
      }
    } catch (err) {
      console.error("Failed to clear database on the laptop server:", err);
    }

    // ۴. بارگذاری مجدد صفحه برای شروع تمیز و تازه برنامه
    window.location.reload();
  }

  // متد دریافت اطلاعات از فایل دیتابیس لپ‌تاپ (Pull)
  private async pullFromServer(force: boolean = false): Promise<boolean> {
    if (!force && (this.isPushing || this.hasUnsavedLocalChanges)) return false;

    try {
      const response = await fetch("/api/db");
      if (!response.ok) {
        this.setStatus("offline");
        return false;
      }

      const resBody = await response.json();
      const serverMtime = resBody.lastUpdated || 0;

      // اگر فایل سرور جدیدتر از کلاینت باشد یا کلاینت هنوز خالی باشد
      if (serverMtime > this.lastSyncedMtime || this.lastSyncedMtime === 0) {
        const isServerEmpty = isDatabaseEmpty(resBody.data);

        if (!isServerEmpty) {
          const success = importDatabase(JSON.stringify(resBody.data));
          if (success) {
            this.lastSyncedMtime = serverMtime;
            localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
            
            // شلیک رویداد هماهنگی پایگاه داده جهت ریلود آنی کدهای فرانت‌اند
            window.dispatchEvent(new CustomEvent(SYNC_EVENT));
          }
        } else {
          // دیتابیس سرور خالی (ریست شده) است.
          // اگر کلاینت قبلاً همگام شده بود (lastSyncedMtime > 0)، باید این ریست شدن سرور را در خود اعمال کند
          if (this.lastSyncedMtime > 0) {
            console.warn("Sync: Server database was cleared/reset. Applying reset to client...");
            localStorage.clear();
            this.lastSyncedMtime = serverMtime;
            localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
            window.location.reload();
            return true;
          }
        }
        this.setStatus("connected");
        return true;
      }
      
      this.setStatus("connected");
      return false;
    } catch (err) {
      this.setStatus("offline");
      return false;
    }
  }

  // شروع پایش مستمر هر ۲.۵ ثانیه برای هماهنگی ریل‌تایم بین گوشی و لپ‌تاپ
  private startPolling() {
    // ابتدا یک بار لود اولیه انجام شود
    this.pullFromServer();

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    this.pollIntervalId = setInterval(async () => {
      if (this.isPushing) return;

      if (this.hasUnsavedLocalChanges) {
        // تلاش مجدد جهت ارسال تغییرات محلی ذخیره نشده به سرور لپ‌تاپ
        await this.pushLocalToServer();
      } else {
        // دریافت آخرین تغییرات جدید از سرور
        await this.pullFromServer();
      }
    }, 2500);
  }

  // توقف همگام‌سازی در صورت لزوم
  public destroy() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
    }
  }
}

// ایجاد و اکسپورت تک‌نمونه (Singleton) از مدیر هماهنگی
export const syncManager = new SyncManager();
