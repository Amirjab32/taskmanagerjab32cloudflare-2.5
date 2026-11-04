import { useState, useEffect } from "react";
import HamburgerButton from "./HamburgerButton";
import ThemeToggle from "./ThemeToggle";
import { todayShamsi, todayShamsiShort, todayGregorianFormatted, toPersianDigits } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { syncManager, SyncStatus, SYNC_STATUS_EVENT } from "@/lib/sync";
import { offlineQueue, OFFLINE_QUEUE_EVENT } from "@/lib/offlineQueue";
import { TimeCheckService, TimeCheckStatus, TIME_STATUS_EVENT } from "@/lib/timeCheck";
import { Wifi, WifiOff, RefreshCw, Laptop, AlertTriangle, X } from "lucide-react";
import { PWAInstallButton } from "@/components/shared/PWAInstallButton";

interface Props {
  view: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
}

const VIEW_TITLES: Record<string, string> = {
  tasks: "مدیریت تسک",
  kanban: "کانبان",
  planner: "پلنر",
  habits: "ردیاب عادت",
  going_up: "بالا رفتن",
  srs: "مرور فاصله‌دار",
  quiz: "ردیاب تست",
  motivation: "انگیزه و اهداف",
  notes: "دفترچه یادداشت",
};

export default function TopBar({ view, menuOpen, onMenuToggle }: Props) {
  const { headerBg, fg, fgMuted, cardBorder } = useThemeStyles();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncManager.getStatus());
  const [queueCount, setQueueCount] = useState<number>(() => offlineQueue.getPendingCount());
  const [isRotating, setIsRotating] = useState(false);
  const [timeStatus, setTimeStatus] = useState<TimeCheckStatus>(() => TimeCheckService.getStatus());
  const [showDriftDialog, setShowDriftDialog] = useState(false);

  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent<SyncStatus>;
      setSyncStatus(customEvent.detail);
    };
    const handleTimeStatus = (e: Event) => {
      const customEvent = e as CustomEvent<TimeCheckStatus>;
      setTimeStatus(customEvent.detail);
    };
    const handleQueueChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>;
      setQueueCount(customEvent.detail?.count ?? 0);
    };
    window.addEventListener(SYNC_STATUS_EVENT, handleStatusChange);
    window.addEventListener(TIME_STATUS_EVENT, handleTimeStatus);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
    return () => {
      window.removeEventListener(SYNC_STATUS_EVENT, handleStatusChange);
      window.removeEventListener(TIME_STATUS_EVENT, handleTimeStatus);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
    };
  }, []);

  const handleManualSync = async () => {
    setIsRotating(true);
    await syncManager.forceSync();
    setTimeout(() => setIsRotating(false), 800);
  };

  return (
    <header
      className="w-full backdrop-blur-xl transition-colors duration-300"
      style={{ backgroundColor: headerBg, borderBottom: `1px solid ${cardBorder}` }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <HamburgerButton open={menuOpen} onClick={onMenuToggle} />
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-bold leading-tight tracking-tight" style={{ color: fg }}>
              {todayShamsi()}
            </span>
            <span
              className="text-[11px] leading-tight"
              style={{ color: fgMuted, fontFamily: "'Segoe UI', system-ui, sans-serif", letterSpacing: "0.02em" }}
            >
              {todayGregorianFormatted()}
            </span>
          </div>
          <div className="flex flex-col sm:hidden">
            <span className="text-sm font-bold leading-tight" style={{ color: fg }}>
              {todayShamsiShort()}
            </span>
            <span
              className="text-[10px] leading-tight"
              style={{ color: fgMuted, fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            >
              {todayGregorianFormatted()}
            </span>
          </div>

          {/* نشانگر خطای ساعت سیستم در صورت عدم تطابق با ساعت جهانی اینترنت */}
          {timeStatus.hasDrift && (
            <button
              type="button"
              onClick={() => setShowDriftDialog(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold cursor-pointer transition-all hover:bg-rose-500/25 animate-pulse"
              title={`هشدار: ساعت سیستم شما حدود ${toPersianDigits(Math.abs(timeStatus.driftMinutes))} دقیقه اختلاف دارد`}
            >
              <AlertTriangle className="h-3 w-3 text-rose-400 flex-shrink-0" />
              <span>خطای ساعت ({toPersianDigits(Math.abs(timeStatus.driftMinutes))}د)</span>
            </button>
          )}
        </div>
        
        {/* عنوان بخش جاری */}
        <h1 className="text-base font-semibold hidden md:block" style={{ color: fg }}>
          {VIEW_TITLES[view] || "بهره‌وری"}
        </h1>

        {/* بخش هماهنگ‌سازی Wi-Fi و تم دکمه‌ها */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* دکمه نصب PWA */}
          <PWAInstallButton />

          {/* نشانگر هماهنگ‌سازی لپ‌تاپ */}
          <button
            onClick={handleManualSync}
            title="همگام‌سازی دستی با لپ‌تاپ"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold border transition-all duration-200 hover:bg-white/5 active:scale-95 cursor-pointer"
            style={{ borderColor: cardBorder }}
          >
            {syncStatus === "connected" && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline-block text-emerald-500">همگام با لپ‌تاپ</span>
              </>
            )}

            {syncStatus === "syncing" && (
              <>
                <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${isRotating || "animate-spin"}`} />
                <span className="hidden sm:inline-block text-indigo-400">در حال ذخیره‌سازی...</span>
              </>
            )}

            {syncStatus === "offline" && (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden sm:inline-block text-amber-500">
                  {queueCount > 0 ? `آفلاین (${toPersianDigits(queueCount)} در صف)` : "آفلاین (دیتابیس محلی)"}
                </span>
                {queueCount > 0 && (
                  <span className="sm:hidden px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded-full text-[9px] font-bold">
                    {toPersianDigits(queueCount)}
                  </span>
                )}
              </>
            )}

            {syncStatus === "idle" && (
              <>
                <Laptop className="h-3.5 w-3.5 text-gray-400" />
                <span className="hidden sm:inline-block text-gray-400">آماده هماهنگی</span>
              </>
            )}

            {/* آیکون لود دستی برای دسکتاپ/گوشی */}
            <RefreshCw className={`h-3 w-3 text-gray-400 mr-0.5 sm:mr-1 ${isRotating ? "animate-spin" : ""}`} />
          </button>

          <ThemeToggle />
        </div>
      </div>

      {/* مودال راهنمای تنظیم ساعت در صورت خطای ساعت سیستم */}
      {showDriftDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDriftDialog(false)}
        >
          <div 
            className="w-full max-w-sm p-4 rounded-2xl border space-y-3 bg-[#141416] text-right shadow-2xl"
            style={{ borderColor: cardBorder }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: cardBorder }}>
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>عدم تطابق ساعت دستگاه با ساعت رسمی</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDriftDialog(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5 leading-relaxed text-zinc-300">
              <p>
                ساعت گوشی یا لپ‌تاپ شما حدود <span className="font-bold text-rose-400 font-mono">{toPersianDigits(Math.abs(timeStatus.driftMinutes))} دقیقه</span> {timeStatus.driftMinutes > 0 ? "جلوتر" : "عقب‌تر"} از ساعت رسمی اینترنت است.
              </p>
              <p className="text-[11px] text-zinc-400">
                این اختلاف می‌تواند باعث شود اوقات شرعی، تایمرها و نشانگر زمان واقعی با خطای زمانی نمایش داده شوند.
              </p>
            </div>

            <div className="space-y-1 text-[11px] text-zinc-300 leading-relaxed">
              <span className="font-bold text-white block">روش رفع مشکل:</span>
              <p className="text-zinc-400">
                وارد بخش تنظیمات ساعت دستگاه خود شوید و گزینه <b>تنظیم خودکار ساعت شبکه (Automatic Date & Time)</b> را روشن کنید تا ساعت شما به زمان دقیق کشور هماهنگ شود.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowDriftDialog(false);
                TimeCheckService.checkTimeDrift().catch(() => {});
              }}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              متوجه شدم • بررسی مجدد
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
