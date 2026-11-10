import { apiUrl } from "./sync";


export interface TimeCheckStatus {
  checked: boolean;
  hasDrift: boolean;
  driftMinutes: number;
  serverDateStr?: string;
}

let currentStatus: TimeCheckStatus = {
  checked: false,
  hasDrift: false,
  driftMinutes: 0
};

export const TIME_STATUS_EVENT = "focusflow-time-status-changed";

export const TimeCheckService = {
  getStatus(): TimeCheckStatus {
    return currentStatus;
  },

  async checkTimeDrift(): Promise<TimeCheckStatus> {
    if (typeof window === "undefined" || !navigator.onLine) {
      return currentStatus;
    }

    try {
      // ارسال یک درخواست سبک با متد HEAD برای دریافت هدر Date سرور
      const response = await fetch(apiUrl("/api/db"), {
        method: "HEAD",
        cache: "no-store",
      }).catch(() => null);

      if (!response) return currentStatus;

      const dateHeader = response.headers.get("date");
      if (!dateHeader) return currentStatus;

      const serverTime = new Date(dateHeader).getTime();
      const localTime = Date.now();
      const diffMs = localTime - serverTime;
      const diffMins = Math.round(diffMs / 60000);

      // اگر اختلاف بیش از ۲ دقیقه باشد (به دلیل تنظیم دستی اشتباه ساعت سیستم)
      const hasDrift = Math.abs(diffMins) >= 2;

      currentStatus = {
        checked: true,
        hasDrift,
        driftMinutes: diffMins,
        serverDateStr: dateHeader
      };

      window.dispatchEvent(new CustomEvent(TIME_STATUS_EVENT, { detail: currentStatus }));
      return currentStatus;
    } catch {
      return currentStatus;
    }
  },

  init(): void {
    if (typeof window === "undefined") return;

    // بررسی اولیه بعد از ۵ ثانیه از لود برنامه
    setTimeout(() => {
      this.checkTimeDrift().catch(() => {});
    }, 5000);

    // پایش دوره‌ای هر ۳۰ دقیقه یکبار در صورت اتصال
    setInterval(() => {
      this.checkTimeDrift().catch(() => {});
    }, 30 * 60 * 1000);

    // بررسی مجدد هنگام اتصال مجدد به اینترنت
    window.addEventListener("online", () => {
      this.checkTimeDrift().catch(() => {});
    });
  }
};
