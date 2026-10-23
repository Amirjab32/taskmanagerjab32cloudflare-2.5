import { useState, useEffect } from "react";
import HamburgerButton from "./HamburgerButton";
import ThemeToggle from "./ThemeToggle";
import { todayShamsi, todayShamsiShort, todayGregorianFormatted } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { syncManager, SyncStatus, SYNC_STATUS_EVENT } from "@/lib/sync";
import { Wifi, WifiOff, RefreshCw, Laptop } from "lucide-react";
import { PWAInstallButton } from "@/components/shared/PWAInstallButton";

interface Props {
  view: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
}

const VIEW_TITLES: Record<string, string> = {
  tasks: "مدیریت تسک",
  kanban: "کانبان",
  habits: "ردیاب عادت",
  srs: "مرور فاصله‌دار",
  quiz: "ردیاب تست",
  notes: "دفترچه یادداشت",
};

export default function TopBar({ view, menuOpen, onMenuToggle }: Props) {
  const { headerBg, fg, fgMuted, cardBorder } = useThemeStyles();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncManager.getStatus());
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent<SyncStatus>;
      setSyncStatus(customEvent.detail);
    };
    window.addEventListener(SYNC_STATUS_EVENT, handleStatusChange);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, handleStatusChange);
  }, []);

  const handleManualSync = async () => {
    setIsRotating(true);
    await syncManager.forceSync();
    setTimeout(() => setIsRotating(false), 800);
  };

  return (
    <header
      className="sticky top-0 z-30 w-full backdrop-blur-xl transition-colors duration-300"
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
                <span className="hidden sm:inline-block text-amber-500">آفلاین (دیتابیس محلی)</span>
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
    </header>
  );
}
