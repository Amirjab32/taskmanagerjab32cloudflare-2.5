/**
 * سیستم هماهنگ‌سازی خودکار دیتابیس با سرور ابری کلادفلر (Cloudflare Worker & KV)
 * تمام دستگاه‌ها (گوشی، لپ‌تاپ و تبلت) به صورت مستقل و مستقیم با کلادفلر تبادل اطلاعات دارند.
 */
import { exportDatabase, importDatabase } from "./store";
import { LocalSnapshotService } from "./localSnapshots";
import { offlineQueue } from "./offlineQueue";

/// کلید وضعیت تغییرات ارسال‌نشده محلی در حافظه پایدار مرورگر
const HAS_UNPUSHED_CHANGES_KEY = "focusflow_has_unpushed_changes";

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

// محاسبه مجموع آیتم‌های ذخیره شده در تمام بخش‌های دیتابیس کاربر
export function calculateDatabaseItemCount(data: any): number {
  if (!data || typeof data !== "object") return 0;
  let count = 0;
  const arrayKeys = [
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
    "focusflow_planner_presets"
  ];
  for (const key of arrayKeys) {
    const val = data[key];
    if (Array.isArray(val)) {
      count += val.length;
    }
  }
  if (data.focusflow_planner && typeof data.focusflow_planner === "object") {
    if (data.focusflow_planner.slots && typeof data.focusflow_planner.slots === "object") {
      count += Object.keys(data.focusflow_planner.slots).length;
    }
  }
  return count;
}

// بررسی استثنای کاهش شدید یا صفر بودن اطلاعات دستگاه کلاینت
// فقط در این شرایط استثنایی اطلاعات سرور جایگزین دستگاه می‌شود (مثلاً کلیر کش یا حذف تصادفی کل داده‌ها)
export function isLocalDrasticallyDepleted(localCount: number, serverCount: number, isLocalEmpty: boolean): boolean {
  if (serverCount === 0) return false;
  // ۱. دیتای دیوایس کاملاً خالی یا صفر باشد (مانند کلیر کش، پنجره ناشناس یا دستگاه کاملاً جدید)
  if (isLocalEmpty || localCount === 0) return true;
  // ۲. سرور اطلاعات کافی دارد (حداقل ۵ آیتم) ولی دیوایس به ۲ آیتم یا کمتر سقوط کرده
  if (serverCount >= 5 && localCount <= 2) return true;
  // ۳. سرور بیش از ۱۰ آیتم دارد و بیش از ۷۰ درصد آیتم‌های دیوایس ناپدید شده‌اند
  if (serverCount >= 10 && localCount < serverCount * 0.3) return true;
  return false;
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

      // لود وضعیت ماندگار تغییرات ارسال نشده از قبل (حتی پس از رفرش صفحه یا بستن مرورگر)
      const cachedHasUnsaved = localStorage.getItem(HAS_UNPUSHED_CHANGES_KEY);
      if (cachedHasUnsaved === "true") {
        this.hasUnsavedLocalChanges = true;
      }

      // شنود تغییرات دیتابیس محلی برای ارسال به سرور (Push) و ثبت اسنپ‌شات محلی پایدار
      window.addEventListener("focusflow-data-changed", () => {
        this.hasUnsavedLocalChanges = true;
        localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
        offlineQueue.enqueue("DATA_UPDATE", "تغییرات دیتابیس محلی").catch(() => {});
        this.setStatus("syncing");
        this.schedulePush();
        LocalSnapshotService.notifyDataChanged();
      });

      // ارسال فوری تغییرات تایمر زنده (استارت/استپ) بدون تاخیر دی‌بونس
      window.addEventListener("focusflow-planner-timer-change", () => {
        this.hasUnsavedLocalChanges = true;
        localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
        offlineQueue.enqueue("TIMER_UPDATE", "تغییر وضعیت تایمر پلنر").catch(() => {});
        this.triggerImmediatePush();
        LocalSnapshotService.notifyDataChanged();
      });

      // هماهنگ‌سازی هنگام فعال شدن تب یا اتصال مجدد اینترنت / وی‌پی‌ان
      // با اولویت دیتای دیوایس (Device Precedence)
      const handleReconnection = () => {
        offlineQueue.processQueue().catch(() => {});
        this.reconcileWithServer();
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          handleReconnection();
        }
      });
      window.addEventListener("focus", handleReconnection);
      window.addEventListener("online", handleReconnection);

      // شروع همگام‌سازی دوره‌ای و خودکار در پس‌زمینه
      this.startPolling();

      // سیستم بکاپ محلی خودکار پایدار (همیشه روشن و مستقل از اینترنت)
      setTimeout(() => {
        LocalSnapshotService.createSnapshot().catch(() => {});
      }, 5000);

      setInterval(() => {
        LocalSnapshotService.createSnapshot().catch(() => {});
      }, 15 * 60 * 1000);
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
    localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
    this.pushLocalToServer(true);
  }

  // فرستادن اطلاعات محلی به سرور با تکنیک Debounce برای بهینه‌سازی ترافیک شبکه
  private schedulePush() {
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
    }

    this.pendingPushTimeout = setTimeout(async () => {
      await this.pushLocalToServer(false);
    }, 500); // ارسال با نیم ثانیه تاخیر جهت ادغام تغییرات پشت سر هم
  }

  // متد اصلی ارسال اطلاعات کلاینت به سرور کلادفلر یا لپ‌تاپ
  public async pushLocalToServer(force: boolean = false): Promise<boolean> {
    if (this.isPushing) return false;

    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);
      const isLocalEmpty = isDatabaseEmpty(parsedData);

      // محافظت کلاینت: اگر دیتای محلی کلاینت خالی است و کلاینت هرگز با سرور همگام‌سازی نکرده
      // نباید اجازه دهیم کلاینت اطلاعات خالی را روی سرور بفرستد و آن را رونویسی کند.
      if (isLocalEmpty && this.lastSyncedMtime === 0 && !force) {
        console.warn("Sync: Local database is empty and never synced before. Skipping push to protect server database.");
        await this.pullFromServer();
        return false;
      }

      this.isPushing = true;
      this.setStatus("syncing");

      const endpoint = force ? "/api/db?force=true" : "/api/db";
      const response = await fetch(endpoint, {
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
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          offlineQueue.clearQueue().catch(() => {});
          this.setStatus("connected");
          return true;
        }
      } else if (response.status === 409) {
        const errBody = await response.json().catch(() => ({}));
        if (errBody.error === "SERVER_HAS_DATA_PROTECTION") {
          console.warn("Sync: Server blocked empty push because it holds valid database. Pulling server data to restore client...");
          this.lastSyncedMtime = 0; // ریست کردن برای لود اجباری
          this.hasUnsavedLocalChanges = false; // بازنشانی وضعیت تغییرات محلی جهت پذیرش دیتای معتبر سرور
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          await this.pullFromServer(true);
        }
      } else {
        this.setStatus("offline");
      }
    } catch (err) {
      console.warn("Sync: Network is offline, keeping changes saved locally on device...", err);
      this.setStatus("offline");
    } finally {
      this.isPushing = false;
    }
    return false;
  }

  // هماهنگ‌سازی دستی فوری (بکاپ سریع) با اولویت اطلاعات دیوایس
  public async forceSync() {
    this.setStatus("syncing");
    await this.reconcileWithServer();
  }

  // اعمال اجباری فایل اطلاعات به حافظه محلی و سرور (زور گفتن به سیستم ذخیره‌سازی محلی)
  public async applyManualDatabaseOverride(jsonString: string): Promise<boolean> {
    this.setStatus("syncing");

    // ۱. بازنویسی کامل حافظه لوکال و پاک‌سازی هر داده قدیمی محلی که در فایل نیست
    const success = importDatabase(jsonString, true);
    if (!success) {
      this.setStatus(this.currentStatus);
      return false;
    }

    // ۲. شلیک رویدادهای تغییر فرانت‌اند برای بازخوانی قطعی کامپوننت‌ها
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("focusflow-data-changed"));
      window.dispatchEvent(new CustomEvent("focusflow-db-synced"));
    }

    // ۳. ثبت فوری یک نسخه پایدار در IndexedDB با بالاترین اولویت
    try {
      await LocalSnapshotService.createSnapshot(true);
    } catch (e) {
      console.warn("Failed to create snapshot during manual override:", e);
    }

    // ۴. ارسال زوری به سرور (با پارامتر force=true) و دریافت آخرین مهر زمانی تا کلاینت رونویسی نشود
    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);

      const response = await fetch("/api/db?force=true", {
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
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          this.setStatus("connected");
        }
      }
    } catch (err) {
      console.warn("Sync: Server unreachable during manual override, local storage forcefully updated.", err);
      this.hasUnsavedLocalChanges = true;
      localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
    }

    return true;
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
    localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
    offlineQueue.clearQueue().catch(() => {});

    // ۳. ارسال سریع یک درخواست ریست به سرور تا فایل دیتابیس هم خالی شود
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
      console.error("Failed to clear database on the server:", err);
    }

    // ۴. بارگذاری مجدد صفحه برای شروع تمیز و تازه برنامه
    window.location.reload();
  }

  // متد دریافت اطلاعات از فایل دیتابیس سرور (Pull)
  // با رعایت ارجحیت دیتای دیوایس: هرگز در صورت وجود تغییرات محلی رونویسی انجام نمی‌دهد
  public async pullFromServer(force: boolean = false): Promise<boolean> {
    if (this.isPushing) return false;
    // اگر تغییرات ذخیره نشده محلی داریم، دیوایس ارجحیت دارد و نباید پول شود
    if (!force && this.hasUnsavedLocalChanges) {
      await this.pushLocalToServer(true);
      return false;
    }

    try {
      const response = await fetch("/api/db");
      if (!response.ok) {
        this.setStatus("offline");
        return false;
      }

      const resBody = await response.json();
      const serverMtime = resBody.lastUpdated || 0;
      const serverData = resBody.data;

      const localDataStr = exportDatabase();
      const localData = JSON.parse(localDataStr);
      const localCount = calculateDatabaseItemCount(localData);
      const serverCount = calculateDatabaseItemCount(serverData);
      const isLocalEmpty = isDatabaseEmpty(localData);
      const isServerEmpty = isDatabaseEmpty(serverData);

      // استثنای کاهش شدید یا خالی بودن دیتای دستگاه
      const shouldRestoreToDevice = isLocalDrasticallyDepleted(localCount, serverCount, isLocalEmpty);

      if (shouldRestoreToDevice && !isServerEmpty) {
        console.warn(`Sync: Restoring depleted local data (${localCount} items) from server (${serverCount} items)...`);
        const success = importDatabase(JSON.stringify(serverData));
        if (success) {
          this.lastSyncedMtime = serverMtime;
          localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
          this.hasUnsavedLocalChanges = false;
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          window.dispatchEvent(new CustomEvent(SYNC_EVENT));
          this.setStatus("connected");
          return true;
        }
      }

      // اگر دستگاه دارای تغییرات محلی است و تقلیل نیافته، دیتای دستگاه به سرور تحمیل می‌شود
      if (this.hasUnsavedLocalChanges) {
        console.log("Sync: Device has unpushed changes. Imposing device data on database...");
        await this.pushLocalToServer(true);
        return true;
      }

      // اگر سرور آپدیت جدیدتری دارد و این دستگاه کاملاً بدون تغییر محلی بوده است
      if (serverMtime > this.lastSyncedMtime && this.lastSyncedMtime > 0 && !isServerEmpty) {
        if (JSON.stringify(localData) !== JSON.stringify(serverData)) {
          console.log("Sync: Server has newer updates from another session. Updating device...");
          const success = importDatabase(JSON.stringify(serverData));
          if (success) {
            this.lastSyncedMtime = serverMtime;
            localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
            window.dispatchEvent(new CustomEvent(SYNC_EVENT));
            this.setStatus("connected");
            return true;
          }
        }
      }

      this.setStatus("connected");
      return false;
    } catch (err) {
      this.setStatus("offline");
      return false;
    }
  }

  /**
   * هماهنگ‌سازی دوطرفه با اولویت اطلاعات دیوایس (Device Precedence):
   * ۱. اطلاعات دیوایس همیشه به دیتابیس ارجحیت دارد و تغییرات به سرور تحمیل می‌شود.
   * ۲. تنها استثنا: اگر اطلاعات دیوایس صفر باشد یا بسیار کم شده باشد (کلیر کش مرورگر یا حذف تصادفی)،
   *    اطلاعات دیتابیس به دیوایس تحمیل می‌شود تا دیتای کاربر بازگردانده شود.
   */
  public async reconcileWithServer(): Promise<boolean> {
    if (this.isPushing) return false;

    try {
      const response = await fetch("/api/db");
      if (!response.ok) {
        this.setStatus("offline");
        return false;
      }

      const resBody = await response.json();
      const serverData = resBody.data;
      const serverMtime = resBody.lastUpdated || 0;

      const localDataStr = exportDatabase();
      const localData = JSON.parse(localDataStr);

      const localCount = calculateDatabaseItemCount(localData);
      const serverCount = calculateDatabaseItemCount(serverData);
      const isLocalEmpty = isDatabaseEmpty(localData);
      const isServerEmpty = isDatabaseEmpty(serverData);

      // استثنای حیاتی: دیتای دیوایس صفر یا به شدت اندک است در حالی که سرور اطلاعات معتبر دارد
      if (isLocalDrasticallyDepleted(localCount, serverCount, isLocalEmpty) && !isServerEmpty) {
        console.warn(`Sync: Local data is depleted (${localCount} vs server ${serverCount}). Restoring device from database...`);
        const success = importDatabase(JSON.stringify(serverData));
        if (success) {
          this.lastSyncedMtime = serverMtime;
          localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
          this.hasUnsavedLocalChanges = false;
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          window.dispatchEvent(new CustomEvent(SYNC_EVENT));
          this.setStatus("connected");
          return true;
        }
      }

      // بررسی یکسانی محتوای دیوایس و سرور
      const localStr = JSON.stringify(localData);
      const serverStr = JSON.stringify(serverData);

      if (localStr === serverStr) {
        this.lastSyncedMtime = Math.max(serverMtime, this.lastSyncedMtime);
        localStorage.setItem("focusflow_last_synced_mtime", this.lastSyncedMtime.toString());
        this.hasUnsavedLocalChanges = false;
        localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
        this.setStatus("connected");
        return true;
      }

      // اطلاعات با هم یکی نیستند:
      // اصل قانون کاربر: «باید اطلاعات دیوایس من به دیتابیس ارجهیت داشته باشه و وقتی وصل شدم و اطلاعات با هم یکی نبودن،
      // اطلاعات دیوایس من به دیتابیس تحمیل بشه و اطلاعات دیتابیس اپدیت بشه»
      if (this.hasUnsavedLocalChanges || localCount >= serverCount || this.lastSyncedMtime === 0) {
        console.log(`Sync: Imposing device data on database (Local items: ${localCount}, Server items: ${serverCount})...`);
        return await this.pushLocalToServer(true);
      } else if (serverMtime > this.lastSyncedMtime && this.lastSyncedMtime > 0 && !this.hasUnsavedLocalChanges) {
        // این دستگاه در حالت بیکار بوده و هیج تغییری نداده، در حالی که دستگاه دیگر قبلاً در سرور ثبت کرده
        console.log("Sync: Receiving fresh updates from server into clean device...");
        const success = importDatabase(serverStr);
        if (success) {
          this.lastSyncedMtime = serverMtime;
          localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
          window.dispatchEvent(new CustomEvent(SYNC_EVENT));
          this.setStatus("connected");
          return true;
        }
      } else {
        // در هر حالت دیگر، ارجحیت قطعی با اطلاعات دیوایس فعلی کاربر است
        return await this.pushLocalToServer(true);
      }

      return false;
    } catch (err) {
      this.setStatus("offline");
      return false;
    }
  }

  // شروع پایش مستمر هر ۲.۵ ثانیه برای هماهنگی ریل‌تایم بین دیوایس و دیتابیس
  private startPolling() {
    // ابتدا یک بار بررسی و هماهنگ‌سازی اولیه انجام شود
    this.reconcileWithServer();

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    this.pollIntervalId = setInterval(async () => {
      if (this.isPushing) return;

      if (this.hasUnsavedLocalChanges) {
        // تلاش مجدد جهت ارسال و تحمیل تغییرات محلی دیوایس به دیتابیس سرور
        await this.pushLocalToServer(true);
      } else {
        // هماهنگ‌سازی دوره‌ای
        await this.reconcileWithServer();
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
