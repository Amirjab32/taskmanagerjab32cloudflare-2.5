import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Trash2, Check, Clock, Loader2, MessageSquare, Play, Pause } from "lucide-react";
import { Task, RecurringActivity } from "@/lib/store";
import { toShamsiShort, getGregorianToday, dayDiff, toPersianDigits } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  task: Task;
  onStatusChange: (task: Task, status: "todo" | "in_progress" | "done") => void;
  onDelete: (id: string) => void;
  activities?: RecurringActivity[];
  showTimer?: boolean;
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

const STATUS_CONFIG = {
  todo: {
    borderColor: "rgba(148,163,184,0.35)",
    bgAccent: "rgba(148,163,184,0.06)",
    badgeBg: "rgba(148,163,184,0.15)",
    badgeColor: "#94a3b8",
    badgeLabel: "در انتظار",
    icon: Clock,
    iconColor: "#94a3b8",
    leftBarColor: "#94a3b8",
  },
  in_progress: {
    borderColor: "rgba(251,191,36,0.45)",
    bgAccent: "rgba(251,191,36,0.07)",
    badgeBg: "rgba(251,191,36,0.15)",
    badgeColor: "#fbbf24",
    badgeLabel: "در حال انجام",
    icon: Loader2,
    iconColor: "#fbbf24",
    leftBarColor: "#fbbf24",
  },
  done: {
    borderColor: "rgba(52,211,153,0.4)",
    bgAccent: "rgba(52,211,153,0.07)",
    badgeBg: "rgba(52,211,153,0.15)",
    badgeColor: "#34d399",
    badgeLabel: "انجام شد",
    icon: Check,
    iconColor: "#34d399",
    leftBarColor: "#34d399",
  },
};

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${toPersianDigits(h)}:${toPersianDigits(pad(m))}:${toPersianDigits(pad(s))}`;
  return `${toPersianDigits(pad(m))}:${toPersianDigits(pad(s))}`;
}

export default function TaskItem({ task, onStatusChange, onDelete, activities = [], showTimer = true }: Props) {
  const { fg, fgMuted, cardBg } = useThemeStyles();
  const [hovered, setHovered] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(task.elapsed_seconds || 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const today = getGregorianToday();
  const isOverdue =
    task.status !== "done" && task.scheduled_date && task.scheduled_date < today;
  const overdueDays = isOverdue ? Math.abs(dayDiff(task.scheduled_date!, today)) : 0;
  const status = task.status;
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const iconClass =
    status === "in_progress" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5";
  const activity = activities.find((a) => a.id === task.activity_id);

  useEffect(() => {
    if (status === "in_progress" && task.timer_started_at) {
      const base = task.elapsed_seconds || 0;
      const startedAt = task.timer_started_at;
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setDisplaySeconds(base + elapsed);
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplaySeconds(task.elapsed_seconds || 0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, task.timer_started_at, task.elapsed_seconds]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 transition-colors"
      style={{
        border: `1px solid ${activity ? `${activity.color}40` : isOverdue ? "rgba(244,63,94,0.4)" : cfg.borderColor}`,
        backgroundColor: hovered
          ? cfg.bgAccent
          : status === "todo" && !isOverdue
            ? cardBg
            : cfg.bgAccent,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="absolute right-0 top-0 h-full w-1 rounded-r-xl"
        style={{ backgroundColor: activity ? activity.color : isOverdue ? "#f43f5e" : cfg.leftBarColor }}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStatusChange(task, status === "done" ? "todo" : "done");
        }}
        className="group flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all hover:scale-110"
        style={{
          borderColor: status === "done"
            ? "#10b981"
            : activity
              ? activity.color
              : isOverdue
                ? "#f43f5e"
                : "rgba(148,163,184,0.5)",
          backgroundColor: status === "done" ? "#10b981" : "transparent",
        }}
      >
        {status === "done" ? (
          <Check className="h-3.5 w-3.5 text-white stroke-[3px]" />
        ) : (
          <Check className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity stroke-[3px]" />
        )}
      </button>
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-sm font-medium"
          style={{
            color: status === "done" ? fgMuted : fg,
            textDecoration: status === "done" ? "line-through" : "none",
            opacity: status === "done" ? 0.6 : 1,
          }}
        >
          {task.title}
          {activity && (
            <span className="mr-1 text-xs opacity-70" style={{ color: activity.color }}>
              [{activity.name}]
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: isOverdue ? "rgba(244,63,94,0.12)" : cfg.badgeBg,
              color: isOverdue ? "#f87171" : cfg.badgeColor,
            }}
          >
            <StatusIcon className={iconClass} />
            {isOverdue ? `${toPersianDigits(overdueDays)} روز تأخیر` : cfg.badgeLabel}
          </span>
          {task.scheduled_date && (
            <span className="text-xs" style={{ color: fgMuted }}>
              {toShamsiShort(task.scheduled_date)}
            </span>
          )}
          <span
            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${PRIORITY_COLORS[task.priority]}18`,
              color: PRIORITY_COLORS[task.priority],
            }}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
          {showTimer && status !== "done" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task, status === "in_progress" ? "todo" : "in_progress");
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all hover:bg-amber-500/15"
              style={{
                backgroundColor: status === "in_progress" ? "rgba(251,191,36,0.15)" : "rgba(128,128,128,0.08)",
                color: status === "in_progress" ? "#fbbf24" : fgMuted,
                border: status === "in_progress" ? "1px solid rgba(251,191,36,0.3)" : "1px solid transparent",
              }}
              title={status === "in_progress" ? "توقف تایمر" : "شروع تایمر"}
            >
              {status === "in_progress" ? (
                <>
                  <Pause className="h-3 w-3 animate-pulse text-amber-400" />
                  <span>درحال انجام ({formatTimer(displaySeconds)})</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 text-indigo-400" />
                  <span>شروع کار {displaySeconds > 0 ? `(${formatTimer(displaySeconds)})` : ""}</span>
                </>
              )}
            </button>
          )}
          {showTimer && status === "done" && displaySeconds > 0 && (
            <span
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono font-medium"
              style={{
                backgroundColor: "rgba(128,128,128,0.1)",
                color: fgMuted,
              }}
            >
              ⏱ {formatTimer(displaySeconds)}
            </span>
          )}
          {task.tags && task.tags.length > 0 && task.tags.map((t) => (
            <span
              key={t}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}
            >
              #{t}
            </span>
          ))}
          {task.comment && (
            <span className="text-[11px]" style={{ color: fgMuted }} title={task.comment}>
              <MessageSquare className="inline h-3 w-3 mr-0.5" />
              {task.comment.length > 20 ? task.comment.slice(0, 20) + "..." : task.comment}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all"
        style={{ opacity: hovered ? 1 : 0.65, color: fgMuted }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(244,63,94,0.12)";
          (e.currentTarget as HTMLElement).style.color = "#f87171";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLElement).style.color = fgMuted;
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
