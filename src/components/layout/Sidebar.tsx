import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, Columns3, Repeat, ArrowUpCircle, Brain, LogOut, X, ClipboardList, AlertTriangle, ShieldCheck, ShieldAlert, Database, Notebook, Flame, Calendar } from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { syncManager } from "@/lib/sync";
import { toPersianDigits } from "@/lib/shamsi";

interface Props {
  open: boolean;
  view: string;
  onViewChange: (v: string) => void;
  onClose: () => void;
  onOpenBackup: () => void;
}

const NAV_ITEMS = [
  { id: "tasks", label: "مدیریت تسک", icon: CheckSquare },
  { id: "kanban", label: "کانبان", icon: Columns3 },
  { id: "planner", label: "پلنر", icon: Calendar },
  { id: "habits", label: "ردیاب عادت", icon: Repeat },
  { id: "going_up", label: "بالا رفتن", icon: ArrowUpCircle },
  { id: "srs", label: "مرور فاصله‌دار", icon: Brain },
  { id: "quiz", label: "ردیاب تست", icon: ClipboardList },
  { id: "motivation", label: "انگیزه و اهداف", icon: Flame },
  { id: "notes", label: "دفترچه یادداشت", icon: Notebook },
];

export default function Sidebar({ open, view, onViewChange, onClose, onOpenBackup }: Props) {
  const { sidebarBg, fg, fgMuted, cardBorder } = useThemeStyles();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5.0);
  const [safeMode, setSafeMode] = useState(() => {
    return localStorage.getItem("focusflow_safe_mode") !== "false";
  });

  useEffect(() => {
    if (!open) {
      setShowConfirm(false);
    }
  }, [open]);

  useEffect(() => {
    if (!showConfirm) {
      setDeleteCountdown(5.0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 5.0 - elapsed);
      setDeleteCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [showConfirm]);

  const handleSelect = (id: string) => {
    onViewChange(id);
    onClose();
  };

  const toggleSafeMode = () => {
    const newVal = !safeMode;
    setSafeMode(newVal);
    localStorage.setItem("focusflow_safe_mode", String(newVal));
    window.dispatchEvent(new CustomEvent("safe-mode-changed", { detail: { enabled: newVal } }));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            dir="rtl"
            className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col shadow-2xl"
            style={{ backgroundColor: sidebarBg, borderLeft: `1px solid ${cardBorder}` }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: `1px solid ${cardBorder}` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500">
                  <CheckSquare className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold" style={{ color: fg }}>بهره‌وری</span>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
              {NAV_ITEMS.map(({ id, label, icon: Icon }, i) => (
                <motion.button
                  key={id}
                  onClick={() => handleSelect(id)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i + 0.1 }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all"
                  style={
                    view === id
                      ? { backgroundColor: "#6366f1", color: "#ffffff", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }
                      : { color: fgMuted }
                  }
                  onMouseEnter={(e) => {
                    if (view !== id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLElement).style.color = fg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (view !== id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                      (e.currentTarget as HTMLElement).style.color = fgMuted;
                    }
                  }}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{label}</span>
                </motion.button>
              ))}
            </nav>
            <div className="p-4 space-y-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
              {/* Safe Mode Toggle */}
              <div className="flex items-center justify-between rounded-xl p-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(99,102,241,0.05)" }}>
                <div className="flex items-center gap-2">
                  {safeMode ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-rose-400" />}
                  <span className="text-xs font-semibold" style={{ color: fg }}>حالت اطمینان (حذف امن)</span>
                </div>
                <button onClick={toggleSafeMode} className="relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer" style={{ backgroundColor: safeMode ? "#10b981" : "rgba(128,128,128,0.3)" }}>
                  <span className="h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200" style={{ transform: safeMode ? "translateX(-21px)" : "translateX(-4px)" }} />
                </button>
              </div>

              {/* Sync Actions */}
              <button 
                onClick={() => {
                  onOpenBackup();
                  onClose();
                }} 
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all hover:bg-white/5 cursor-pointer border" 
                style={{ borderColor: cardBorder, color: fg }}
              >
                <Database className="h-4 w-4 text-amber-500" />
                <span className="flex-1 text-right">پشتیبان‌گیری و انتقال اطلاعات</span>
              </button>

              {!showConfirm ? (
                <button
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-xs font-semibold transition-colors hover:bg-rose-500/10"
                  style={{ color: "#f87171" }}
                  onClick={() => setShowConfirm(true)}
                >
                  <LogOut className="h-4 w-4" />
                  <span>پاک کردن داده‌ها</span>
                </button>
              ) : (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-400">
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                    <span>تایید نهایی پاک‌سازی کامل اطلاعات</span>
                  </div>
                  
                  <p className="text-[10px] text-rose-300/80 leading-relaxed text-right">
                    تمامی تسک‌ها، عادات، یادداشت‌ها و آمار به صورت دائمی حذف خواهند شد و قابل بازیابی نیستند.
                  </p>

                  {/* Countdown Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-semibold text-rose-400/70">
                      <span>{deleteCountdown > 0 ? "در حال آماده‌سازی دکمه..." : "دکمه تایید فعال شد"}</span>
                      <span className="font-mono">
                        {deleteCountdown > 0 ? `${toPersianDigits(deleteCountdown.toFixed(1))} ثانیه` : "تکمیل شد"}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: `${((5.0 - deleteCountdown) / 5.0) * 100}%` }}
                        transition={{ duration: 0.05, ease: "linear" }}
                        className={`h-full transition-colors duration-300 ${deleteCountdown > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (deleteCountdown <= 0) {
                          syncManager.clearDatabaseAndSync();
                        }
                      }}
                      disabled={deleteCountdown > 0}
                      className={`flex-1 rounded-lg py-2 text-[11px] font-bold transition-all ${
                        deleteCountdown > 0
                          ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                          : "bg-rose-500 hover:bg-rose-600 text-white cursor-pointer shadow-lg shadow-rose-500/20"
                      }`}
                    >
                      {deleteCountdown > 0 ? "صبر کنید..." : "بله، کاملاً پاک کن"}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 rounded-lg bg-white/10 py-2 text-[11px] font-semibold transition-colors hover:bg-white/20"
                      style={{ color: fg }}
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-1 text-center text-[11px] select-none" style={{ color: fgMuted }}>
                <span>نسخه ۲.۴</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
