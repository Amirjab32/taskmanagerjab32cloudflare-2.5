import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/lib/ThemeContext";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { Task, Habit, StudyTopic, Note, TaskStore, HabitStore, TopicStore, NoteStore, RecurringActivity, RecurringActivityStore, confirmAndDelete, calculateHabitStreak } from "@/lib/store";
import { getGregorianToday, addDays } from "@/lib/shamsi";
import "@/lib/sync"; // مقداردهی اولیه سیستم هماهنگ‌سازی خودکار کلاینت با لپ‌تاپ
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";
import TaskManagerView from "@/views/TaskManagerView";
import KanbanView from "@/views/KanbanView";
import HabitTrackerView from "@/views/HabitTrackerView";
import SRSView from "@/views/SRSView";
import QuizTrackerView from "@/views/QuizTrackerView";
import NotesView from "@/views/NotesView";
import MotivationView from "@/views/MotivationView";
import GoingUpView from "@/views/GoingUpView";
import PlannerView from "@/views/PlannerView";
import PlannerFloatingTimer from "@/components/planner/PlannerFloatingTimer";
import IntroStressOverlay from "@/components/shared/IntroStressOverlay";
import BackupModal from "@/components/shared/BackupModal";
import DeleteConfirmationModal from "@/components/shared/DeleteConfirmationModal";

const ALL_INTERVALS = [1, 3, 7, 14, 30, 60];
const DEFAULT_STAGES = 4;

function AppContent() {
  const { bg, fg, fgMuted, cardBorder } = useThemeStyles();
  const [view, setView] = useState<"tasks" | "kanban" | "planner" | "habits" | "going_up" | "srs" | "quiz" | "notes" | "motivation">(() => {
    if (typeof window !== "undefined") {
      // Clear legacy localStorage value to prevent old state from overriding the default
      localStorage.removeItem("focusflow_current_view");
      
      const saved = sessionStorage.getItem("focusflow_current_view");
      if (saved) return saved as any;
    }
    return "tasks";
  });

  useEffect(() => {
    sessionStorage.setItem("focusflow_current_view", view);
  }, [view]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(() => TaskStore.list());
  const [habits, setHabits] = useState<Habit[]>(() => HabitStore.list());
  const [topics, setTopics] = useState<StudyTopic[]>(() => TopicStore.list());
  const [activities, setActivities] = useState<RecurringActivity[]>(() => RecurringActivityStore.list());
  const [notes, setNotes] = useState<Note[]>(() => NoteStore.list());
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Check 3-hour limit for Intro Overlay with high robustness
  const checkIntro = useCallback(() => {
    try {
      const lastTimeStr = localStorage.getItem("focusflow_last_intro_time");
      if (!lastTimeStr || lastTimeStr === "undefined" || lastTimeStr === "null") {
        setShowIntro(true);
        return;
      }
      
      const lastTime = Number(lastTimeStr);
      if (isNaN(lastTime) || lastTime <= 0) {
        setShowIntro(true);
        return;
      }
      
      const diffMs = Date.now() - lastTime;
      const threeHoursMs = 3 * 60 * 60 * 1000;
      if (diffMs > threeHoursMs) {
        setShowIntro(true);
      }
    } catch (e) {
      console.warn("Local storage access failed, defaulting to showing intro overlay:", e);
      setShowIntro(true);
    }
  }, []);

  useEffect(() => {
    // Check on mount
    checkIntro();

    // Check when window gets focus or page visibility changes (especially for suspended mobile tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkIntro();
      }
    };

    window.addEventListener("focus", checkIntro);
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", checkIntro);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkIntro]);

  // Listen for triggering intro overlay on demand
  useEffect(() => {
    const handleTrigger = () => setShowIntro(true);
    window.addEventListener("trigger-intro-overlay", handleTrigger);
    return () => window.removeEventListener("trigger-intro-overlay", handleTrigger);
  }, []);

  // File synchronization and Setup states
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    title: string;
    onConfirm: () => void;
  } | null>(null);

  // Set up listener for delete confirmation requests from components
  useEffect(() => {
    const handleRequestDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string; onConfirm: () => void }>;
      const { title, onConfirm } = customEvent.detail;
      const isSafeMode = localStorage.getItem("focusflow_safe_mode") !== "false";
      if (isSafeMode) {
        setPendingDelete({ title, onConfirm });
      } else {
        onConfirm();
      }
    };
    window.addEventListener("request-delete", handleRequestDelete as any);
    return () => window.removeEventListener("request-delete", handleRequestDelete as any);
  }, []);

  // Load data on mount and refresh when synced from server
  const reloadAllData = useCallback(() => {
    setTasks(TaskStore.list());
    setHabits(HabitStore.list());
    setTopics(TopicStore.list());
    setActivities(RecurringActivityStore.list());
    setNotes(NoteStore.list());
  }, []);

  useEffect(() => {
    reloadAllData();
    setLoading(false);

    const handler = () => setActivities(RecurringActivityStore.list());
    const dataChangedHandler = () => reloadAllData();
    window.addEventListener("activities-updated", handler);
    window.addEventListener("focusflow-db-synced", reloadAllData);
    window.addEventListener("focusflow-data-changed", dataChangedHandler);
    
    return () => {
      window.removeEventListener("activities-updated", handler);
      window.removeEventListener("focusflow-db-synced", reloadAllData);
      window.removeEventListener("focusflow-data-changed", dataChangedHandler);
    };
  }, [reloadAllData]);

  const refreshActivities = useCallback(() => {
    setActivities(RecurringActivityStore.list());
  }, []);

  const createTask = useCallback(
    (data: {
      title: string;
      priority: "low" | "medium" | "high";
      scheduled_date: string;
      comment?: string;
      tags?: string[];
      activity_id?: string | null;
    }) => {
      TaskStore.create({
        ...data,
        status: "todo",
        kanban_column: "todo",
        description: "",
        elapsed_seconds: 0,
        timer_started_at: null,
        timeline_slot: null,
        timeline_date: null,
        activity_id: data.activity_id ?? null,
        intervals: [],
      });
      setTasks(TaskStore.list());
    },
    []
  );

  const changeTaskStatus = useCallback((task: Task, status: "todo" | "in_progress" | "done") => {
    const now = Date.now();
    let extraData: Partial<Task> = { status, kanban_column: status };
    if (status === "in_progress") {
      extraData.timer_started_at = now;
      extraData.completed_at = null;
    } else if (task.status === "in_progress") {
      const elapsed = task.timer_started_at ? Math.floor((now - task.timer_started_at) / 1000) : 0;
      extraData.elapsed_seconds = (task.elapsed_seconds || 0) + elapsed;
      extraData.timer_started_at = null; 
      if (task.timer_started_at) {
        const newInterval = {
          id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
          started_at: task.timer_started_at,
          ended_at: now,
          elapsed_seconds: elapsed,
          status_at_end: status,
        };
        extraData.intervals = [...(task.intervals || []), newInterval];
      }
    }
    if (status === "done") {
      extraData.completed_at = now;
    } else {
      extraData.completed_at = null;
    }
    const updated = TaskStore.update(task.id, extraData);
    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    const title = task ? `تسک: ${task.title}` : "تسک";
    confirmAndDelete(title, () => {
      TaskStore.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });
  }, [tasks]);

  const moveKanban = useCallback((id: string, column: "todo" | "in_progress" | "done", extraData?: Partial<Task>) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    let finalExtraData = { ...extraData, kanban_column: column, status: column };
    
    if (column === "done" && task.status === "in_progress" && task.timer_started_at) {
      finalExtraData = {
        ...finalExtraData,
        timer_started_at: task.timer_started_at,
      };
    }
    if (column === "done") {
      finalExtraData.completed_at = Date.now();
    } else {
      finalExtraData.completed_at = null;
    }

    if (task.status === "in_progress" && column !== "in_progress") {
      const now = Date.now();
      const elapsed = task.timer_started_at ? Math.floor((now - task.timer_started_at) / 1000) : 0;
      if (task.timer_started_at) {
        const newInterval = {
          id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
          started_at: task.timer_started_at,
          ended_at: now,
          elapsed_seconds: elapsed,
          status_at_end: column,
        };
        finalExtraData.intervals = [...(task.intervals || []), newInterval];
      }
      finalExtraData.timer_started_at = null;
    }
    
    const updated = TaskStore.update(id, finalExtraData);
    if (updated) setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, [tasks]);

  const createHabit = useCallback((data: { name: string; color: string }) => {
    HabitStore.create({ ...data, completed_dates: [] });
    setHabits(HabitStore.list());
  }, []);

  const toggleHabit = useCallback((habit: Habit, date?: string, force?: boolean) => {
    if (!force && (habit.is_pinned || habit.id === "system-habit-stay-in-study")) return;
    const targetDate = date || getGregorianToday();
    const dates = habit.completed_dates || [];
    const newDates = dates.includes(targetDate) ? dates.filter((d) => d !== targetDate) : [...dates, targetDate];
    const { streakCount, lastCompletedDate } = calculateHabitStreak(newDates);
    const updated = HabitStore.update(habit.id, {
      completed_dates: newDates,
      streakCount,
      lastCompletedDate: lastCompletedDate || undefined
    });
    if (updated) setHabits(HabitStore.list());
  }, []);

  const deleteHabit = useCallback((id: string) => {
    const habit = habits.find((h) => h.id === id);
    const title = habit ? `عادت: ${habit.name}` : "عادت";
    confirmAndDelete(title, () => {
      HabitStore.delete(id);
      setHabits(HabitStore.list());
    });
  }, [habits]);

  const createTopic = useCallback(
    (data: { title: string; description?: string; total_stages?: number }) => {
      const today = getGregorianToday();
      const stages = data.total_stages ?? DEFAULT_STAGES;
      TopicStore.create({
        title: data.title,
        description: data.description,
        last_reviewed_date: today,
        next_review_date: addDays(today, ALL_INTERVALS[0]),
        current_interval: ALL_INTERVALS[0],
        review_count: 0,
        total_stages: stages,
      });
      setTopics(TopicStore.list());
    },
    []
  );

  const reviewTopic = useCallback((topic: StudyTopic) => {
    const today = getGregorianToday();
    const stages = topic.total_stages ?? DEFAULT_STAGES;
    const intervals = ALL_INTERVALS.slice(0, stages);
    const nextCount = (topic.review_count || 0) + 1;
    const completed = nextCount >= stages;
    const interval = intervals[Math.min(nextCount, intervals.length - 1)];
    const updated = TopicStore.update(topic.id, {
      last_reviewed_date: today,
      next_review_date: completed ? undefined : addDays(today, interval),
      current_interval: completed ? 0 : interval,
      review_count: nextCount,
    });
    if (updated) {
      setTopics((prev) =>
        prev
          .map((t) => (t.id === topic.id ? updated : t))
          .sort((a, b) => (a.next_review_date || "").localeCompare(b.next_review_date || ""))
      );
    }
  }, []);

  const deleteTopic = useCallback((id: string) => {
    const topic = topics.find((t) => t.id === id);
    const title = topic ? `موضوع مرور: ${topic.title}` : "موضوع مرور";
    confirmAndDelete(title, () => {
      TopicStore.delete(id);
      setTopics((prev) => prev.filter((t) => t.id !== id));
    });
  }, [topics]);

  const updateTopic = useCallback((id: string, data: Partial<StudyTopic>) => {
    const updated = TopicStore.update(id, data);
    if (updated) {
      setTopics((prev) =>
        prev
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => (a.next_review_date || "").localeCompare(b.next_review_date || ""))
      );
    }
  }, []);

  const createNote = useCallback((data: { title: string; content: string; folder: string; tags: string[] }) => {
    NoteStore.create(data);
    setNotes(NoteStore.list());
  }, []);

  const updateNote = useCallback((id: string, data: Partial<Note>) => {
    const updated = NoteStore.update(id, data);
    if (updated) {
      setNotes(NoteStore.list());
    }
  }, []);

  const deleteNote = useCallback((id: string) => {
    const note = NoteStore.list().find((n) => n.id === id);
    const title = note ? `یادداشت: ${note.title}` : "یادداشت";
    confirmAndDelete(title, () => {
      NoteStore.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    });
  }, []);

  if (loading) {
    return (
      <div style={{ backgroundColor: bg, color: fg, minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col font-sans transition-colors duration-300" style={{ backgroundColor: bg, color: fg }}>
      <TopBar view={view} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((o) => !o)} />
      <PlannerFloatingTimer />
      <Sidebar 
        open={menuOpen} 
        view={view} 
        onViewChange={(v) => setView(v as typeof view)} 
        onClose={() => setMenuOpen(false)} 
        onOpenBackup={() => setIsBackupOpen(true)}
      />
      <main className="mx-auto max-w-5xl px-4 py-6 flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            {view === "tasks" && (
              <TaskManagerView tasks={tasks} activities={activities} onAdd={createTask} onStatusChange={changeTaskStatus} onDelete={deleteTask} onActivitiesChange={refreshActivities} />
            )}
            {view === "kanban" && (
              <KanbanView tasks={tasks} activities={activities} onMove={moveKanban} onTasksChange={setTasks} />
            )}
            {view === "planner" && (
              <PlannerView />
            )}
            {view === "habits" && (
              <HabitTrackerView habits={habits} onAdd={createHabit} onToggle={toggleHabit} onDelete={deleteHabit} />
            )}
            {view === "going_up" && (
              <GoingUpView />
            )}
            {view === "srs" && (
              <SRSView topics={topics} onAdd={createTopic} onReview={reviewTopic} onDelete={deleteTopic} onUpdateTopic={updateTopic} />
            )}
            {view === "quiz" && <QuizTrackerView />}
            {view === "notes" && (
              <NotesView notes={notes} onAdd={createNote} onUpdate={updateNote} onDelete={deleteNote} />
            )}
            {view === "motivation" && (
              <MotivationView />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-4 text-center text-xs select-none" style={{ color: fgMuted }}>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border text-[11px]" style={{ borderColor: cardBorder }}>
          <span>نسخه</span>
          <span className="font-semibold">۲.۴</span>
        </div>
      </footer>

      {/* Backup & Restore Modal */}
      <AnimatePresence>
        {isBackupOpen && (
          <BackupModal 
            isOpen={isBackupOpen} 
            onClose={() => setIsBackupOpen(false)} 
            onSuccess={() => window.location.reload()} 
          />
        )}
      </AnimatePresence>

      {/* Unified Deletion Safety Modal */}
      <AnimatePresence>
        {pendingDelete && (
          <DeleteConfirmationModal
            title={pendingDelete.title}
            onConfirm={() => {
              pendingDelete.onConfirm();
              setPendingDelete(null);
            }}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>

      {/* Intro Stress-induction Countdown Overlay */}
      <AnimatePresence>
        {showIntro && (
          <IntroStressOverlay onClose={() => setShowIntro(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppShell() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
