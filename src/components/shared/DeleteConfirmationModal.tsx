import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { toPersianDigits } from "@/lib/shamsi";

interface Props {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmationModal({ title, onConfirm, onCancel }: Props) {
  const { bg, fg, fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        onClick={onCancel}
      />

      {/* Modal Card */}
      <motion.div
        className="relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }}
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
            <span className="font-bold text-sm">سیستم امنیتی اطمینان از حذف</span>
          </div>
          <button
            onClick={onCancel}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="text-center py-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>
          <h3 className="text-base font-black leading-snug" style={{ color: fg }}>
            آیا واقعاً می‌خواهید حذف کنید؟
          </h3>
          <div
            className="mt-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
            style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, color: fg }}
          >
            {title}
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: fgMuted }}>
            این عمل غیرقابل بازگشت است و اطلاعات انتخابی شما برای همیشه پاک خواهد شد.
          </p>
        </div>

        {/* Timer / Progress Section */}
        <div className="mt-4 flex flex-col items-center">
          {secondsLeft > 0 ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: fgMuted }}>
                جهت اطمینان، لطفاً منتظر بمانید...
              </span>
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 font-mono font-bold text-lg">
                {toPersianDigits(secondsLeft)}
              </div>
            </div>
          ) : (
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span>✓ دکمه تایید اکنون فعال است</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-3 w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500"
              initial={{ width: "0%" }}
              animate={{ width: `${((3 - secondsLeft) / 3) * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              if (secondsLeft <= 0) {
                onConfirm();
              }
            }}
            disabled={secondsLeft > 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: secondsLeft > 0 ? "rgba(128, 128, 128, 0.15)" : "#f43f5e",
              color: secondsLeft > 0 ? fgMuted : "#fff",
              boxShadow: secondsLeft > 0 ? "none" : "0 4px 14px rgba(244,63,94,0.25)"
            }}
          >
            <Trash2 className="h-4 w-4" />
            {secondsLeft > 0 ? `تایید حذف (${toPersianDigits(secondsLeft)})` : "تایید حذف"}
          </button>
          
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-3 text-xs font-bold transition-all hover:bg-white/10"
            style={{ border: `1px solid ${cardBorder}`, color: fg }}
          >
            انصراف
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
