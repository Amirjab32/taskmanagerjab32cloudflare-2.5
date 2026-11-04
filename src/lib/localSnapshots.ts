import { exportDatabase, importDatabase } from "./store";
import { todayShamsiShort, toPersianDigits } from "./shamsi";

export interface LocalSnapshot {
  id: string;
  timestamp: number;
  dateShamsi: string;
  timeShamsi: string;
  summary: {
    tasksCount: number;
    habitsCount: number;
    plannerCount: number;
    notesCount: number;
  };
  data: any;
}

const DB_NAME = "focusflow_snapshots_db";
const STORE_NAME = "snapshots";
const DB_VERSION = 1;
const MAX_SNAPSHOTS = 20;
const MIN_INTERVAL_MS = 10 * 60 * 1000; // حداقل ۱۰ دقیقه فاصله بین بکاپ‌های خودکار عادی

let hasUnsavedChanges = false;
let autoSaveTimer: any = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const LocalSnapshotService = {
  notifyDataChanged() {
    hasUnsavedChanges = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      this.createSnapshot(false).catch(() => {});
    }, 15000);
  },
  async listSnapshots(): Promise<LocalSnapshot[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list: LocalSnapshot[] = req.result || [];
          // مرتب‌سازی از جدیدترین به قدیمی‌ترین
          list.sort((a, b) => b.timestamp - a.timestamp);
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  },

  async createSnapshot(force: boolean = false): Promise<LocalSnapshot | null> {
    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);

      const tasks = Array.isArray(parsedData.focusflow_tasks) ? parsedData.focusflow_tasks : [];
      const habits = Array.isArray(parsedData.focusflow_habits) ? parsedData.focusflow_habits : [];
      const notes = Array.isArray(parsedData.focusflow_notes) ? parsedData.focusflow_notes : [];
      const plannerEntries = Array.isArray(parsedData.focusflow_planner) ? parsedData.focusflow_planner : [];

      // اگر دیتابیس کلاً خالی است، بکاپ ذخیره نشود
      if (tasks.length === 0 && habits.length === 0 && plannerEntries.length === 0 && notes.length === 0) {
        return null;
      }

      const existingSnapshots = await this.listSnapshots();
      const now = Date.now();

      // بررسی فاصله زمانی برای جلوگیری از ذخیره مکرر
      if (!force && existingSnapshots.length > 0 && !hasUnsavedChanges) {
        const latest = existingSnapshots[0];
        if (now - latest.timestamp < MIN_INTERVAL_MS) {
          return null;
        }
      }

      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date(now);
      const timeShamsi = toPersianDigits(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
      const dateShamsi = todayShamsiShort();

      const snapshot: LocalSnapshot = {
        id: `snap_${now}`,
        timestamp: now,
        dateShamsi,
        timeShamsi,
        summary: {
          tasksCount: tasks.length,
          habitsCount: habits.length,
          plannerCount: plannerEntries.length,
          notesCount: notes.length
        },
        data: parsedData
      };

      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      hasUnsavedChanges = false;

      // حذف نسخه‌های قدیمی در صورت فراتر رفتن از سقف تعیین شده
      if (existingSnapshots.length >= MAX_SNAPSHOTS) {
        const toDelete = existingSnapshots.slice(MAX_SNAPSHOTS - 1);
        const delTx = db.transaction(STORE_NAME, "readwrite");
        const delStore = delTx.objectStore(STORE_NAME);
        for (const item of toDelete) {
          delStore.delete(item.id);
        }
      }

      return snapshot;
    } catch (err) {
      console.warn("Failed to create local snapshot:", err);
      return null;
    }
  },

  async restoreSnapshot(id: string): Promise<boolean> {
    try {
      const db = await openDB();
      const snapshot = await new Promise<LocalSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (!snapshot || !snapshot.data) {
        return false;
      }

      const success = importDatabase(JSON.stringify(snapshot.data));
      if (success && typeof window !== "undefined") {
        window.dispatchEvent(new Event("focusflow-data-changed"));
        window.dispatchEvent(new CustomEvent("focusflow-db-synced"));
      }
      return success;
    } catch {
      return false;
    }
  },

  async deleteSnapshot(id: string): Promise<void> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("Failed to delete local snapshot:", err);
    }
  },

  downloadSnapshotFile(snapshot: LocalSnapshot): void {
    try {
      const blob = new Blob([JSON.stringify(snapshot.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `focusflow-backup-${snapshot.dateShamsi.replace(/\//g, "-")}-${snapshot.timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download snapshot file:", err);
    }
  },

  downloadCurrentDatabase(): boolean {
    try {
      const dataStr = exportDatabase();
      const now = Date.now();
      const d = new Date(now);
      const pad = (n: number) => String(n).padStart(2, "0");
      const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
      const dateStr = todayShamsiShort().replace(/\//g, "-");
      const filename = `focusflow-backup-${dateStr}_${timeStr}.json`;

      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // ثبت خودکار اسنپ‌شات در حافظه پایدار دیسک
      this.createSnapshot(true).catch(() => {});
      return true;
    } catch (err) {
      console.error("Failed to download database:", err);
      return false;
    }
  }
};

// ثبت خودکار تغییرات در لحظه بستن تب، مینیمایز کردن یا خروج از برنامه
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      LocalSnapshotService.createSnapshot(false).catch(() => {});
    }
  });

  window.addEventListener("pagehide", () => {
    LocalSnapshotService.createSnapshot(false).catch(() => {});
  });
}
