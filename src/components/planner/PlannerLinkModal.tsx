import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Link2, CheckSquare, Sparkles, Percent, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { PlannerEntry, TaskStore, HabitStore, Task, Habit, PlannerStore } from "@/lib/store";
import { toPersianDigits, toShamsiShort, getGregorianToday } from "@/lib/shamsi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entry: PlannerEntry | null;
  onSave: (taskId: string | null, habitId: string | null, customThreshold: number | null) => void;
}

export default function PlannerLinkModal({ isOpen, onClose, entry, onSave }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const [thresholdInput, setThresholdInput] = useState<string>("");
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  const taskPickerRef = useRef<HTMLDivElement>(null);

  const globalThreshold = PlannerStore.getGlobalThreshold();

  useEffect(() => {
    if (isOpen && entry) {
      setTasks(TaskStore.list());
      setHabits(HabitStore.list());
      setSelectedTaskId(entry.task_id || "");
      setSelectedHabitId(entry.habit_id || "");
      setShowAllTasks(false);
      setIsTaskPickerOpen(false);
      setThresholdInput(
        entry.custom_threshold !== undefined && entry.custom_threshold !== null
          ? entry.custom_threshold.toString()
          : ""
      );
    }
  }, [isOpen, entry]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (taskPickerRef.current && !taskPickerRef.current.contains(e.target as Node)) {
        setIsTaskPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const targetDate = entry?.date || "";
  const targetDateShamsi = targetDate ? toShamsiShort(targetDate) : "";
  const today = getGregorianToday();
  const isTargetToday = targetDate === today;

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // فیلتر هوشمند تسک‌ها بر اساس تاریخ تقویم پلنر و پشتیبانی از تسک‌های عقب‌افتاده برای امروز
  const filteredTasks = useMemo(() => {
    if (showAllTasks) {
      return [...tasks].sort((a, b) => {
        const aDate = a.scheduled_date || a.created_date;
        const bDate = b.scheduled_date || b.created_date;
        const aIsDate = aDate === targetDate;
        const bIsDate = bDate === targetDate;
        if (aIsDate && !bIsDate) return -1;
        if (!aIsDate && bIsDate) return 1;
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        return 0;
      });
    }

    return tasks
      .filter((task) => {
        // تسک متصل شده فعلی همیشه حفظ شود تا انتخاب قبلی گم نشود
        if (task.id === selectedTaskId) return true;

        const taskDate = task.scheduled_date || task.created_date;

        // ۱. اگر تاریخ تسک دقیقاً همان تاریخ بازه پلنر باشد (فارغ از وضعیت: انجام‌شده، در حال انجام یا در انتظار)
        if (taskDate === targetDate) return true;

        // ۲. اگر روز پلنر «امروز» باشد، تمامی تسک‌های تاریخ گذشته (شامل انجام‌شده یا عقب‌افتاده) نمایش داده شوند
        if (isTargetToday && taskDate < today) {
          return true;
        }

        // ۳. اگر تاریخ تکمیل تسک با تاریخ انتخابی پلنر مطابقت داشته باشد
        if (task.completed_at) {
          const cDate = new Date(task.completed_at);
          const pad = (n: number) => String(n).padStart(2, "0");
          const completedDateStr = `${cDate.getFullYear()}-${pad(cDate.getMonth() + 1)}-${pad(cDate.getDate())}`;
          if (completedDateStr === targetDate) return true;
        }

        return false;
      })
      .sort((a, b) => {
        // اگر امروز هستیم، اولویت با تسک‌های تاریخ امروز است، سپس تسک‌های گذشته
        const aDate = a.scheduled_date || a.created_date;
        const bDate = b.scheduled_date || b.created_date;
        const aIsToday = aDate === targetDate;
        const bIsToday = bDate === targetDate;
        if (aIsToday && !bIsToday) return -1;
        if (!aIsToday && bIsToday) return 1;

        // تسک‌های انجام‌نشده یا در حال انجام بالاتر از انجام‌شده‌ها قرار گیرند
        if (a.status !== "done" && b.status === "done") return -1;
        if (a.status === "done" && b.status !== "done") return 1;

        const pOrder = { high: 0, medium: 1, low: 2 };
        return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
      });
  }, [tasks, targetDate, showAllTasks, selectedTaskId, isTargetToday, today]);

  if (!isOpen || !entry) return null;

  const handleSave = () => {
    const customThreshold = thresholdInput.trim() !== "" ? parseInt(thresholdInput, 10) : null;
    const validatedThreshold = customThreshold !== null && !isNaN(customThreshold)
      ? Math.max(10, Math.min(100, customThreshold))
      : null;

    onSave(
      selectedTaskId ? selectedTaskId : null,
      selectedHabitId ? selectedHabitId : null,
      validatedThreshold
    );
    onClose();
  };

  const handleClearLinks = () => {
    onSave(null, null, null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md rounded-3xl bg-[#18181b] border border-zinc-800 shadow-2xl p-5 text-right overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* هدر مدال */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">اتصال بازه به تسک و عادت</h3>
                <span className="text-[11px] text-zinc-400">
                  بازه: <b className="text-amber-400 font-mono">{toPersianDigits(entry.time_slot)}</b>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 px-0.5 py-1">
            {/* ۱. اتصال به تسک */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                  <span>اتصال به تسک (مدیریت تسک و کانبان)</span>
                </label>
                {targetDateShamsi && (
                  <span className="text-[10px] text-indigo-400 font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    تاریخ: {toPersianDigits(targetDateShamsi)}
                  </span>
                )}
              </div>
              {/* کادر انتخابی تعاملی با نمایش واقعی بج‌های هشتگ */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTaskPickerOpen(!isTaskPickerOpen)}
                  className="w-full min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700/80 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors flex items-center justify-between gap-2 text-right cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    {selectedTask ? (
                      <>
                        <span className="text-xs">
                          {selectedTask.priority === "high" ? "🔴" : selectedTask.priority === "medium" ? "🟡" : "🟢"}
                        </span>
                        <span className="font-semibold text-white truncate max-w-[150px]">
                          {selectedTask.title}
                        </span>
                        {selectedTask.tags && selectedTask.tags.length > 0 && selectedTask.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5"
                          >
                            #{t.replace(/^#+/, "")}
                          </span>
                        ))}
                        {selectedTask.status === "done" && (
                          <span className="rounded px-1.5 py-0.5 text-[9px] bg-emerald-500/15 text-emerald-400">
                            انجام‌شده
                          </span>
                        )}
                        {selectedTask.status === "in_progress" && (
                          <span className="rounded px-1.5 py-0.5 text-[9px] bg-amber-500/15 text-amber-400">
                            در حال انجام
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-400">-- بدون اتصال به تسک --</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400 flex-shrink-0">
                    {selectedTaskId && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTaskId("");
                        }}
                        className="p-1 hover:text-rose-400 rounded cursor-pointer"
                        title="حذف اتصال تسک"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                    {isTaskPickerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* منوی بازشونده تسک‌ها */}
                {isTaskPickerOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1 divide-y divide-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTaskId("");
                        setIsTaskPickerOpen(false);
                      }}
                      className={`w-full text-right px-2.5 py-2 text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                        !selectedTaskId ? "bg-indigo-500/10 text-indigo-300 font-bold" : "text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <span>-- بدون اتصال به تسک --</span>
                      {!selectedTaskId && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                    </button>

                    {filteredTasks.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-zinc-500">
                        هیچ تسکی برای این تاریخ یافت نشد
                      </div>
                    ) : (
                      filteredTasks.map((task) => {
                        const taskDate = task.scheduled_date || task.created_date;
                        const isOtherDate = showAllTasks && taskDate !== targetDate;
                        const isPastDate = !showAllTasks && isTargetToday && taskDate < today;
                        const isSelected = task.id === selectedTaskId;
                        const priorityDot = task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢";

                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setIsTaskPickerOpen(false);
                            }}
                            className={`w-full text-right px-2.5 py-2 text-xs rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected ? "bg-indigo-500/15 border border-indigo-500/30 text-white font-semibold" : "hover:bg-zinc-800/80 text-zinc-200"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                              <span>{priorityDot}</span>
                              <span className="font-medium text-white">{task.title}</span>
                              
                              {/* بج‌های هشتگ به صورت کاملاً تفکیک‌شده و زیبا */}
                              {task.tags && task.tags.length > 0 && task.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                                >
                                  #{t.replace(/^#+/, "")}
                                </span>
                              ))}

                              {task.comment && (
                                <span className="text-[10px] text-zinc-400 inline-flex items-center gap-0.5">
                                  💬 {task.comment}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {task.status === "done" && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] bg-emerald-500/15 text-emerald-400">
                                  انجام‌شده
                                </span>
                              )}
                              {task.status === "in_progress" && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] bg-amber-500/15 text-amber-400">
                                  در حال انجام
                                </span>
                              )}
                              {isPastDate && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] bg-zinc-800 text-zinc-400">
                                  {toPersianDigits(toShamsiShort(taskDate))}
                                </span>
                              )}
                              {isOtherDate && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] bg-zinc-800 text-zinc-400">
                                  {toPersianDigits(toShamsiShort(taskDate))}
                                </span>
                              )}
                              {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <p className="text-[10px] text-zinc-500 leading-tight">
                  {showAllTasks
                    ? "نمایش همه تسک‌ها از تمام تاریخ‌ها"
                    : isTargetToday
                    ? `تسک‌های امروز (${toPersianDigits(targetDateShamsi)}) و تسک‌های گذشته`
                    : `تسک‌های مربوط به ${toPersianDigits(targetDateShamsi)}`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAllTasks(!showAllTasks)}
                  className="text-[10px] text-zinc-400 hover:text-indigo-400 transition-colors underline cursor-pointer"
                >
                  {showAllTasks ? "فقط تسک‌های فیلترشده" : "نمایش همه تسک‌ها"}
                </button>
              </div>
            </div>

            {/* ۲. اتصال به عادت */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>اتصال به عادت (ردیاب عادت)</span>
              </label>
              <select
                value={selectedHabitId}
                onChange={(e) => setSelectedHabitId(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700/80 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">-- بدون اتصال به عادت --</option>
                {habits.map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    {habit.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-500 leading-tight">
                با رسیدن عملکرد به حد نصاب زمانی، تیک عادت برای تاریخ امروز خودکار زده می‌شود.
              </p>
            </div>

            {/* ۳. درصد حد نصاب اختصاصی */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-emerald-400" />
                  <span>درصد اختصاصی این بازه</span>
                </label>
                <span className="text-[10px] text-zinc-400">
                  پیش‌فرض کل: <b className="text-emerald-400 font-mono">{toPersianDigits(globalThreshold)}٪</b>
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  placeholder={`خالی = استفاده از پیش‌فرض کل (${toPersianDigits(globalThreshold)}٪)`}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700/80 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono text-left dir-ltr"
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                مثال: اگر در ایام امتحانات ۵۰ درصد زمان کارکرد برای این بازه کافی است، عدد ۵۰ را بنویسید.
              </p>
            </div>
          </div>

          {/* دکمه‌های پایین */}
          <div className="flex items-center gap-2 pt-4 border-t border-zinc-800 mt-2">
            {(entry.task_id || entry.habit_id || entry.custom_threshold) && (
              <button
                type="button"
                onClick={handleClearLinks}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer"
                title="حذف اتصال‌ها"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>قطع اتصال</span>
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>ذخیره اتصال</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
