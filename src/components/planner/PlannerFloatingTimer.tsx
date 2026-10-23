import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Square, X, CheckCircle2, Clock } from "lucide-react";
import { PlannerTimerService, ActivePlannerTimer } from "@/lib/plannerTimer";
import { toPersianDigits } from "@/lib/shamsi";

export default function PlannerFloatingTimer() {
  const [activeTimer, setActiveTimer] = useState<ActivePlannerTimer | null>(() =>
    PlannerTimerService.getActiveTimer()
  );
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const handleTimerChange = (e: Event) => {
      const customEvent = e as CustomEvent<ActivePlannerTimer | null>;
      setActiveTimer(customEvent.detail);
    };

    window.addEventListener("focusflow-planner-timer-change", handleTimerChange);
    return () => window.removeEventListener("focusflow-planner-timer-change", handleTimerChange);
  }, []);

  // Update clock every second when timer is running
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer) return null;

  // Calculate elapsed time
  const elapsedSecondsSinceStart = Math.max(0, Math.floor((now - activeTimer.startedAt) / 1000));
  const totalSeconds = activeTimer.accumulatedSeconds + elapsedSecondsSinceStart;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTime =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const targetSeconds = (activeTimer.targetDurationMinutes > 0 ? activeTimer.targetDurationMinutes : 60) * 60;
  // محاسبه زنده ثانیه به ثانیه یک درصد به یک درصد
  const progressPercent = Math.min(100, Math.floor((totalSeconds / targetSeconds) * 100));
  const progressRatio = Math.min(100, (totalSeconds / targetSeconds) * 100);
  const isThresholdMet = progressPercent >= activeTimer.threshold;

  const handleStopAndSave = () => {
    PlannerTimerService.stopTimer();
  };

  const handleCancel = () => {
    PlannerTimerService.cancelTimer();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="sticky top-14 z-40 w-full px-3 py-2 bg-gradient-to-r from-zinc-900/95 via-zinc-900/98 to-zinc-900/95 backdrop-blur-xl border-b border-amber-500/30 shadow-2xl"
        dir="rtl"
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* سمت راست: نام پارت و بازه */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-bold text-white truncate">
                  {activeTimer.subject}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                  {toPersianDigits(activeTimer.timeSlot)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                {activeTimer.taskTitle && (
                  <span className="text-indigo-400 truncate">
                    تسک: {activeTimer.taskTitle}
                  </span>
                )}
                {activeTimer.habitName && (
                  <span className="text-amber-400 truncate">
                    عادت: {activeTimer.habitName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* مرکز: ثانیه‌شمار زنده و نوار پیشرفت */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 border border-zinc-800">
              <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span className="text-sm font-mono font-black text-amber-400 tracking-wider">
                {toPersianDigits(formattedTime)}
              </span>
            </div>

            <div className="flex flex-col w-20 sm:w-28 gap-1">
              <div className="flex justify-between text-[9px] font-bold">
                <span className={isThresholdMet ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                  {toPersianDigits(progressPercent)}٪
                </span>
                <span className="text-zinc-500 font-mono text-[8px] sm:text-[9px]">
                  هدف: {toPersianDigits(activeTimer.threshold)}٪
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    isThresholdMet ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* سمت چپ: دکمه‌های کنترل */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleStopAndSave}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                isThresholdMet
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
              }`}
              title="توقف تایمر و ثبت عملکرد در پلنر"
            >
              {isThresholdMet ? (
                <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
              ) : (
                <Square className="h-3 w-3 fill-current" />
              )}
              <span>{isThresholdMet ? "تکمیل و ثبت" : "توقف و ثبت"}</span>
            </button>

            <button
              onClick={handleCancel}
              className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
              title="لغو تایمر بدون ذخیره"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
