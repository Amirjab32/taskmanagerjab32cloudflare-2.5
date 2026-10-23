import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Clock, Loader2, CheckCircle2, BarChart3, List, Calendar as CalIcon,
  X, Plus, Trash2, Timer, Activity, ChevronDown, ChevronUp, Star,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { Task, RecurringActivity, TaskStore, TimelineActivityEntry, TimelineEntryStore, RecurringActivityStore, TaskInterval, confirmAndDelete } from "@/lib/store";
import {
  toShamsiShort, toPersianDigits, getGregorianToday, addDays,
  getTodayJalali, gregorianToJalali, getSlotsForTimeRange,
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import JalaliCalendar from "@/components/shared/JalaliCalendar";
import type { DayMeta } from "@/components/shared/JalaliCalendar";

interface Props {
  tasks: Task[];
  activities: RecurringActivity[];
  onMove: (id: string, column: "todo" | "in_progress" | "done", extraData?: Partial<Task>) => void;
  onTasksChange: (tasks: Task[]) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f43f5e",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
};

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const tp = toPersianDigits;
  if (h > 0) return `${tp(h)}:${tp(pad(m))}:${tp(pad(s))}`;
  return `${tp(pad(m))}:${tp(pad(s))}`;
}

function formatDuration(secs: number): string {
  const roundedMins = Math.round(secs / 60);
  if (roundedMins >= 60) {
    const h = Math.floor(roundedMins / 60);
    const m = roundedMins % 60;
    if (m > 0) {
      return `${toPersianDigits(h)}h ${toPersianDigits(m)}m`;
    }
    return `${toPersianDigits(h)}h`;
  }
  return `${toPersianDigits(roundedMins)}m`;
}

const COLUMNS: {
  id: "todo" | "in_progress" | "done";
  label: string;
  topColor: string;
  icon: React.ElementType;
  iconColor: string;
  cardBorderColor: string;
  cardBgColor: string;
  badgeBg: string;
  badgeColor: string;
}[] = [
  {
    id: "todo", label: "در انتظار", topColor: "#94a3b8", icon: Clock,
    iconColor: "#94a3b8", cardBorderColor: "rgba(148,163,184,0.3)",
    cardBgColor: "rgba(148,163,184,0.05)", badgeBg: "rgba(148,163,184,0.15)", badgeColor: "#94a3b8",
  },
  {
    id: "in_progress", label: "در حال انجام", topColor: "#fbbf24", icon: Loader2,
    iconColor: "#fbbf24", cardBorderColor: "rgba(251,191,36,0.4)",
    cardBgColor: "rgba(251,191,36,0.06)", badgeBg: "rgba(251,191,36,0.15)", badgeColor: "#fbbf24",
  },
  {
    id: "done", label: "انجام‌شده", topColor: "#34d399", icon: CheckCircle2,
    iconColor: "#34d399", cardBorderColor: "rgba(52,211,153,0.35)",
    cardBgColor: "rgba(52,211,153,0.06)", badgeBg: "rgba(52,211,153,0.15)", badgeColor: "#34d399",
  },
];

const TIME_SLOTS = [
  { id: "00-03", label: "۱۲ شب – ۳ صبح", startH: 0, endH: 3 },
  { id: "03-06", label: "۳ صبح – ۶ صبح", startH: 3, endH: 6 },
  { id: "06-09", label: "۶ صبح – ۹ صبح", startH: 6, endH: 9 },
  { id: "09-12", label: "۹ صبح – ۱۲ ظهر", startH: 9, endH: 12 },
  { id: "12-15", label: "۱۲ ظهر – ۳ عصر", startH: 12, endH: 15 },
  { id: "15-18", label: "۳ عصر – ۶ عصر", startH: 15, endH: 18 },
  { id: "18-21", label: "۶ عصر – ۹ شب", startH: 18, endH: 21 },
  { id: "21-24", label: "۹ شب – ۱۲ شب", startH: 21, endH: 24 },
];

function getCurrentSlotId(): string {
  const h = new Date().getHours();
  for (const s of TIME_SLOTS) {
    if (h >= s.startH && h < s.endH) return s.id;
  }
  return "21-24";
}



// ─── Kanban Tab ────────────────────────────────────────────────────────────────
function KanbanTab({ tasks, activities, onMove }: { tasks: Task[]; activities: RecurringActivity[]; onMove: Props["onMove"] }) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const [displaySeconds, setDisplaySeconds] = useState<Record<string, number>>({});
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
    const newDisplay: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.status === "in_progress" && t.timer_started_at) {
        const base = t.elapsed_seconds || 0;
        const startedAt = t.timer_started_at;
        const tick = () => {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          setDisplaySeconds((prev) => ({ ...prev, [t.id]: base + elapsed }));
        };
        tick();
        intervalsRef.current[t.id] = setInterval(tick, 1000);
      } else {
        newDisplay[t.id] = t.elapsed_seconds || 0;
      }
    });
    setDisplaySeconds((prev) => ({ ...prev, ...newDisplay }));
    return () => { Object.values(intervalsRef.current).forEach(clearInterval); };
  }, [tasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const colId = result.destination.droppableId as "todo" | "in_progress" | "done";
    const taskId = result.draggableId;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const now = Date.now();
    let extraData: Partial<Task> = {};
    if (colId === "in_progress") {
      extraData = { timer_started_at: now };
    } else if (task.status === "in_progress") {
      const elapsed = task.timer_started_at ? Math.floor((now - task.timer_started_at) / 1000) : 0;
      extraData = {
        elapsed_seconds: (task.elapsed_seconds || 0) + elapsed,
        timer_started_at: colId === "done" ? task.timer_started_at : null,
        completed_at: colId === "done" ? now : null,
      };
    } else if (colId === "done") {
      extraData = { completed_at: now };
    }
    onMove(taskId, colId, extraData);
  };

  const today = getGregorianToday();
  const isCompletedToday = (completedAt: number | null | undefined, todayStr: string): boolean => {
    if (!completedAt) return false;
    const d = new Date(completedAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    const compStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return compStr === todayStr;
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => {
            const colMatch = (t.kanban_column || "todo") === col.id;
            if (!colMatch) return false;
            if (col.id === "done") {
              return isCompletedToday(t.completed_at, today);
            }
            return true;
          });
          const ColIcon = col.icon;
          return (
            <div key={col.id} className="flex flex-col rounded-2xl"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, borderTop: `4px solid ${col.topColor}` }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${col.topColor}20` }}>
                    <ColIcon className={`h-4 w-4 ${col.id === "in_progress" ? "animate-spin" : ""}`} style={{ color: col.iconColor }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: fg }}>{col.label}</span>
                </div>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: col.badgeBg, color: col.badgeColor }}>
                  {toPersianDigits(colTasks.length)}
                </span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    className="flex min-h-[220px] flex-1 flex-col gap-2 rounded-b-2xl p-3 transition-colors"
                    style={{ backgroundColor: snapshot.isDraggingOver ? `${col.topColor}0d` : "transparent" }}>
                    {colTasks.map((task, index) => {
                      const secs = displaySeconds[task.id] ?? (task.elapsed_seconds || 0);
                      const activity = activities.find((a) => a.id === task.activity_id);
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                              className="cursor-grab rounded-xl active:cursor-grabbing overflow-hidden"
                              style={{
                                border: `1px solid ${snapshot.isDragging ? col.topColor : col.cardBorderColor}`,
                                backgroundColor: snapshot.isDragging ? bg : col.cardBgColor,
                                boxShadow: snapshot.isDragging ? `0 12px 32px rgba(0,0,0,0.35), 0 0 0 2px ${col.topColor}55` : "none",
                                ...provided.draggableProps.style,
                              }}>
                              <div className="h-0.5 w-full" style={{ backgroundColor: activity ? activity.color : col.topColor }} />
                              <div className="p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: col.badgeBg, color: col.badgeColor }}>
                                    <ColIcon className={`h-3 w-3 ${col.id === "in_progress" ? "animate-spin" : ""}`} />
                                    {col.label}
                                  </span>
                                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
                                    {PRIORITY_LABELS[task.priority]}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: activity ? activity.color : PRIORITY_COLORS[task.priority] }} />
                                  <p className="flex-1 text-sm font-medium leading-snug" style={{ color: col.id === "done" ? fgMuted : fg, textDecoration: col.id === "done" ? "line-through" : "none", opacity: col.id === "done" ? 0.65 : 1 }}>
                                    {task.title}
                                  </p>
                                </div>
                                {activity && (
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activity.color }} />
                                    <span className="text-[10px] font-medium" style={{ color: activity.color }}>{activity.name}</span>
                                  </div>
                                )}
                                {task.tags && task.tags.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {task.tags.map((t) => (
                                      <span key={t} className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}>#{t}</span>
                                    ))}
                                  </div>
                                )}
                                {secs > 0 && (
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                                      style={{ backgroundColor: col.id === "in_progress" ? "rgba(251,191,36,0.15)" : "rgba(128,128,128,0.1)", color: col.id === "in_progress" ? "#fbbf24" : fgMuted }}>
                                      ⏱ {col.id === "done" ? formatDuration(secs) : formatTimer(secs)}
                                    </span>
                                  </div>
                                )}
                                {task.scheduled_date && (
                                  <p className="mt-2 text-right text-[11px]" style={{ color: fgMuted }}>
                                    📅 {toShamsiShort(task.scheduled_date)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-xs" style={{ color: `${fgMuted}55` }}>
                        <ColIcon className="h-6 w-6 opacity-30" style={{ color: col.topColor }} />
                        <span>بکش اینجا</span>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ─── Add Entry Modal ────────────────────────────────────────────────────────────
interface AddEntryModalProps {
  activities: RecurringActivity[];
  date: string;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onClose: () => void;
  onAdd: (entry: TimelineActivityEntry) => void;
  initialTab?: "task" | "activity";
  initialTaskId?: string;
  initialActivityId?: string;
}

function AddActivityEntryModal({
  activities,
  date,
  tasks,
  onTasksChange,
  onClose,
  onAdd,
  initialTab = "task",
  initialTaskId = "",
  initialActivityId = "",
}: AddEntryModalProps) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  
  // Tab can be: "task" (تسک‌های کانبان) or "activity" (تسک‌های همیشگی / اکتیویتی)
  const [activeTab, setActiveTab] = useState<"task" | "activity">(initialTab);

  // --- Task Tab State ---
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialTaskId);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskActivityId, setNewTaskActivityId] = useState("");
  const [taskStatusAtEnd, setTaskStatusAtEnd] = useState<"done" | "in_progress" | "todo">("done");

  // --- Activity Tab State ---
  const [selectedActivityId, setSelectedActivityId] = useState(
    initialActivityId || (activities[0]?.id ?? "")
  );

  // --- Common States ---
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const slotsCovered = getSlotsForTimeRange(fromTime, toTime);

  // Filter tasks that are available for selection.
  // Include non-done tasks OR tasks scheduled for this day
  const availableTasks = tasks.filter(
    (t) => t.status !== "done" || t.scheduled_date === date
  );

  // Initialize selectedTaskId to the first available task if present
  useEffect(() => {
    if (activeTab === "task") {
      if (initialTaskId) {
        setSelectedTaskId(initialTaskId);
      } else if (availableTasks.length > 0) {
        setSelectedTaskId(availableTasks[0].id);
      } else {
        setSelectedTaskId("new");
      }
    }
  }, [activeTab, initialTaskId]);

  // Sync selected task's tags
  useEffect(() => {
    if (activeTab === "task" && selectedTaskId && selectedTaskId !== "new") {
      const target = tasks.find((t) => t.id === selectedTaskId);
      if (target) {
        setSelectedTags(target.tags ?? []);
      } else {
        setSelectedTags([]);
      }
    } else if (activeTab === "task" && selectedTaskId === "new") {
      setSelectedTags([]);
    }
  }, [selectedTaskId, activeTab]);

  // Sync activity tags for "activity" tab
  useEffect(() => {
    if (activeTab === "activity") {
      setSelectedTags([]);
    }
  }, [selectedActivityId, activeTab]);

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleAddCustomTag = (raw?: string) => {
    const cleaned = (raw ?? tagInput).replace(/^#+/, "").trim();
    if (!cleaned) return;
    if (!selectedTags.includes(cleaned)) {
      setSelectedTags((prev) => [...prev, cleaned]);
    }
    
    // Add to activity tags if we are on activity tab or creating a new task with activity
    const activeActId = activeTab === "activity" 
      ? selectedActivityId 
      : (selectedTaskId === "new" ? newTaskActivityId : "");
      
    if (activeActId) {
      RecurringActivityStore.addTag(activeActId, cleaned);
      window.dispatchEvent(new CustomEvent("activities-updated"));
    }
    setTagInput("");
  };

  const handleRemoveCustomTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    if (!fromTime || !toTime) return;
    if (fromTime >= toTime) return;

    const [fh, fm] = fromTime.split(":").map(Number);
    const [th, tm] = toTime.split(":").map(Number);
    
    const durationSeconds = (th * 60 + tm - (fh * 60 + fm)) * 60;

    const startedAt = new Date(`${date}T${fromTime.padStart(5, "0")}:00`).getTime();
    const endedAt = new Date(`${date}T${toTime.padStart(5, "0")}:00`).getTime();

    const newInterval: TaskInterval = {
      id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
      started_at: startedAt,
      ended_at: endedAt,
      elapsed_seconds: durationSeconds,
      status_at_end: taskStatusAtEnd,
    };

    if (activeTab === "task") {
      if (selectedTaskId === "new") {
        if (!newTaskTitle.trim()) return;
        TaskStore.create({
          title: newTaskTitle.trim(),
          priority: "medium",
          scheduled_date: date,
          status: taskStatusAtEnd,
          kanban_column: taskStatusAtEnd,
          elapsed_seconds: durationSeconds,
          tags: selectedTags,
          comment: note.trim() || undefined,
          activity_id: newTaskActivityId || null,
          intervals: [newInterval],
          description: "",
          timer_started_at: null,
          timeline_slot: null,
          timeline_date: null,
        });
        onTasksChange(TaskStore.list());
      } else {
        const updatedTasks = tasks.map((t) => {
          if (t.id === selectedTaskId) {
            const mergedTags = Array.from(new Set([...(t.tags ?? []), ...selectedTags]));
            const updated = TaskStore.update(t.id, {
              status: taskStatusAtEnd,
              kanban_column: taskStatusAtEnd,
              elapsed_seconds: (t.elapsed_seconds || 0) + durationSeconds,
              intervals: [...(t.intervals ?? []), newInterval],
              tags: mergedTags,
              comment: note.trim() || t.comment,
            });
            return updated || t;
          }
          return t;
        });
        onTasksChange(updatedTasks);
      }
    } else {
      const entry = TimelineEntryStore.create({
        activity_id: selectedActivityId,
        date,
        from_time: fromTime,
        to_time: toTime,
        note: note.trim() || undefined,
        slot_ids: slotsCovered,
        duration_seconds: durationSeconds,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
      onAdd(entry);
    }

    onClose();
  };

  const selectedActivity = activeTab === "activity"
    ? activities.find((a) => a.id === selectedActivityId)
    : (selectedTaskId === "new" ? activities.find((a) => a.id === newTaskActivityId) : activities.find((a) => a.id === tasks.find(t => t.id === selectedTaskId)?.activity_id));

  const activitySavedTags = selectedActivity?.tags ?? [];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} dir="rtl">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
      <motion.div ref={modalRef} className="relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-2xl overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }}
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}>
        
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: fg }}>ثبت دستی زمان فعالیت</span>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mb-4 flex gap-1 rounded-xl p-1 text-xs" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
          <button type="button" onClick={() => setActiveTab("task")}
            className="flex-1 rounded-lg py-2 transition-all font-medium"
            style={{
              backgroundColor: activeTab === "task" ? "#6366f1" : "transparent",
              color: activeTab === "task" ? "#fff" : fgMuted,
            }}>
            تسک‌های کانبان
          </button>
          <button type="button" onClick={() => setActiveTab("activity")}
            className="flex-1 rounded-lg py-2 transition-all font-medium"
            style={{
              backgroundColor: activeTab === "activity" ? "#6366f1" : "transparent",
              color: activeTab === "activity" ? "#fff" : fgMuted,
            }}>
            تسک‌های همیشگی
          </button>
        </div>

        {/* --- TASK TAB CONTENT --- */}
        {activeTab === "task" && (
          <div className="mb-3 space-y-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: fgMuted }}>انتخاب تسک:</label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
              >
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.scheduled_date ? `(${toShamsiShort(t.scheduled_date)})` : ""}
                  </option>
                ))}
                <option value="new">+ ایجاد و ثبت تسک جدید</option>
              </select>
            </div>

            {selectedTaskId === "new" && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium" style={{ color: fgMuted }}>عنوان تسک جدید:</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="عنوان تسک را وارد کنید..."
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" style={{ color: fgMuted }}>مرتبط با فعالیت همیشگی (اختیاری):</label>
                  <select
                    value={newTaskActivityId}
                    onChange={(e) => setNewTaskActivityId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                  >
                    <option value="">هیچ کدام</option>
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}

            {/* Task status at end selector */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-medium" style={{ color: fgMuted }}>وضعیت تسک پس از ثبت این فعالیت:</label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                <button type="button" onClick={() => setTaskStatusAtEnd("done")}
                  className="rounded-lg py-1.5 text-[10px] font-semibold transition-all"
                  style={{
                    backgroundColor: taskStatusAtEnd === "done" ? "#10b981" : "transparent",
                    color: taskStatusAtEnd === "done" ? "#fff" : fgMuted,
                  }}>
                  انجام شده
                </button>
                <button type="button" onClick={() => setTaskStatusAtEnd("in_progress")}
                  className="rounded-lg py-1.5 text-[10px] font-semibold transition-all"
                  style={{
                    backgroundColor: taskStatusAtEnd === "in_progress" ? "#f59e0b" : "transparent",
                    color: taskStatusAtEnd === "in_progress" ? "#fff" : fgMuted,
                  }}>
                  در حال انجام
                </button>
                <button type="button" onClick={() => setTaskStatusAtEnd("todo")}
                  className="rounded-lg py-1.5 text-[10px] font-semibold transition-all"
                  style={{
                    backgroundColor: taskStatusAtEnd === "todo" ? "#94a3b8" : "transparent",
                    color: taskStatusAtEnd === "todo" ? "#fff" : fgMuted,
                  }}>
                  در انتظار
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ACTIVITY TAB CONTENT --- */}
        {activeTab === "activity" && (
          <div className="mb-3 space-y-1.5">
            <label className="text-xs font-medium" style={{ color: fgMuted }}>تسک همیشگی:</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {activities.map((a) => (
                <button key={a.id} type="button"
                  onClick={() => setSelectedActivityId(a.id)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all"
                  style={{
                    border: `1px solid ${selectedActivityId === a.id ? a.color : cardBorder}`,
                    backgroundColor: selectedActivityId === a.id ? `${a.color}20` : "transparent",
                    color: selectedActivityId === a.id ? a.color : fg,
                  }}>
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="truncate text-xs font-medium">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- COMMON FIELDS: TAGS, TIMES, NOTE, BTNS --- */}
        {selectedActivity && (
          <div className="mb-3 space-y-1.5">
            <label className="text-xs font-medium" style={{ color: fgMuted }}>هشتگ‌های این فعالیت:</label>
            
            {activitySavedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {activitySavedTags.map((t) => {
                  const isSelected = selectedTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleToggleTag(t)}
                      className="rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all"
                      style={{
                        backgroundColor: isSelected ? `${selectedActivity.color}25` : "transparent",
                        color: isSelected ? selectedActivity.color : fgMuted,
                        border: `1px solid ${isSelected ? selectedActivity.color : cardBorder}`,
                      }}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-1.5"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              {selectedTags.filter(t => !activitySavedTags.includes(t)).map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${selectedActivity.color}20`, color: selectedActivity.color }}>
                  #{t}
                  <button type="button" onClick={() => handleRemoveCustomTag(t)} className="hover:opacity-70">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => {
                  const val = e.target.value;
                  const parts = val.split(/[ ,，،\n\r\t\u00a0]+/);
                  if (parts.length > 1) {
                    const tagsToAdd = parts.slice(0, -1);
                    const remaining = parts[parts.length - 1];
                    
                    tagsToAdd.forEach((tag) => {
                      if (tag.trim()) {
                        handleAddCustomTag(tag.trim());
                      }
                    });
                    setTagInput(remaining);
                  } else {
                    setTagInput(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddCustomTag(); }
                }}
                placeholder="هشتگ جدید (Enter)..."
                className="min-w-[100px] flex-1 bg-transparent text-xs outline-none"
                style={{ color: fg }}
              />
            </div>
          </div>
        )}

        {/* Time Inputs */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: fgMuted }}>از ساعت:</label>
            <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: fgMuted }}>تا ساعت:</label>
            <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
          </div>
        </div>

        {slotsCovered.length > 0 && (
          <div className="mb-3 rounded-xl p-2.5" style={{ backgroundColor: selectedActivity ? `${selectedActivity.color}10` : "rgba(99,102,241,0.08)", border: `1px solid ${selectedActivity ? `${selectedActivity.color}30` : "rgba(99,102,241,0.2)"}` }}>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: selectedActivity ? selectedActivity.color : "#818cf8" }}>
              در {toPersianDigits(slotsCovered.length)} بازه زمانی ثبت می‌شود:
            </p>
            <div className="flex flex-wrap gap-1">
              {slotsCovered.map((slotId) => {
                const slot = TIME_SLOTS.find((s) => s.id === slotId);
                return slot ? (
                  <span key={slotId} className="rounded-lg px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: selectedActivity ? `${selectedActivity.color}20` : "rgba(99,102,241,0.15)", color: selectedActivity ? selectedActivity.color : "#818cf8" }}>
                    {slot.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {fromTime >= toTime && fromTime && toTime && (
          <p className="mb-3 text-xs text-rose-400">ساعت پایان باید بعد از ساعت شروع باشد</p>
        )}

        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="یادداشت (اختیاری)..."
          className="mb-4 w-full rounded-xl px-3 py-2 text-xs outline-none"
          style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />

        {/* Buttons */}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>لغو</button>
          <button onClick={handleSubmit}
            disabled={
              !fromTime || 
              !toTime || 
              fromTime >= toTime || 
              slotsCovered.length === 0 ||
              (activeTab === "task" && selectedTaskId === "new" && !newTaskTitle.trim()) ||
              (activeTab === "task" && !selectedTaskId) ||
              (activeTab === "activity" && !selectedActivityId)
            }
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
            ثبت
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Timeline Tab ───────────────────────────────────────────────────────────────
function TimelineTab({ tasks, activities, onTasksChange }: {
  tasks: Task[];
  activities: RecurringActivity[];
  onTasksChange: (tasks: Task[]) => void;
}) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const todayGreg = getGregorianToday();
  const [timelineDate, setTimelineDate] = useState(todayGreg);
  const [timelineEntries, setTimelineEntries] = useState<TimelineActivityEntry[]>(() =>
    TimelineEntryStore.listByDate(todayGreg)
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectTab, setPreselectTab] = useState<"task" | "activity">("task");
  const [preselectTaskId, setPreselectTaskId] = useState<string>("");
  const [preselectActivityId, setPreselectActivityId] = useState<string>("");
  const [showRecurringSec, setShowRecurringSec] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const todayJalali = getTodayJalali();
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const dpRef = useRef<HTMLDivElement>(null);
  const currentSlotId = getCurrentSlotId();
  const [displaySeconds, setDisplaySeconds] = useState<Record<string, number>>({});
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
    const newDisplay: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.status === "in_progress" && t.timer_started_at) {
        const base = t.elapsed_seconds || 0;
        const startedAt = t.timer_started_at;
        const tick = () => {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          setDisplaySeconds((prev) => ({ ...prev, [t.id]: base + elapsed }));
        };
        tick();
        intervalsRef.current[t.id] = setInterval(tick, 1000);
      } else {
        newDisplay[t.id] = t.elapsed_seconds || 0;
      }
    });
    setDisplaySeconds((prev) => ({ ...prev, ...newDisplay }));
    return () => { Object.values(intervalsRef.current).forEach(clearInterval); };
  }, [tasks]);

  useEffect(() => {
    setTimelineEntries(TimelineEntryStore.listByDate(timelineDate));
  }, [timelineDate]);

  useEffect(() => {
    if (!showDatePicker) return;
    const h = (e: MouseEvent) => {
      if (dpRef.current && !dpRef.current.contains(e.target as Node)) setShowDatePicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showDatePicker]);

  const deleteTimelineEntry = (id: string) => {
    confirmAndDelete("حذف فعالیت زمان‌بندی‌شده", () => {
      TimelineEntryStore.delete(id);
      setTimelineEntries((prev) => prev.filter((e) => e.id !== id));
    });
  };

  const handleEntryAdded = (entry: TimelineActivityEntry) => {
    setTimelineEntries((prev) => [...prev, entry]);
  };

  // Helpers
  const getFormattedDate = (timestamp: number): string => {
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getSlotIdFromTimestamp = (timestamp: number): string => {
    const h = new Date(timestamp).getHours();
    for (const s of TIME_SLOTS) {
      if (h >= s.startH && h < s.endH) return s.id;
    }
    return "21-24";
  };

  const formatTimeHM24 = (timestamp: number): string => {
    const d = new Date(timestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatTimeHMDisplay = (timestamp: number): string => {
    const d = new Date(timestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${toPersianDigits(h)}:${toPersianDigits(m)}`;
  };

  interface TimelineTaskSession {
    id: string;
    taskId: string;
    task: Task;
    started_at: number;
    ended_at: number;
    elapsed_seconds: number;
    status_at_end: "todo" | "done" | "in_progress";
    parent_interval_id?: string;
  }

  // Split intervals that cross slot boundaries so each fits in its correct slot
  const splitIntervalBySlots = (startedAt: number, endedAt: number): { started_at: number; ended_at: number; elapsed_seconds: number }[] => {
    const [tYear, tMonth, tDay] = timelineDate.split("-").map(Number);
    const year = tYear;
    const month = tMonth - 1; // JS Date Month is 0-indexed
    const dayDate = tDay;
    
    const subIntervals: { started_at: number; ended_at: number; elapsed_seconds: number }[] = [];
    
    for (const slot of TIME_SLOTS) {
      const slotStartMs = new Date(year, month, dayDate, slot.startH, 0, 0, 0).getTime();
      const slotEndMs = slot.endH === 24
        ? new Date(year, month, dayDate + 1, 0, 0, 0, 0).getTime()
        : new Date(year, month, dayDate, slot.endH, 0, 0, 0).getTime();
        
      const overlapStart = Math.max(startedAt, slotStartMs);
      const overlapEnd = Math.min(endedAt, slotEndMs);
      
      if (overlapEnd > overlapStart) {
        const elapsedSecs = Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
        if (elapsedSecs > 0) {
          subIntervals.push({
            started_at: overlapStart,
            ended_at: overlapEnd,
            elapsed_seconds: elapsedSecs,
          });
        }
      }
    }
    return subIntervals;
  };

  // Gather all task intervals for timelineDate
  const timelineIntervals = (() => {
    const list: TimelineTaskSession[] = [];
    const [tYear, tMonth, tDay] = timelineDate.split("-").map(Number);
    const dayStartMs = new Date(tYear, tMonth - 1, tDay, 0, 0, 0, 0).getTime();
    const dayEndMs = new Date(tYear, tMonth - 1, tDay + 1, 0, 0, 0, 0).getTime();

    tasks.forEach((t) => {
      // 1. Completed intervals
      if (t.intervals && t.intervals.length > 0) {
        t.intervals.forEach((interval) => {
          if (interval.started_at < dayEndMs && interval.ended_at > dayStartMs) {
            const subs = splitIntervalBySlots(interval.started_at, interval.ended_at);
            subs.forEach((sub, idx) => {
              list.push({
                id: `${interval.id}-sub-${idx}`,
                taskId: t.id,
                task: t,
                started_at: sub.started_at,
                ended_at: sub.ended_at,
                elapsed_seconds: sub.elapsed_seconds,
                status_at_end: interval.status_at_end,
                parent_interval_id: interval.id,
              });
            });
          }
        });
      }

      // 2. Active interval if currently running on this day
      if (t.status === "in_progress" && t.timer_started_at) {
        const totalSecs = displaySeconds[t.id] ?? (t.elapsed_seconds || 0);
        const activeSecs = Math.max(0, totalSecs - (t.elapsed_seconds || 0));
        const startedAt = t.timer_started_at;
        const endedAt = startedAt + (activeSecs * 1000);
        if (startedAt < dayEndMs && endedAt > dayStartMs) {
          const subs = splitIntervalBySlots(startedAt, endedAt);
          subs.forEach((sub, idx) => {
            list.push({
              id: `active-${t.id}-sub-${idx}`,
              taskId: t.id,
              task: t,
              started_at: sub.started_at,
              ended_at: sub.ended_at,
              elapsed_seconds: sub.elapsed_seconds,
              status_at_end: "in_progress",
            });
          });
        }
      }

      // 3. Fallback: If task is done and has NO intervals, use completion or scheduled date
      if (t.status === "done" && (!t.intervals || t.intervals.length === 0)) {
        let isDoneForDate = false;
        let startedTime = 0;
        let endedTime = 0;
        if (t.timer_started_at) {
          isDoneForDate = getFormattedDate(t.timer_started_at) === timelineDate;
          startedTime = t.timer_started_at;
          endedTime = t.completed_at || (t.timer_started_at + (t.elapsed_seconds * 1000));
        } else if (t.completed_at) {
          isDoneForDate = getFormattedDate(t.completed_at) === timelineDate;
          startedTime = t.completed_at - (t.elapsed_seconds * 1000);
          endedTime = t.completed_at;
        } else if (t.scheduled_date) {
          isDoneForDate = t.scheduled_date === timelineDate;
          startedTime = new Date(timelineDate + "T09:00:00").getTime();
          endedTime = startedTime + (t.elapsed_seconds * 1000 || 3600000);
        }
        if (isDoneForDate) {
          const subs = splitIntervalBySlots(startedTime, endedTime);
          subs.forEach((sub, idx) => {
            list.push({
              id: `done-fallback-${t.id}-sub-${idx}`,
              taskId: t.id,
              task: t,
              started_at: sub.started_at,
              ended_at: sub.ended_at,
              elapsed_seconds: sub.elapsed_seconds,
              status_at_end: "done",
            });
          });
        }
      }
    });

    return list;
  })();

  const removeTaskFromSlot = (taskId: string) => {
    confirmAndDelete("حذف دائمی تسک", () => {
      TaskStore.delete(taskId);
      onTasksChange(tasks.filter((t) => t.id !== taskId));
    });
  };

  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedTasksForDate = tasks.filter((t) => {
    if (timelineDate === todayGreg) {
      return !t.scheduled_date || t.scheduled_date === timelineDate;
    }
    return t.scheduled_date === timelineDate;
  }).sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));

  return (
    <div className="space-y-4" dir="rtl">
      {/* Date navigation */}
      <div className="relative flex items-center gap-3 rounded-2xl p-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <button onClick={() => setTimelineDate(addDays(timelineDate, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>◀</button>
        <button onClick={() => setShowDatePicker((s) => !s)}
          className="flex-1 text-center text-sm font-semibold"
          style={{ color: fg }}>
          📅 {toShamsiShort(timelineDate)}
          {timelineDate === todayGreg && <span className="mr-2 text-xs" style={{ color: "#818cf8" }}>(امروز)</span>}
        </button>
        <button onClick={() => setTimelineDate(addDays(timelineDate, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>▶</button>
        {showDatePicker && (
          <div ref={dpRef} className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-2xl p-4 shadow-2xl"
            style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }} dir="rtl">
            <JalaliCalendar jy={calJy} jm={calJm}
              onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
              onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
              canNext={true} todayGreg={todayGreg} selectedGreg={timelineDate}
              onDayClick={(_, meta) => {
                setTimelineDate(meta.gregDate);
                setShowDatePicker(false);
                const jd = gregorianToJalali(...meta.gregDate.split("-").map(Number) as [number, number, number]);
                setCalJy(jd[0]); setCalJm(jd[1]);
              }}
              renderDay={(day, meta) => {
                const bg2 = meta.isSelected ? "#6366f1" : meta.isToday ? "rgba(99,102,241,0.15)" : "transparent";
                const col = meta.isSelected ? "#fff" : meta.isToday ? "#818cf8" : `${fgMuted}cc`;
                return <span className="flex h-full w-full items-center justify-center rounded-lg" style={{ backgroundColor: bg2, color: col }}>{toPersianDigits(day)}</span>;
              }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Right side: Time slots (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "#818cf8" }} />
              <span className="text-sm font-semibold" style={{ color: fg }}>
                خلاصه روز – {toShamsiShort(timelineDate)}
              </span>
            </div>
            {activities.length > 0 && (
              <button onClick={() => {
                setPreselectTab("activity");
                setPreselectTaskId("");
                setPreselectActivityId("");
                setShowAddModal(true);
              }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600">
                <Plus className="h-3.5 w-3.5" />
                ثبت فعالیت
              </button>
            )}
          </div>

          {/* Time slots */}
          <div className="space-y-3">
            {TIME_SLOTS.map((slot) => {
              const isCurrentSlot = slot.id === currentSlotId && timelineDate === todayGreg;
              const slotActivityEntries = timelineEntries
                .filter((e) => e.slot_ids.includes(slot.id));

              // Task intervals belonging to this slot
              const slotTaskSessions = timelineIntervals.filter((session) => {
                return getSlotIdFromTimestamp(session.started_at) === slot.id;
              });

              type UnifiedTimelineItem =
                | { type: "activity"; id: string; time: string; data: TimelineActivityEntry }
                | { type: "task_session"; id: string; time: string; data: TimelineTaskSession };

              const unifiedItems: UnifiedTimelineItem[] = [];

              slotActivityEntries.forEach((entry) => {
                unifiedItems.push({
                  type: "activity",
                  id: entry.id,
                  time: entry.from_time,
                  data: entry,
                });
              });

              slotTaskSessions.forEach((session) => {
                unifiedItems.push({
                  type: "task_session",
                  id: session.id,
                  time: formatTimeHM24(session.started_at),
                  data: session,
                });
              });

              // Sort chronologically
              unifiedItems.sort((a, b) => a.time.localeCompare(b.time));

              const hasContent = unifiedItems.length > 0;

              return (
                <div key={slot.id} className="rounded-2xl overflow-hidden"
                  style={{
                    border: `1px solid ${isCurrentSlot ? "rgba(99,102,241,0.5)" : hasContent ? cardBorder : `${cardBorder}80`}`,
                    backgroundColor: isCurrentSlot ? "rgba(99,102,241,0.04)" : hasContent ? cardBg : `${cardBg}80`,
                  }}>
                  {/* Slot header */}
                  <div className="flex items-center gap-2 px-4 py-2.5"
                    style={{ borderBottom: `1px solid ${isCurrentSlot ? "rgba(99,102,241,0.25)" : hasContent ? cardBorder : "transparent"}` }}>
                    {isCurrentSlot && <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />}
                    <span className="text-sm font-semibold" style={{ color: isCurrentSlot ? "#818cf8" : hasContent ? fg : fgMuted, opacity: hasContent ? 1 : 0.5 }}>
                      {slot.label}
                    </span>
                    {hasContent && (
                      <span className="text-xs rounded-full px-1.5 py-0.5 ml-auto"
                        style={{ backgroundColor: isCurrentSlot ? "rgba(99,102,241,0.15)" : "rgba(128,128,128,0.1)", color: isCurrentSlot ? "#818cf8" : fgMuted }}>
                        {toPersianDigits(unifiedItems.length)}
                      </span>
                    )}
                  </div>

                  {/* Slot content */}
                  {hasContent && (
                    <div className="p-3 space-y-2">
                      {unifiedItems.map((item) => {
                        if (item.type === "activity") {
                          const entry = item.data;
                          const act = activities.find((a) => a.id === entry.activity_id);
                          if (!act) return null;
                          return (
                            <div key={entry.id}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 group"
                              style={{ border: `1px solid ${act.color}40`, backgroundColor: `${act.color}10` }}>
                              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: act.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold" style={{ color: act.color }}>{act.name}</span>
                                  <span className="text-[13px] md:text-[14px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: `${act.color}20`, color: act.color }}>
                                    {entry.from_time} – {entry.to_time}
                                  </span>
                                  {entry.duration_seconds && entry.duration_seconds > 0 && (
                                    <span className="flex items-center gap-0.5 text-[13px] md:text-[14px] font-black font-mono" style={{ color: act.color }}>
                                      <Timer className="h-3.5 w-3.5" />
                                      {formatDuration(entry.duration_seconds)}
                                    </span>
                                  )}
                                  {entry.note && <span className="text-xs" style={{ color: fgMuted }}>· {entry.note}</span>}
                                  {entry.tags && entry.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {entry.tags.map((t) => (
                                        <span key={t} className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                          style={{ backgroundColor: `${act.color}20`, color: act.color }}>
                                          #{t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => deleteTimelineEntry(entry.id)}
                                className="opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-lg"
                                style={{ color: fgMuted }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(244,63,94,0.12)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        } else {
                          const session = item.data;
                          const task = session.task;
                          const activity = activities.find((a) => a.id === task.activity_id);
                          const statusAtEnd = session.status_at_end;
                          
                          let borderColor = "rgba(148,163,184,0.35)";
                          let bgColor = "rgba(148,163,184,0.06)";
                          let iconColor = "#94a3b8";
                          let textColor = fg;
                          let textDecoration = "none";
                          let opacity = 1;
                          
                          if (statusAtEnd === "in_progress") {
                            borderColor = "rgba(251,191,36,0.45)";
                            bgColor = "rgba(251,191,36,0.07)";
                            iconColor = "#fbbf24";
                          } else if (statusAtEnd === "done") {
                            borderColor = "rgba(52,211,153,0.4)";
                            bgColor = "rgba(52,211,153,0.07)";
                            iconColor = "#34d399";
                            textColor = fgMuted;
                            textDecoration = "line-through";
                            opacity = 0.65;
                          }

                          const IconToUse = statusAtEnd === "in_progress" ? Loader2 : statusAtEnd === "done" ? CheckCircle2 : Clock;
                          const durationStr = formatDuration(session.elapsed_seconds);

                          return (
                            <div key={session.id}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 group"
                              style={{
                                border: `1px solid ${activity ? `${activity.color}40` : borderColor}`,
                                backgroundColor: activity ? `${activity.color}08` : bgColor,
                              }}>
                              <div className="flex h-5 w-5 items-center justify-center">
                                <IconToUse className={`h-3.5 w-3.5 ${statusAtEnd === "in_progress" ? "animate-spin" : ""}`} style={{ color: activity ? activity.color : iconColor }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {activity && (
                                    <span className="text-[10px] font-semibold" style={{ color: activity.color }}>[{activity.name}]</span>
                                  )}
                                  <span className="text-xs font-medium truncate" style={{ color: textColor, textDecoration, opacity }}>{task.title}</span>
                                  {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.map((t) => (
                                        <span key={t} className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                          style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                                          #{t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded opacity-80 animate-fade-in"
                                  style={{
                                    backgroundColor: statusAtEnd === "in_progress" ? "rgba(251,191,36,0.15)" : statusAtEnd === "done" ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.15)",
                                    color: activity ? activity.color : iconColor
                                  }}>
                                  {formatTimeHMDisplay(session.started_at)} – {formatTimeHMDisplay(session.ended_at)}
                                </span>
                                {session.elapsed_seconds > 0 && (
                                  <span className="text-[11px] font-black font-mono px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: statusAtEnd === "in_progress" ? "rgba(251,191,36,0.25)" : statusAtEnd === "done" ? "rgba(52,211,153,0.18)" : "rgba(148,163,184,0.2)",
                                      color: activity ? activity.color : iconColor
                                    }}>
                                    <Timer className="inline h-3 w-3 mr-0.5" />
                                    {durationStr}
                                  </span>
                                )}
                              </div>
                              {statusAtEnd !== "in_progress" && (
                                <button onClick={() => {
                                  if (session.id.startsWith("done-fallback-")) {
                                    removeTaskFromSlot(session.taskId);
                                  } else {
                                    confirmAndDelete("حذف بازه زمانی تسک", () => {
                                      const targetTask = tasks.find((t) => t.id === session.taskId);
                                      if (targetTask) {
                                        const parentId = session.parent_interval_id || session.id;
                                        const updatedIntervals = (targetTask.intervals || []).filter((inv) => inv.id !== parentId);
                                        const originalInterval = (targetTask.intervals || []).find((inv) => inv.id === parentId);
                                        const subElapsed = originalInterval ? originalInterval.elapsed_seconds : session.elapsed_seconds;
                                        const newElapsed = Math.max(0, (targetTask.elapsed_seconds || 0) - subElapsed);
                                        const updatedTask = TaskStore.update(session.taskId, { 
                                          intervals: updatedIntervals,
                                          elapsed_seconds: newElapsed
                                        });
                                        if (updatedTask) {
                                          onTasksChange(tasks.map((t) => t.id === session.taskId ? updatedTask : t));
                                        }
                                      }
                                    });
                                  }
                                }}
                                  className="opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-lg"
                                  style={{ color: fgMuted }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(244,63,94,0.12)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}

                  {!hasContent && (
                    <div className="px-4 pb-2 text-xs" style={{ color: `${fgMuted}44` }}>
                      {isCurrentSlot ? "فعالیتی در حال انجام..." : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Left side: Tasks and Activities section (1/3 width) */}
        <div className="space-y-4">
          {/* Daily Tasks Panel */}
          <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: fg }}>تسک‌های روز ({toPersianDigits(sortedTasksForDate.length)})</span>
            </div>
            
            {sortedTasksForDate.length === 0 ? (
              <div className="text-xs p-5 text-center rounded-xl" style={{ border: `1.5px dashed ${cardBorder}`, color: fgMuted }}>
                تسکی برای این روز برنامه‌ریزی نشده است
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {sortedTasksForDate.map((task) => {
                  const act = activities.find((a) => a.id === task.activity_id);
                  const isDone = task.status === "done";
                  
                  return (
                    <div key={task.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ border: `1px solid ${act ? `${act.color}25` : cardBorder}`, backgroundColor: act ? `${act.color}05` : "transparent" }}>
                      
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Plus button to record time manually */}
                        <button
                          onClick={() => {
                            setPreselectTab("task");
                            setPreselectTaskId(task.id);
                            setPreselectActivityId("");
                            setShowAddModal(true);
                          }}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white transition-all"
                          title="ثبت دستی زمان"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs font-semibold leading-snug truncate block ${isDone ? 'line-through opacity-65' : ''}`} style={{ color: fg }}>
                            {task.title}
                          </span>
                          
                          {/* Tags */}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {task.tags.map((t) => (
                                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" 
                          style={{ 
                            backgroundColor: task.status === "done" ? "rgba(52,211,153,0.12)" : task.status === "in_progress" ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.15)",
                            color: task.status === "done" ? "#34d399" : task.status === "in_progress" ? "#fbbf24" : fgMuted
                          }}>
                          {task.status === "done" ? "انجام شده" : task.status === "in_progress" ? "در حال انجام" : "در انتظار"}
                        </span>
                        
                        {task.elapsed_seconds > 0 && (
                          <span className="text-[9px] font-mono font-bold opacity-80" style={{ color: fgMuted }}>
                            ⏱ {formatDuration(task.elapsed_seconds)}
                          </span>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Always/Recurring Tasks Panel */}
          <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <button 
              onClick={() => setShowRecurringSec(!showRecurringSec)}
              className="flex w-full items-center justify-between text-sm font-semibold transition-colors"
              style={{ color: fg }}
            >
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4" style={{ color: "#fbbf24" }} />
                <span>تسک‌های همیشگی ({toPersianDigits(activities.length)})</span>
              </div>
              {showRecurringSec ? <ChevronUp className="h-4 w-4" style={{ color: fgMuted }} /> : <ChevronDown className="h-4 w-4" style={{ color: fgMuted }} />}
            </button>

            {showRecurringSec && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2 max-h-[320px] overflow-y-auto pr-1 pt-1"
              >
                {activities.length === 0 ? (
                  <div className="text-xs p-5 text-center rounded-xl" style={{ border: `1.5px dashed ${cardBorder}`, color: fgMuted }}>
                    هیچ فعالیت همیشگی تعریف نشده است
                  </div>
                ) : (
                  activities.map((act) => {
                    return (
                      <div key={act.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ border: `1px solid ${act.color}25`, backgroundColor: `${act.color}05` }}>
                        
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Plus button to record time manually */}
                          <button
                            onClick={() => {
                              setPreselectTab("activity");
                              setPreselectActivityId(act.id);
                              setPreselectTaskId("");
                              setShowAddModal(true);
                            }}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white transition-all"
                            title="ثبت دستی زمان"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold leading-snug truncate block" style={{ color: fg }}>
                              {act.name}
                            </span>
                            {/* Tags */}
                            {act.tags && act.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {act.tags.map((t) => (
                                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${act.color}15`, color: act.color }}>
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && activities.length > 0 && (
          <AddActivityEntryModal
            activities={activities}
            date={timelineDate}
            tasks={tasks}
            onTasksChange={onTasksChange}
            onClose={() => {
              setShowAddModal(false);
              setPreselectTaskId("");
              setPreselectActivityId("");
            }}
            onAdd={handleEntryAdded}
            initialTab={preselectTab}
            initialTaskId={preselectTaskId}
            initialActivityId={preselectActivityId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab({ tasks, activities }: { tasks: Task[]; activities: RecurringActivity[] }) {
  const { fg, fgMuted, cardBg, cardBorder, bg, isDark } = useThemeStyles();
  const todayGreg = getGregorianToday();
  const todayJalali = getTodayJalali();
  const [rangeFrom, setRangeFrom] = useState<string | null>(() => addDays(getGregorianToday(), -6));
  const [rangeTo, setRangeTo] = useState<string | null>(() => getGregorianToday());
  const [pickingEnd, setPickingEnd] = useState(false);
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const [rangeConfirmed, setRangeConfirmed] = useState(true);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedTagsByActivity, setSelectedTagsByActivity] = useState<Record<string, string[]>>({});

  const handleDayClick = useCallback((_day: number, meta: DayMeta) => {
    if (meta.gregDate > todayGreg) return;
    if (!rangeFrom || !pickingEnd) {
      setRangeFrom(meta.gregDate); setRangeTo(null); setPickingEnd(true); setRangeConfirmed(false);
    } else {
      const from = rangeFrom!;
      const to = meta.gregDate;
      if (to < from) { setRangeFrom(to); setRangeTo(from); }
      else { setRangeTo(to); }
      setPickingEnd(false); setRangeConfirmed(true);
    }
  }, [rangeFrom, pickingEnd, todayGreg]);

  const toggleActivity = (id: string) => {
    setSelectedActivityIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleTagForActivity = (activityId: string, tag: string) => {
    setSelectedTagsByActivity((prev) => {
      const current = prev[activityId] ?? [];
      const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [activityId]: updated };
    });
  };

  const handleConfirm = () => {
    if (rangeFrom && rangeTo) setRangeConfirmed(true);
  };

  const tasksInRange = tasks.filter((t) => {
    if (!t.scheduled_date) return false;
    if (!rangeFrom || !rangeTo) return false;
    return t.scheduled_date >= rangeFrom && t.scheduled_date <= rangeTo;
  });

  const activityFilteredTasks = tasksInRange.filter((t) => {
    if (selectedActivityIds.length === 0) return true;
    return selectedActivityIds.includes(t.activity_id ?? "");
  });

  const filteredTasks = activityFilteredTasks.filter((t) => {
    const actId = t.activity_id ?? "";
    const tagsForAct = selectedTagsByActivity[actId] ?? [];
    if (tagsForAct.length === 0) return true;
    const taskTags = t.tags ?? [];
    return tagsForAct.some((tag) => taskTags.includes(tag));
  });

  const timelineEntriesInRange = rangeFrom && rangeTo
    ? TimelineEntryStore.listByRange(rangeFrom, rangeTo).filter((e) => {
        if (selectedActivityIds.length === 0) return true;
        return selectedActivityIds.includes(e.activity_id);
      })
    : [];

  const secsByActivityFromTasks: Record<string, number> = {};
  filteredTasks.forEach((t) => {
    const actId = t.activity_id ?? "__none__";
    secsByActivityFromTasks[actId] = (secsByActivityFromTasks[actId] || 0) + (t.elapsed_seconds || 0);
  });

  const secsByActivityFromTimeline: Record<string, number> = {};
  timelineEntriesInRange.forEach((e) => {
    const secs = e.duration_seconds ?? 0;
    secsByActivityFromTimeline[e.activity_id] = (secsByActivityFromTimeline[e.activity_id] || 0) + secs;
  });

  const secsByActivity: Record<string, number> = { ...secsByActivityFromTasks };
  Object.entries(secsByActivityFromTimeline).forEach(([actId, secs]) => {
    secsByActivity[actId] = (secsByActivity[actId] || 0) + secs;
  });

  const totalTracked = Object.values(secsByActivity).reduce((a, b) => a + b, 0);

  const allDatesInRange: string[] = [];
  if (rangeFrom && rangeTo) {
    let cursor = rangeFrom;
    while (cursor <= rangeTo) { allDatesInRange.push(cursor); cursor = addDays(cursor, 1); }
  }

  const tagsByActivityId: Record<string, string[]> = {};
  activityFilteredTasks.forEach((t) => {
    const actId = t.activity_id ?? "";
    if (!tagsByActivityId[actId]) tagsByActivityId[actId] = [];
    (t.tags ?? []).forEach((tag) => {
      if (!tagsByActivityId[actId].includes(tag)) tagsByActivityId[actId].push(tag);
    });
  });

  const activeActivities = selectedActivityIds.length > 0
    ? activities.filter((a) => selectedActivityIds.includes(a.id))
    : activities.filter((a) => activityFilteredTasks.some((t) => t.activity_id === a.id));

  const pieData: { name: string; value: number; color: string }[] = [];
  Object.entries(secsByActivity).forEach(([actId, secs]) => {
    if (secs <= 0) return;
    if (actId === "__none__") {
      pieData.push({ name: "بدون اکتیویتی", value: secs, color: "#94a3b8" });
    } else {
      const act = activities.find((a) => a.id === actId);
      if (act) pieData.push({ name: act.name, value: secs, color: act.color });
    }
  });

  const dateMap = new Map<string, Record<string, number>>();
  filteredTasks.forEach((t) => {
    const d = t.scheduled_date;
    if (!d) return;
    if (!dateMap.has(d)) dateMap.set(d, {});
    const m = dateMap.get(d)!;
    const actId = t.activity_id || "__none__";
    m[actId] = (m[actId] || 0) + (t.elapsed_seconds || 0);
  });

  timelineEntriesInRange.forEach((e) => {
    const d = e.date;
    if (!d) return;
    if (!dateMap.has(d)) dateMap.set(d, {});
    const m = dateMap.get(d)!;
    m[e.activity_id] = (m[e.activity_id] || 0) + (e.duration_seconds || 0);
  });

  const activeActivitiesForChart = activities.filter((a) => selectedActivityIds.length === 0 || selectedActivityIds.includes(a.id));

  const lineData = allDatesInRange.map((date) => {
    const m = dateMap.get(date) || {};
    const entry: Record<string, string | number> = { date: toShamsiShort(date) };
    
    activities.forEach((act) => {
      if (selectedActivityIds.length === 0 || selectedActivityIds.includes(act.id)) {
        entry[act.name] = Math.round((m[act.id] || 0) / 60);
      }
    });
    
    if (selectedActivityIds.length === 0 || selectedActivityIds.includes("__none__")) {
      entry["بدون اکتیویتی"] = Math.round((m["__none__"] || 0) / 60);
    }
    
    entry.total = Math.round(Object.values(m).reduce((a, b) => a + b, 0) / 60);
    return entry;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const totalSeconds = (dataPoint.total || 0) * 60;

      const itemsWithData = activeActivitiesForChart.filter(
        (a) => dataPoint[a.name] !== undefined && dataPoint[a.name] > 0
      );

      return (
        <div className="rounded-xl p-3 shadow-xl border text-right text-xs space-y-2 font-sans animate-fade-in"
          style={{ backgroundColor: bg, borderColor: cardBorder, color: fg }}>
          <p className="font-bold border-b pb-1 mb-1" style={{ borderColor: `${cardBorder}50` }}>
            {label}
          </p>
          {itemsWithData.length > 0 ? (
            <div className="space-y-1.5">
              {itemsWithData.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                    <span style={{ color: fgMuted }}>{a.name}:</span>
                  </div>
                  <span className="font-bold" style={{ color: fg }}>
                    {formatDuration(dataPoint[a.name] * 60)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: fgMuted }}>هیچ فعالیتی ثبت نشده</p>
          )}
          <div className="border-t pt-1.5 mt-1.5 flex items-center justify-between gap-6 font-bold"
            style={{ borderColor: `${cardBorder}50` }}>
            <span style={{ color: fg }}>مجموع کل روز:</span>
            <span style={{ color: "#818cf8" }}>{formatDuration(totalSeconds)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const totalTimelineSeconds = timelineEntriesInRange.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: fg }}>انتخاب بازه تاریخی</span>
          <div className="flex gap-3 text-xs" style={{ color: fgMuted }}>
            {rangeFrom && <span>از: {toShamsiShort(rangeFrom)}</span>}
            {rangeTo && <span>تا: {toShamsiShort(rangeTo)}</span>}
          </div>
        </div>
        {pickingEnd && (
          <div className="rounded-xl px-3 py-2 text-center text-xs animate-pulse" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
            حالا روز پایانی را انتخاب کن
          </div>
        )}
        <JalaliCalendar jy={calJy} jm={calJm}
          onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
          onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
          canNext={calJy < todayJalali[0] || (calJy === todayJalali[0] && calJm < todayJalali[1])}
          todayGreg={todayGreg} onDayClick={handleDayClick}
          renderDay={(day, meta) => {
            const isFuture = meta.gregDate > todayGreg;
            const inRange = rangeFrom && rangeTo && meta.gregDate >= rangeFrom && meta.gregDate <= rangeTo;
            const isStart = meta.gregDate === rangeFrom, isEnd = meta.gregDate === rangeTo;
            let bgColor = "transparent", textColor = isFuture ? `${fgMuted}33` : `${fgMuted}cc`;
            if (isStart || isEnd) { bgColor = "#6366f1"; textColor = "#fff"; }
            else if (inRange) { bgColor = "rgba(99,102,241,0.15)"; textColor = "#818cf8"; }
            else if (meta.isToday) { bgColor = "rgba(99,102,241,0.1)"; textColor = "#818cf8"; }
            return <span className="flex h-full w-full items-center justify-center rounded-lg" style={{ backgroundColor: bgColor, color: textColor }}>{toPersianDigits(day)}</span>;
          }}
        />
        <div className="flex flex-wrap gap-2">
          {[{ label: "امروز", days: 1 }, { label: "هفته اخیر", days: 7 }, { label: "ماه اخیر", days: 30 }].map(({ label, days }) => (
            <button key={label} onClick={() => {
              const from = addDays(todayGreg, -(days - 1));
              setRangeFrom(from); setRangeTo(todayGreg); setPickingEnd(false); setRangeConfirmed(true);
              const jd = gregorianToJalali(...from.split("-").map(Number) as [number, number, number]);
              setCalJy(jd[0]); setCalJm(jd[1]);
            }} className="rounded-lg px-3 py-1.5 text-xs transition-all" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>
              {label}
            </button>
          ))}
        </div>
        {activities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium" style={{ color: fgMuted }}>فیلتر اکتیویتی:</span>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setSelectedActivityIds([]); setSelectedTagsByActivity({}); }}
                className="rounded-lg px-3 py-1.5 text-xs transition-all"
                style={{ border: `1px solid ${selectedActivityIds.length === 0 ? "#6366f1" : cardBorder}`, backgroundColor: selectedActivityIds.length === 0 ? "rgba(99,102,241,0.15)" : "transparent", color: selectedActivityIds.length === 0 ? "#818cf8" : fgMuted }}>
                همه
              </button>
              {activities.map((a) => (
                <button key={a.id} onClick={() => toggleActivity(a.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                  style={{ border: `1px solid ${selectedActivityIds.includes(a.id) ? a.color : cardBorder}`, backgroundColor: selectedActivityIds.includes(a.id) ? `${a.color}20` : "transparent", color: selectedActivityIds.includes(a.id) ? a.color : fgMuted }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />{a.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeActivities.map((act) => {
          const tagsForAct = tagsByActivityId[act.id] ?? [];
          if (tagsForAct.length === 0) return null;
          const selectedTags = selectedTagsByActivity[act.id] ?? [];
          return (
            <div key={act.id} className="space-y-1.5 rounded-xl p-2.5"
              style={{ border: `1px solid ${act.color}30`, backgroundColor: `${act.color}08` }}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: act.color }} />
                <span className="text-xs font-medium" style={{ color: act.color }}>هشتگ‌های {act.name}:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tagsForAct.map((tag) => (
                  <button key={tag} onClick={() => toggleTagForActivity(act.id, tag)}
                    className="rounded-lg px-2.5 py-1 text-xs transition-all"
                    style={{
                      border: `1px solid ${selectedTags.includes(tag) ? act.color : `${act.color}40`}`,
                      backgroundColor: selectedTags.includes(tag) ? `${act.color}20` : "transparent",
                      color: selectedTags.includes(tag) ? act.color : fgMuted,
                    }}>
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button onClick={handleConfirm} disabled={!rangeFrom || !rangeTo}
          className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
          نمایش آمار
        </button>
      </div>

      {rangeConfirmed && rangeFrom && rangeTo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(99,102,241,0.25)", backgroundColor: "rgba(99,102,241,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#818cf8" }}>{formatDuration(totalTracked)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>کل زمان</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#34d399" }}>{toPersianDigits(filteredTasks.length)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>تسک</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#fbbf24" }}>{formatDuration(totalTracked - totalTimelineSeconds > 0 ? totalTracked - totalTimelineSeconds : 0)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>تایمر تسک‌ها</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(139,92,246,0.25)", backgroundColor: "rgba(139,92,246,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#a78bfa" }}>{formatDuration(totalTimelineSeconds)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>تایم‌لاین دستی</div>
            </div>
          </div>
          {totalTimelineSeconds > 0 && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: "#818cf8" }}>
              📊 آمار شامل <strong>{formatDuration(totalTimelineSeconds)}</strong> از فعالیت‌های دستی ثبت‌شده در تایم‌لاین است.
            </div>
          )}
          {pieData.length > 0 && (
            <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>توزیع زمان</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div style={{ width: "100%", maxWidth: 220, height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartTooltip formatter={(value) => [formatDuration(Number(value))]}
                        contentStyle={{ backgroundColor: bg, border: `1px solid ${cardBorder}`, borderRadius: 12, direction: "rtl", color: fg }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {pieData.map((d) => {
                    const pct = totalTracked > 0 ? Math.round((d.value / totalTracked) * 100) : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="flex-1 text-sm" style={{ color: fg }}>{d.name}</span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{formatDuration(d.value)} ({toPersianDigits(pct)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {lineData.length > 1 && (
            <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>روند فعالیت‌ها در زمان</h3>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: fgMuted }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: fgMuted }} tickLine={false} axisLine={false} />
                    <RechartTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
                    {activeActivitiesForChart.length > 1 ? (
                      activeActivitiesForChart.map((a) => (
                        <Line key={a.id} type="monotone" dataKey={a.name} stroke={a.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      ))
                    ) : (
                      <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="کل زمان" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {filteredTasks.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>تسک‌های این بازه</h3>
              {filteredTasks.map((t) => {
                const act = activities.find((a) => a.id === t.activity_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ border: `1px solid ${act ? `${act.color}30` : cardBorder}`, backgroundColor: act ? `${act.color}08` : "transparent" }}>
                    {act && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: act.color }} />}
                    <span className="flex-1 text-sm truncate" style={{ color: fg }}>{t.title}</span>
                    {t.tags && t.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>#{tag}</span>
                    ))}
                    <span className="text-xs font-mono font-semibold" style={{ color: act ? act.color : fgMuted }}>{formatDuration(t.elapsed_seconds || 0)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {timelineEntriesInRange.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>فعالیت‌های دستی ثبت‌شده</h3>
              {timelineEntriesInRange.map((e) => {
                const act = activities.find((a) => a.id === e.activity_id);
                if (!act) return null;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ border: `1px solid ${act.color}30`, backgroundColor: `${act.color}08` }}>
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: act.color }} />
                    <span className="text-xs font-semibold" style={{ color: act.color }}>{act.name}</span>
                    <span className="text-[10px]" style={{ color: fgMuted }}>{toShamsiShort(e.date)}</span>
                    <span className="text-[10px]" style={{ color: fgMuted }}>{e.from_time} – {e.to_time}</span>
                    {e.note && <span className="text-[10px] truncate flex-1" style={{ color: fgMuted }}>· {e.note}</span>}
                    <span className="text-xs font-mono font-semibold" style={{ color: act.color }}>
                      {e.duration_seconds ? formatDuration(e.duration_seconds) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {filteredTasks.length === 0 && timelineEntriesInRange.length === 0 && (
            <div className="rounded-2xl p-8 text-center text-sm" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
              در این بازه با فیلترهای انتخابی داده‌ای یافت نشد
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── Main KanbanView ───────────────────────────────────────────────────────────
const TABS = [
  { id: "kanban", label: "کانبان", icon: List },
  { id: "timeline", label: "تایم‌لاین", icon: CalIcon },
  { id: "stats", label: "آمار", icon: BarChart3 },
];

export default function KanbanView({ tasks, activities, onMove, onTasksChange }: Props) {
  const { fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [tab, setTab] = useState<"kanban" | "timeline" | "stats">("kanban");
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex gap-1 rounded-2xl p-1" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all"
            style={tab === id
              ? { backgroundColor: "#6366f1", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }
              : { color: fgMuted }}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === "kanban" && <KanbanTab tasks={tasks} activities={activities} onMove={onMove} />}
          {tab === "timeline" && <TimelineTab tasks={tasks} activities={activities} onTasksChange={onTasksChange} />}
          {tab === "stats" && <StatsTab tasks={tasks} activities={activities} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
