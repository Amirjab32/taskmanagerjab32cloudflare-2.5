/**
 * سیستم ذخیره‌سازی محلی فایل‌های صوتی زنگ در IndexedDB
 * جلوگیری از پر شدن حافظه ۵ مگابایتی localStorage مرورگر و پشتیبانی کامل آفلاین
 */

const AUDIO_DB_NAME = "focusflow_audio_db";
const AUDIO_STORE_NAME = "custom_sounds";
const AUDIO_DB_VERSION = 1;

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const AudioStorageService = {
  /**
   * ذخیره فایل صوتی در IndexedDB
   */
  async saveAudio(id: string, dataUrl: string): Promise<boolean> {
    try {
      const db = await openAudioDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AUDIO_STORE_NAME, "readwrite");
        const store = tx.objectStore(AUDIO_STORE_NAME);
        store.put({ id, dataUrl, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  /**
   * دریافت فایل صوتی ذخیره‌شده بر اساس شناسه
   */
  async getAudio(id: string): Promise<string | null> {
    try {
      const db = await openAudioDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AUDIO_STORE_NAME, "readonly");
        const store = tx.objectStore(AUDIO_STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result && req.result.dataUrl) {
            resolve(req.result.dataUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  /**
   * حذف فایل صوتی اختصاصی
   */
  async deleteAudio(id: string): Promise<boolean> {
    try {
      const db = await openAudioDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AUDIO_STORE_NAME, "readwrite");
        const store = tx.objectStore(AUDIO_STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
};
