import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // تنظیم پوشه ذخیره‌سازی اطلاعات
  const SAVE_DIR = path.join(process.cwd(), "save");
  const DB_FILE = path.join(SAVE_DIR, "db.json");
  const SHARED_FILES_DIR = path.join(SAVE_DIR, "shared-files");

  // پشتیبانی از بادی‌های بزرگ برای هماهنگ‌سازی کامل دیتابیس کلاینت
  app.use(express.json({ limit: "50mb" }));

  // اطمینان از وجود پوشه save و پوشه فایل‌های اشتراکی
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHARED_FILES_DIR)) {
    fs.mkdirSync(SHARED_FILES_DIR, { recursive: true });
  }

  // --- سیستم پشتیبان‌گیری خودکار ۱۰ روزه دوره‌ای (۳ ساعت یک‌بار) با نام پوشه تاریخ فارسی (جلالی) ---
  const BACKUPS_DIR = path.join(SAVE_DIR, "backups");
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  // تبدیل تاریخ میلادی به جلالی (شمسی) جهت نام‌گذاری دقیق پوشه‌ها
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

  // برچسب زمان‌های ۸ اسلات ۳ ساعته شبانه‌روز
  const SLOT_TIMES = [
    "", // اندیس صفر بلااستفاده
    "۰۰:۰۰ تا ۰۳:۰۰",
    "۰۳:۰۰ تا ۰۶:۰۰",
    "۰۶:۰۰ تا ۰۹:۰۰",
    "۰۹:۰۰ تا ۱۲:۰۰",
    "۱۲:۰۰ تا ۱۵:۰۰",
    "۱۵:۰۰ تا ۱۸:۰۰",
    "۱۸:۰۰ تا ۲۱:۰۰",
    "۲۱:۰۰ تا ۲۴:۰۰"
  ];

  // متد بررسی دیتابیس خالی جهت گارد حفاظتی
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

  // تابع اجرای خودکار بکاپ دوره‌ای بر اساس ساعت فعلی سرور
  function runBackupRoutine() {
    try {
      if (!fs.existsSync(DB_FILE)) return;
      
      const rawData = fs.readFileSync(DB_FILE, "utf-8");
      if (!rawData.trim()) return;

      // تایید سلامت ساختار JSON قبل از بکاپ
      let parsedData: any;
      try {
        parsedData = JSON.parse(rawData);
      } catch (e) {
        console.error("[بکاپ خودکار] فایل پایگاه داده اصلی خراب است. پشتیبان‌گیری انجام نشد.");
        return;
      }

      // در صورتی که دیتابیس ارسالی خالی است، بکاپ گرفته نمی‌شود تا بکاپ‌های سالم قبلی پاک نشوند
      if (isDatabaseEmpty(parsedData)) {
        return;
      }

      const dateStr = getJalaliDateString();
      const hour = new Date().getHours();
      const slot = Math.floor(hour / 3) + 1; // بازه ۱ تا ۸

      const slotDir = path.join(BACKUPS_DIR, dateStr, String(slot));
      const backupPath = path.join(slotDir, "db.json");

      let shouldWrite = false;
      if (!fs.existsSync(backupPath)) {
        shouldWrite = true;
      } else {
        const dbStats = fs.statSync(DB_FILE);
        const backupStats = fs.statSync(backupPath);
        // اگر تغییر جدیدی روی دیتابیس اعمال شده بود
        if (dbStats.mtimeMs > backupStats.mtimeMs || backupStats.size === 0) {
          shouldWrite = true;
        }
      }

      if (shouldWrite) {
        if (!fs.existsSync(slotDir)) {
          fs.mkdirSync(slotDir, { recursive: true });
        }
        fs.writeFileSync(backupPath, rawData, "utf-8");
        console.log(`[بکاپ خودکار] بکاپ دوره ${slot} (ساعت ${SLOT_TIMES[slot]}) برای تاریخ ${dateStr} ذخیره شد.`);
      }
    } catch (err) {
      console.error("[بکاپ خودکار] خطا در اجرای بکاپ دوره‌ای:", err);
    }
  }

  // تابع پاکسازی بکاپ‌های روزهای بسیار قدیمی (نگهداری فقط ۱۰ روز آخر)
  function cleanOldBackups() {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) return;
      const folders = fs.readdirSync(BACKUPS_DIR);
      const list: { name: string; score: number }[] = [];

      for (const folder of folders) {
        const stats = fs.statSync(path.join(BACKUPS_DIR, folder));
        if (!stats.isDirectory()) continue;

        const parts = folder.split("-").map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          const [y, m, d] = parts;
          const score = y * 10000 + m * 100 + d;
          list.push({ name: folder, score });
        }
      }

      // مرتب‌سازی از قدیمی به جدید
      list.sort((a, b) => a.score - b.score);

      // حذف موارد مازاد بر ۱۰ روز آخر
      if (list.length > 10) {
        const toDelete = list.slice(0, list.length - 10);
        for (const item of toDelete) {
          const itemPath = path.join(BACKUPS_DIR, item.name);
          fs.rmSync(itemPath, { recursive: true, force: true });
          console.log(`[بکاپ خودکار] پوشه بکاپ روز قدیمی حذف گردید: ${item.name}`);
        }
      }
    } catch (err) {
      console.error("[بکاپ خودکار] خطا در پاکسازی بکاپ‌های قدیمی:", err);
    }
  }

  // فرکانس چک کردن و اجرای بکاپ: هر ۵ دقیقه یک بار در پس‌زمینه
  runBackupRoutine();
  cleanOldBackups();
  setInterval(() => {
    runBackupRoutine();
    cleanOldBackups();
  }, 5 * 60 * 1000);

  // تنظیمات ذخیره‌سازی فایل‌ها با حفظ نام اصلی و جلوگیری از تداخل نام‌ها
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, SHARED_FILES_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      // پاکسازی نام فایل برای سیستم‌عامل‌ها و برطرف کردن کاراکترهای خراب
      const safeName = baseName.replace(/[^a-zA-Z0-9آ-یضصثقفغعهخحجچپگکنتامویژزدذرزطظءآأإؤئۀ\s-_]/g, "");
      cb(null, `${Date.now()}-${safeName}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 250 * 1024 * 1024 } // حداکثر ۲۵۰ مگابایت برای ویدیوها و فایل‌های بزرگ
  });

  // ۱. متد دریافت کل دیتابیس از فایل محلی روی لپ‌تاپ (GET)
  app.get("/api/db", (req, res) => {
    try {
      if (!fs.existsSync(DB_FILE)) {
        // اگر فایل هنوز ساخته نشده دیتابیس پیش‌فرض خالی ارسال می‌شود
        return res.json({ data: {}, lastUpdated: 0 });
      }
      
      const stats = fs.statSync(DB_FILE);
      const rawData = fs.readFileSync(DB_FILE, "utf-8");
      
      let data = {};
      try {
        if (rawData.trim()) {
          data = JSON.parse(rawData);
        }
      } catch (parseError) {
        console.error("خرابی در فایل db.json شناسایی شد. بک‌آپ تهیه شده و دیتابیس بازیابی می‌شود:", parseError);
        const corruptFile = path.join(SAVE_DIR, `db.corrupt.${Date.now()}.json`);
        fs.writeFileSync(corruptFile, rawData, "utf-8");
        // فایل خراب را حذف می‌کنیم تا کلاینت مجدداً بازنویسی کند
        fs.unlinkSync(DB_FILE);
        return res.json({ data: {}, lastUpdated: 0 });
      }
      
      res.json({
        data,
        lastUpdated: stats.mtimeMs
      });
    } catch (error) {
      console.error("Error reading db.json:", error);
      res.status(500).json({ error: "خطا در خواندن فایل پایگاه داده روی سرور لپ‌تاپ" });
    }
  });

  // ۲. متد ذخیره کردن و بروزرسانی دیتابیس در فایل لپ‌تاپ (POST)
  app.post("/api/db", (req, res) => {
    try {
      const { data } = req.body;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "فرمت اطلاعات فرستاده شده معتبر نیست" });
      }

      // گارد حفاظتی پیشرفته و هوشمند برای جلوگیری از رونویسی دیتابیس معتبر سرور با دیتابیس خالی کلاینت (Incognito / Cache Clear)
      const { reset, force } = req.query;
      const isResetRequest = reset === "true" || force === "true";

      if (!isResetRequest && fs.existsSync(DB_FILE)) {
        try {
          const currentRaw = fs.readFileSync(DB_FILE, "utf-8");
          if (currentRaw.trim()) {
            const currentDb = JSON.parse(currentRaw);
            // اگر دیتابیس سرور دارای اطلاعات است ولی کلاینت دیتای خالی فرستاده
            if (!isDatabaseEmpty(currentDb) && isDatabaseEmpty(data)) {
              console.warn("[گارد امنیتی دیتابیس] مسدودسازی رونویسی اطلاعات سرور با داده‌های خالی ارسالی کلاینت.");
              return res.status(409).json({
                error: "SERVER_HAS_DATA_PROTECTION",
                message: "دیتابیس سرور دارای اطلاعات معتبر است اما درخواست ارسالی حاوی داده‌های خالی است. جهت محافظت از رونویسی، درخواست لغو گردید."
              });
            }
          }
        } catch (e) {
          console.error("خطا در ارزیابی گارد حفاظتی دیتابیس:", e);
        }
      }

      // ذخیره‌سازی ایمن و اتمیک با فایل موقت و تغییر نام برای جلوگیری از خرابی داده در زمان قطعی برق یا کرش
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempFile, DB_FILE);
      
      const stats = fs.statSync(DB_FILE);
      res.json({
        success: true,
        lastUpdated: stats.mtimeMs
      });
    } catch (error) {
      console.error("Error writing db.json:", error);
      res.status(500).json({ error: "خطا در نوشتن و ذخیره‌سازی اطلاعات روی لپ‌تاپ" });
    }
  });

  // متد دریافت لیست بکاپ‌های خودکار ۱۰ روز اخیر (GET)
  app.get("/api/backups", (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ backups: [] });
      }

      const folders = fs.readdirSync(BACKUPS_DIR);
      const backupsList: any[] = [];

      for (const dateFolder of folders) {
        const datePath = path.join(BACKUPS_DIR, dateFolder);
        const stats = fs.statSync(datePath);
        if (!stats.isDirectory()) continue;

        // بررسی فرمت صحیح تاریخ شمسی پوشه
        const parts = dateFolder.split("-").map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) continue;

        const slotsList: any[] = [];
        // بازه‌های ۱ تا ۸ شبانه‌روز
        for (let s = 1; s <= 8; s++) {
          const slotFile = path.join(datePath, String(s), "db.json");
          if (fs.existsSync(slotFile)) {
            const fileStats = fs.statSync(slotFile);
            slotsList.push({
              slot: s,
              time: SLOT_TIMES[s],
              size: fileStats.size,
              mtime: fileStats.mtimeMs
            });
          }
        }

        if (slotsList.length > 0) {
          const [y, m, d] = parts;
          const score = y * 10000 + m * 100 + d;
          
          backupsList.push({
            date: dateFolder,
            score,
            slots: slotsList.sort((a, b) => b.slot - a.slot) // جدیدترین اسلات اول
          });
        }
      }

      // مرتب‌سازی روزها (جدیدترین‌ها در ابتدای لیست)
      backupsList.sort((a, b) => b.score - a.score);
      res.json({ backups: backupsList });
    } catch (error) {
      console.error("Error listing auto backups:", error);
      res.status(500).json({ error: "خطا در دریافت لیست بکاپ‌های خودکار" });
    }
  });

  // متد بازیابی یک فایل بکاپ انتخابی روی دیتابیس اصلی سرور (POST)
  app.post("/api/backups/restore", (req, res) => {
    try {
      const { date, slot } = req.body;
      if (!date || !slot) {
        return res.status(400).json({ error: "پارامترهای تاریخ و بازه معتبر ارسال نشده است" });
      }

      // اعتبارسنجی دقیق جهت جلوگیری از حملات پیمایش مسیر (Path Traversal)
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(date))) {
        return res.status(400).json({ error: "فرمت تاریخ نامعتبر است" });
      }

      const slotNum = Number(slot);
      if (isNaN(slotNum) || slotNum < 1 || slotNum > 8) {
        return res.status(400).json({ error: "بازه زمانی نامعتبر است" });
      }

      const backupFile = path.join(BACKUPS_DIR, String(date), String(slot), "db.json");
      if (!fs.existsSync(backupFile)) {
        return res.status(404).json({ error: "فایل پشتیبان انتخابی یافت نشد" });
      }

      const rawData = fs.readFileSync(backupFile, "utf-8");
      // تایید سینتکس برای اطمینان از عدم خرابی فایل بکاپ قبل از بازنویسی
      JSON.parse(rawData);

      // جایگزینی اتمیک و امن روی دیتابیس اصلی سرور لپ‌تاپ
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, rawData, "utf-8");
      fs.renameSync(tempFile, DB_FILE);

      console.log(`[بکاپ خودکار] پایگاه داده اصلی با موفقیت به بکاپ تاریخ ${date} - بازه ۳ ساعته ${slot} بازیابی شد.`);
      res.json({ success: true, message: "اطلاعات با موفقیت بازیابی شد" });
    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ error: "خطا در عملیات بازیابی بکاپ روی سرور" });
    }
  });

  // ۳. متد دریافت آی‌پی‌های شبکه محلی لپ‌تاپ برای اتصال موبایل (GET)
  app.get("/api/network-ips", (req, res) => {
    try {
      const networkInterfaces = os.networkInterfaces();
      const ips: string[] = [];
      
      for (const interfaceName of Object.keys(networkInterfaces)) {
        const interfaces = networkInterfaces[interfaceName];
        if (interfaces) {
          for (const iface of interfaces) {
            // فیلتر کردن آی‌پی‌های نسخه ۴ که داخلی (Loopback) نیستند
            if ((iface.family === "IPv4" || (iface.family as any) === 4) && !iface.internal) {
              ips.push(iface.address);
            }
          }
        }
      }
      
      res.json({ ips, port: PORT });
    } catch (error) {
      console.error("Error fetching network IPs:", error);
      res.status(500).json({ error: "خطا در دریافت آدرس‌های شبکه محلی" });
    }
  });

  // ۴. دریافت لیست فایل‌های به اشتراک گذاشته شده در شبکه محلی (GET)
  app.get("/api/shared-files", (req, res) => {
    try {
      if (!fs.existsSync(SHARED_FILES_DIR)) {
        return res.json({ files: [] });
      }
      const files = fs.readdirSync(SHARED_FILES_DIR);
      const fileList = files
        .filter(filename => filename !== "." && filename !== "..")
        .map((filename) => {
          const filePath = path.join(SHARED_FILES_DIR, filename);
          const stats = fs.statSync(filePath);
          
          // استخراج نام اصلی (حذف پیشوند تایم‌استمپ از نام فایل ذخیره شده)
          const parts = filename.split("-");
          let originalName = filename;
          if (parts.length > 1 && !isNaN(Number(parts[0]))) {
            originalName = parts.slice(1).join("-");
          }

          return {
            filename,
            originalName,
            size: stats.size,
            uploadedAt: stats.mtimeMs,
          };
        });

      // جدیدترین‌ها اول
      fileList.sort((a, b) => b.uploadedAt - a.uploadedAt);
      res.json({ files: fileList });
    } catch (error) {
      console.error("Error fetching shared files list:", error);
      res.status(500).json({ error: "خطا در دریافت لیست فایل‌های شبکه محلی" });
    }
  });

  // ۵. آپلود یک فایل جدید در شبکه محلی (POST)
  app.post("/api/shared-files/upload", upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "هیچ فایلی برای آپلود فرستاده نشده است" });
      }
      res.json({
        success: true,
        file: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
        }
      });
    } catch (error) {
      console.error("Error uploading file in API:", error);
      res.status(500).json({ error: "خطا در آپلود و ذخیره‌سازی فایل روی سرور" });
    }
  });

  // ۶. دانلود مستقیم یک فایل بارگذاری شده (GET)
  app.get("/api/shared-files/download/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const safeFilename = path.basename(filename);
      const filePath = path.join(SHARED_FILES_DIR, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("فایل مورد نظر روی لپ‌تاپ یافت نشد");
      }

      // بازسازی نام اصلی برای ذخیره شدن در دستگاه گیرنده با نام درست فارسی
      const parts = safeFilename.split("-");
      let originalName = safeFilename;
      if (parts.length > 1 && !isNaN(Number(parts[0]))) {
        originalName = parts.slice(1).join("-");
      }

      const encodedName = encodeURIComponent(originalName);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).send("خطا در بارگیری فایل");
    }
  });

  // ۷. حذف فیزیکی یک فایل از روی سرور لپ‌تاپ (DELETE)
  app.delete("/api/shared-files/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const safeFilename = path.basename(filename);
      const filePath = path.join(SHARED_FILES_DIR, safeFilename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: "فایل با موفقیت حذف شد" });
      } else {
        res.status(404).json({ error: "فایل مورد نظر یافت نشد" });
      }
    } catch (error) {
      console.error("Error deleting shared file:", error);
      res.status(500).json({ error: "خطا در حذف فایل از روی لپ‌تاپ" });
    }
  });

  // سرو صریح فایل‌های عمومی و PWA (آیکون‌ها، مانیفست و سرویس‌ورکر)
  app.use(express.static(path.join(process.cwd(), "public")));

  // ادغام هماهنگ با Vite برای سرو کلاینت در توسعه و محصول نهایی
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    // پیدا کردن آی‌پی‌های شبکه محلی برای نمایش لینک‌های کلیک‌شدنی
    const networkInterfaces = os.networkInterfaces();
    const networkLinks: string[] = [];

    for (const interfaceName of Object.keys(networkInterfaces)) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          // فیلتر کردن آی‌پی‌های نسخه ۴ که داخلی (Loopback) نیستند
          if ((iface.family === "IPv4" || (iface.family as any) === 4) && !iface.internal) {
            networkLinks.push(`http://${iface.address}:${PORT}`);
          }
        }
      }
    }

    console.log(`\n  🚀  سرور FocusFlow با موفقیت اجرا شد!\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    
    if (networkLinks.length > 0) {
      networkLinks.forEach((link) => {
        console.log(`  ➜  Network: ${link}/`);
      });
    } else {
      console.log(`  ➜  Network: [آی‌پی شبکه‌ای یافت نشد. مطمئن شوید به وای‌فای متصل هستید]`);
    }
    
    console.log(`  ➜  Database: ${DB_FILE}\n`);
    console.log(`  [نکته: با زدن آدرس‌های بالا در گوشی خود می‌توانید برنامه را مستقیماً هماهنگ کنید]`);
    console.log(`--------------------------------------------------`);
  });
}

startServer();
