import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Smartphone,
  X,
  CheckCircle2,
  Lock,
  BatteryCharging
} from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import {
  checkExactAlarmPermission,
  requestExactAlarmPermission,
  testWakeupAlarm,
  setupAndroidNotificationChannels
} from "@/lib/notifications";
import { Capacitor } from "@capacitor/core";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlarmPermissionGuideModal({ isOpen, onClose }: Props) {
  const { fg, fgMuted, isDark } = useThemeStyles();
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean>(true);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isOpen) {
      setupAndroidNotificationChannels();
      checkExactAlarmPermission().then(setExactAlarmGranted);
    }
  }, [isOpen]);

  const handleRequestExactAlarm = async () => {
    await requestExactAlarmPermission();
    // چک کردن مجدد بعد از بازگشت احتمالی کاربر
    setTimeout(() => {
      checkExactAlarmPermission().then(setExactAlarmGranted);
    }, 2000);
  };

  const handleRunTest = async () => {
    setTesting(true);
    setTestSuccess(false);
    setCountdown(5);

    const ok = await testWakeupAlarm(5);
    if (ok) {
      setTestSuccess(true);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            setTesting(false);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTesting(false);
      setCountdown(null);
    }
  };

  if (!isOpen) return null;

  const modalBg = isDark ? "#141416" : "#ffffff";
  const itemBg = isDark ? "#1d1d21" : "rgba(0,0,0,0.03)";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        dir="rtl"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[88vh]"
          style={{
            backgroundColor: modalBg,
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  تنظیمات بیدارباش دقیق و زنگ‌دار
                </h3>
                <p className="text-[11px]" style={{ color: fgMuted }}>
                  عملکرد مشابه برنامه‌های اذان‌گو و ساعت زنگدار در خواب عمیق گوشی
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer text-zinc-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 overflow-y-auto text-xs leading-relaxed">
            {/* Box 1: Exact Alarms (Android 12/13/14) */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{ backgroundColor: itemBg, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold" style={{ color: fg }}>
                    مجوز آلارم‌ها و یادآورهای دقیق
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    exactAlarmGranted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {exactAlarmGranted ? "مجوز داده شده" : "نیاز به تایید دستی"}
                </span>
              </div>
              <p style={{ color: fgMuted }}>
                این دسترسی به سیستم‌عامل اندروید اجازه می‌دهد یادآور را در ثانیه دقیق و بدون تاخیر حتی زمان خاموش بودن صفحه فعال کند.
              </p>
              {isNative && !exactAlarmGranted && (
                <button
                  type="button"
                  onClick={handleRequestExactAlarm}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="h-4 w-4" />
                  باز کردن تنظیمات آلارم در اندروید
                </button>
              )}
            </div>

            {/* Box 2: Xiaomi / Samsung / Huawei aggressive battery management */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5 bg-amber-500/[0.04] border-amber-500/20"
            >
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>رفع مشکل بسته شدن توسط برنامه‌های اخیر (شیائومی / سامسونگ)</span>
              </div>
              <p style={{ color: fgMuted }}>
                در رابط‌های کاربری مانند شیائومی (MIUI/HyperOS) یا سامسونگ، هنگام بستن برنامه از منوی برنامه‌های اخیر، فرآیندها به صورت اجباری متوقف می‌شوند مگر این ۳ تنظیم را فعال کنید:
              </p>
              <div className="space-y-2 text-[11px]" style={{ color: fg }}>
                <div className="flex items-start gap-2 bg-black/20 p-2 rounded-lg">
                  <Sparkles className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-300">۱. شروع خودکار (Autostart):</span>
                    <span className="mr-1 text-zinc-300">در تنظیمات برنامه، گزینه Autostart یا شروع خودکار را روشن کنید.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-black/20 p-2 rounded-lg">
                  <BatteryCharging className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-300">۲. بهینه‌سازی باتری (No restrictions):</span>
                    <span className="mr-1 text-zinc-300">در بخش ذخیره باتری، حالت «بدون محدودیت» (No restrictions) را بگذارید.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-black/20 p-2 rounded-lg">
                  <Lock className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sky-300">۳. پاپ‌آپ و صفحه قفل (Display pop-up windows):</span>
                    <span className="mr-1 text-zinc-300">در بخش مجوزهای دیگر (Other permissions)، مجوز «نمایش روی صفحه قفل» و «نمایش پنجره پاپ‌آپ» را فعال کنید.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: 5-Second Test Alarm */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{ backgroundColor: itemBg, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold" style={{ color: fg }}>
                    تست زنگ بیدارباش (۵ ثانیه‌ای)
                  </span>
                </div>
              </div>
              <p style={{ color: fgMuted }}>
                روی دکمه زیر بزنید و بلافاصله دکمه پاور گوشی را بزنید تا صفحه قفل شود. در ثانیه ۵ زنگ و اعلان باید با بیدار کردن صفحه ظاهر شود:
              </p>

              <button
                type="button"
                onClick={handleRunTest}
                disabled={testing}
                className={`w-full py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  testing
                    ? "bg-amber-500 text-black cursor-not-allowed animate-pulse"
                    : "bg-emerald-500 hover:bg-emerald-600 text-black cursor-pointer shadow-lg shadow-emerald-500/20"
                }`}
              >
                {testing ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>آلارم تنظیم شد! صفحه را قفل کنید ({countdown} ثانیه)...</span>
                  </>
                ) : (
                  <>
                    <BellRing className="h-4 w-4" />
                    <span>شروع تست ۵ ثانیه‌ای زنگ و بیدارباش</span>
                  </>
                )}
              </button>

              {testSuccess && (
                <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-medium pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>دستور زمان‌بندی دقیق به سیستم‌عامل اندروید ارسال شد.</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-white/10 bg-white/[0.02] flex justify-end">
            <button
              onClick={onClose}
              className="py-1.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs cursor-pointer transition-colors"
            >
              متوجه شدم و بستن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
