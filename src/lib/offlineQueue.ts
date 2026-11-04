/**
 * سیستم صف‌بندی هوشمند عملیات آفلاین (Offline Mutation Queue)
 * ذخیره در IndexedDB به همراه ادغام تغییرات تکراری و تخلیه خودکار پس از برقراری اینترنت
 */
import { exportDatabase } from "./store";

export interface QueuedMutation {
  id: string;
  type: "DATA_UPDATE" | "TIMER_UPDATE" | "HABIT_ACTION" | "TASK_ACTION";
  timestamp: number;
  description: string;
  retries: number;
}

const DB_NAME = "focusflow_offline_queue_db";
const STORE_NAME = "mutation_queue";
const DB_VERSION = 1;
const QUEUE_EVENT = "focusflow-offline-queue-changed";

function openQueueDB(): Promise<IDBDatabase> {
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

class OfflineQueueManager {
  private inMemoryQueue: QueuedMutation[] = [];
  private isProcessing: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.init();

      // گوش دادن به وصل مجدد اینترنت برای تخلیه فوری صف
      window.addEventListener("online", () => {
        this.processQueue();
      });

      // گوش دادن به فوکوس تب
      window.addEventListener("focus", () => {
        if (navigator.onLine) {
          this.processQueue();
        }
      });
    }
  }

  private async init() {
    try {
      this.inMemoryQueue = await this.loadFromStorage();
      this.isInitialized = true;
      this.emitChange();
    } catch {
      this.isInitialized = true;
    }
  }

  private emitChange() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(QUEUE_EVENT, {
          detail: {
            count: this.inMemoryQueue.length,
            queue: this.inMemoryQueue,
          },
        })
      );
    }
  }

  private async loadFromStorage(): Promise<QueuedMutation[]> {
    try {
      const db = await openQueueDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list: QueuedMutation[] = req.result || [];
          list.sort((a, b) => a.timestamp - b.timestamp);
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // فال‌بک به localStorage در صورت عدم دسترسی به IndexedDB
      try {
        const raw = localStorage.getItem("focusflow_offline_queue_fallback");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  }

  private async saveToStorage() {
    try {
      const db = await openQueueDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const item of this.inMemoryQueue) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        localStorage.setItem(
          "focusflow_offline_queue_fallback",
          JSON.stringify(this.inMemoryQueue)
        );
      } catch {}
    }
  }

  /**
   * افزودن یک عملیات به صف با حذف عملیات تکراری (Coalescing / Deduping)
   */
  public async enqueue(
    type: QueuedMutation["type"],
    description: string
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    const now = Date.now();

    // فشرده‌سازی عملیات‌های مشابه: اگر یک به‌روزرسانی کلی دیتا از قبل در صف هست، زمان و جزییاتش تازه می‌شود
    const existingIndex = this.inMemoryQueue.findIndex((item) => item.type === type);
    if (existingIndex >= 0) {
      this.inMemoryQueue[existingIndex] = {
        ...this.inMemoryQueue[existingIndex],
        timestamp: now,
        description,
      };
    } else {
      this.inMemoryQueue.push({
        id: `mutation_${now}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        timestamp: now,
        description,
        retries: 0,
      });
    }

    await this.saveToStorage();
    this.emitChange();
  }

  /**
   * دریافت تعداد آیتم‌های معلق در صف
   */
  public getPendingCount(): number {
    return this.inMemoryQueue.length;
  }

  public getPendingList(): QueuedMutation[] {
    return [...this.inMemoryQueue];
  }

  /**
   * پردازش و تخلیه صف به محض برقراری اتصال با سرور
   */
  public async processQueue(): Promise<boolean> {
    if (this.isProcessing || this.inMemoryQueue.length === 0) {
      return true;
    }

    this.isProcessing = true;

    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);

      // ارسال مستقیم آخرین حالت ادغام‌شده به سرور کلادفلر
      const response = await fetch("/api/db?force=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsedData }),
      });

      if (response.ok) {
        const resBody = await response.json();
        if (resBody.success) {
          // پاک‌سازی کامل صف پس از تایید سرور
          this.inMemoryQueue = [];
          await this.saveToStorage();
          this.emitChange();
          return true;
        }
      }

      // در صورت عدم موفقیت، ریتری شمرده می‌شود
      for (const item of this.inMemoryQueue) {
        item.retries += 1;
      }
      await this.saveToStorage();
      this.emitChange();
    } catch {
      // سرور هنوز در دسترس نیست؛ بسته‌ها برای تلاش بعدی در صف می‌مانند
    } finally {
      this.isProcessing = false;
    }

    return false;
  }

  /**
   * پاک کردن صف در مواقع بازنشانی سیستم
   */
  public async clearQueue(): Promise<void> {
    this.inMemoryQueue = [];
    await this.saveToStorage();
    this.emitChange();
  }
}

export const offlineQueue = new OfflineQueueManager();
export const OFFLINE_QUEUE_EVENT = QUEUE_EVENT;
