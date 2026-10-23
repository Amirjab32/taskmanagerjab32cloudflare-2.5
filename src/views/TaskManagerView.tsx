import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { useState } from "react";
import TaskForm from "@/components/tasks/TaskForm";
import TaskItem from "@/components/tasks/TaskItem";
import { Task, RecurringActivity } from "@/lib/store";
import {
  getGregorianToday,
  getTodayJalali,
  toPersianDigits,
  getTaskDateRanges,
  MONTH_NAMES,
  jalaliToGregorian,
  daysInJalaliMonth,
  addDays,
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  tasks: Task[];
  activities: RecurringActivity[];
  onAdd: (data: {
    title: string;
    priority: "low" | "medium" | "high";
    scheduled_date: string;
    comment?: string;
    tags?: string[];
    activity_id?: string | null;
  }) => void;
  onStatusChange: (task: Task, status: "todo" | "in_progress" | "done") => void;
  onDelete: (id: string) => void;
  onActivitiesChange: () => void;
}

const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
const byPriority = (a: Task, b: Task) => priorityRank[a.priority] - priorityRank[b.priority];

function getWeekRange(jy: number, jm: number, jd: number): { weekStart: string; weekEnd: string } {
  let weekEndDay: number;
  if (jd <= 7) weekEndDay = 7;
  else if (jd <= 14) weekEndDay = 14;
  else if (jd <= 21) weekEndDay = 21;
  else weekEndDay = daysInJalaliMonth(jy, jm);
  let weekStartDay: number;
  if (jd <= 7) weekStartDay = 1;
  else if (jd <= 14) weekStartDay = 8;
  else if (jd <= 21) weekStartDay = 15;
  else weekStartDay = 22;
  const weekStart = jalaliToGregorian(jy, jm, weekStartDay);
  const weekEnd = jalaliToGregorian(jy, jm, weekEndDay);
  return { weekStart, weekEnd };
}

function getMonthRestRange(jy: number, jm: number, jd: number): { monthRestStart: string; monthEnd: string } | null {
  let weekEndDay: number;
  if (jd <= 7) weekEndDay = 7;
  else if (jd <= 14) weekEndDay = 14;
  else if (jd <= 21) weekEndDay = 21;
  else weekEndDay = daysInJalaliMonth(jy, jm);
  const totalDays = daysInJalaliMonth(jy, jm);
  if (weekEndDay >= totalDays) return null;
  const monthRestStart = jalaliToGregorian(jy, jm, weekEndDay + 1);
  const monthEnd = jalaliToGregorian(jy, jm, totalDays);
  return { monthRestStart, monthEnd };
}

export default function TaskManagerView({ tasks, activities, onAdd, onStatusChange, onDelete, onActivitiesChange }: Props) {
  const { fg, fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [showDone, setShowDone] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const today = getGregorianToday();
  const [jy, jm, jd] = getTodayJalali();
  const { weekEnd } = getWeekRange(jy, jm, jd);
  const monthRestRange = getMonthRestRange(jy, jm, jd);
  const { monthEndGreg } = getTaskDateRanges();
  const tomorrow = addDays(today, 1);

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const overdue = activeTasks.filter((t) => t.scheduled_date && t.scheduled_date < today).sort(byPriority);
  const todayTasks = activeTasks.filter((t) => !t.scheduled_date || t.scheduled_date === today).sort(byPriority);
  const thisWeekTasks = activeTasks.filter((t) => t.scheduled_date && t.scheduled_date >= tomorrow && t.scheduled_date <= weekEnd).sort(byPriority);
  const thisMonthTasks = monthRestRange
    ? activeTasks.filter((t) => t.scheduled_date && t.scheduled_date >= monthRestRange.monthRestStart && t.scheduled_date <= monthRestRange.monthEnd).sort(byPriority)
    : [];
  const laterTasks = activeTasks.filter((t) => t.scheduled_date && t.scheduled_date > monthEndGreg).sort(byPriority);
  const isCompletedToday = (completedAt: number | null | undefined, todayStr: string): boolean => {
    if (!completedAt) return false;
    const d = new Date(completedAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    const compStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return compStr === todayStr;
  };
  const doneTasks = tasks.filter((t) => t.status === "done" && isCompletedToday(t.completed_at, today));
  const currentMonthName = MONTH_NAMES[jm - 1];

  const handleAdd = (data: Parameters<typeof onAdd>[0]) => {
    onAdd(data);
    onActivitiesChange();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <TaskForm onAdd={handleAdd} activities={activities} />
      {overdue.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            <h2 className="text-sm font-semibold" style={{ color: "#f87171" }}>
              عقب‌افتاده ({toPersianDigits(overdue.length)})
            </h2>
          </div>
          <AnimatePresence>
            {overdue.map((task) => (
              <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} activities={activities} />
            ))}
          </AnimatePresence>
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          <h2 className="text-sm font-semibold" style={{ color: fg }}>
            امروز ({toPersianDigits(todayTasks.length)})
          </h2>
        </div>
        {todayTasks.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-6 text-center text-sm"
            style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
            تسکی برای امروز نداری 🎉
          </motion.div>
        ) : (
          <AnimatePresence>
            {todayTasks.map((task) => (
              <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} activities={activities} />
            ))}
          </AnimatePresence>
        )}
      </section>
      {thisWeekTasks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
            <h2 className="text-sm font-semibold" style={{ color: fg }}>
              این هفته ({toPersianDigits(thisWeekTasks.length)})
            </h2>
          </div>
          <AnimatePresence>
            {thisWeekTasks.map((task) => (
              <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} activities={activities} />
            ))}
          </AnimatePresence>
        </section>
      )}
      {thisMonthTasks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" style={{ color: "#34d399" }} />
            <h2 className="text-sm font-semibold" style={{ color: fg }}>
              {currentMonthName} ({toPersianDigits(thisMonthTasks.length)})
            </h2>
          </div>
          <AnimatePresence>
            {thisMonthTasks.map((task) => (
              <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} activities={activities} />
            ))}
          </AnimatePresence>
        </section>
      )}
      {laterTasks.length > 0 && (
        <section className="space-y-2">
          <button onClick={() => setShowLater(!showLater)} className="flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: fgMuted }}>
            <CalendarRange className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
            بعداً ({toPersianDigits(laterTasks.length)})
            {showLater ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {showLater && laterTasks.map((task) => (
              <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} activities={activities} />
            ))}
          </AnimatePresence>
        </section>
      )}
      {doneTasks.length > 0 && (
        <section className="space-y-2">
          <button onClick={() => setShowDone(!showDone)} className="flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: fgMuted }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            انجام‌شده ({toPersianDigits(doneTasks.length)})
            {showDone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {showDone && doneTasks.map((task) => (
              <TaskItem key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} activities={activities} />
            ))}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
