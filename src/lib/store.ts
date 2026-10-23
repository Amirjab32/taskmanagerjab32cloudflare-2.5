export interface TaskInterval {
  id: string;
  started_at: number;
  ended_at: number;
  elapsed_seconds: number;
  status_at_end: "todo" | "done" | "in_progress";
}
export interface Task {
  id: string;
  title: string;
  description?: string;
  comment?: string;
  tags?: string[];
  scheduled_date?: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  kanban_column: "todo" | "in_progress" | "done";
  created_date: string;
  elapsed_seconds: number;
  timer_started_at?: number | null;
  timeline_slot?: string | null;
  timeline_date?: string | null;
  activity_id?: string | null;
  completed_at?: number | null;
  intervals?: TaskInterval[];
}
export interface RecurringActivity {
  id: string;
  name: string;
  color: string;
  created_date: string;
  tags?: string[];
}
export interface HabitGroup {
  id: string;
  name: string;
  color: string;
  created_date: string;
  order?: number;
}
export interface Habit {
  id: string;
  name: string;
  color: string;
  completed_dates: string[];
  created_date: string;
  streakCount?: number;
  lastCompletedDate?: string;
  is_pinned?: boolean;
  group_id?: string | null;
  order?: number;
}
export interface StudyTopic {
  id: string;
  title: string;
  description?: string;
  last_reviewed_date?: string;
  next_review_date?: string;
  current_interval: number;
  review_count: number;
  total_stages: number;
  created_date: string;
}
export interface QuizSubject {
  id: string;
  name: string;
  color: string;
  chapters: QuizChapter[];
  created_date: string;
}
export interface QuizChapter {
  id: string;
  name: string;
}
export interface QuizEntry {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  count: number;
  date: string;
  note?: string;
  tags?: string[];
  created_date: string;
}
export interface TimelineActivityEntry {
  id: string;
  activity_id: string;
  date: string;
  from_time: string;
  to_time: string;
  note?: string;
  created_date: string;
  slot_ids: string[];
  duration_seconds?: number;
  tags?: string[];
}
export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  folder?: string; // e.g. "all", "work", "personal", "study"
  is_pinned?: boolean;
  is_bold?: boolean;
  created_date: string;
  updated_at: number;
}

export interface PlannerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time_slot: string; // e.g. "07:30 - 09:00"
  is_checked: boolean;
  plan_main: string;
  plan_side?: string;
  plan_rest: string;
  plan_music?: string;
  actual_main: string;
  actual_side?: string;
  actual_rest: string;
  actual_music?: string;
  subject: string;
  created_date: string;
  order: number;
  task_id?: string | null;
  habit_id?: string | null;
  custom_threshold?: number | null;
  timer_started_at?: number | null;
  elapsed_seconds?: number;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
function getToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function getStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function setStore<T>(key: string, data: T[], silent: boolean = false): void {
  localStorage.setItem(key, JSON.stringify(data));
  if (!silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("focusflow-data-changed", { detail: { key } }));
  }
}

const TASKS_KEY = "focusflow_tasks";
export const TaskStore = {
  list(): Task[] {
    return getStore<Task>(TASKS_KEY).sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  },
  create(data: Omit<Task, "id" | "created_date">): Task {
    const task: Task = { ...data, id: generateId(), created_date: getToday() };
    const tasks = getStore<Task>(TASKS_KEY);
    tasks.unshift(task);
    setStore(TASKS_KEY, tasks);
    return task;
  },
  update(id: string, data: Partial<Task>): Task | null {
    const tasks = getStore<Task>(TASKS_KEY);
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...data };
    setStore(TASKS_KEY, tasks);
    return tasks[idx];
  },
  delete(id: string): void {
    const tasks = getStore<Task>(TASKS_KEY).filter((t) => t.id !== id);
    setStore(TASKS_KEY, tasks);
  },
};

const RECURRING_KEY = "focusflow_recurring_activities";
export const RecurringActivityStore = {
  list(): RecurringActivity[] {
    return getStore<RecurringActivity>(RECURRING_KEY).sort(
      (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    );
  },
  create(data: Omit<RecurringActivity, "id" | "created_date">): RecurringActivity {
    const item: RecurringActivity = { ...data, id: generateId(), created_date: getToday() };
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    list.push(item);
    setStore(RECURRING_KEY, list);
    return item;
  },
  update(id: string, data: Partial<RecurringActivity>): RecurringActivity | null {
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    setStore(RECURRING_KEY, list);
    return list[idx];
  },
  delete(id: string): void {
    const list = getStore<RecurringActivity>(RECURRING_KEY).filter((r) => r.id !== id);
    setStore(RECURRING_KEY, list);
  },
  addTag(activityId: string, tag: string): RecurringActivity | null {
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    const idx = list.findIndex((r) => r.id === activityId);
    if (idx === -1) return null;
    const existingTags = list[idx].tags ?? [];
    if (!existingTags.includes(tag)) {
      list[idx].tags = [...existingTags, tag];
      setStore(RECURRING_KEY, list);
    }
    return list[idx];
  },
  removeTag(activityId: string, tag: string): RecurringActivity | null {
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    const idx = list.findIndex((r) => r.id === activityId);
    if (idx === -1) return null;
    const existingTags = list[idx].tags ?? [];
    list[idx].tags = existingTags.filter((t) => t !== tag);
    setStore(RECURRING_KEY, list);
    return list[idx];
  },
};

export function calculateHabitStreak(completedDates: string[]): { streakCount: number; lastCompletedDate: string } {
  if (!completedDates || completedDates.length === 0) {
    return { streakCount: 0, lastCompletedDate: "" };
  }
  const set = new Set(completedDates);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  
  const getPrevDate = (dateStr: string, offset: number): string => {
    const parts = dateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  let streak = 0;
  let cursor = today;
  
  if (!set.has(today)) {
    const yesterday = getPrevDate(today, -1);
    if (set.has(yesterday)) {
      cursor = yesterday;
    } else {
      let maxDate = "";
      completedDates.forEach((d) => {
        if (d > maxDate) maxDate = d;
      });
      return { streakCount: 0, lastCompletedDate: maxDate };
    }
  }

  while (set.has(cursor)) {
    streak++;
    cursor = getPrevDate(cursor, -1);
  }

  let lastCompletedDate = "";
  if (set.has(today)) {
    lastCompletedDate = today;
  } else {
    const yesterday = getPrevDate(today, -1);
    if (set.has(yesterday)) {
      lastCompletedDate = yesterday;
    } else {
      let maxDate = "";
      completedDates.forEach((d) => {
        if (d > maxDate) maxDate = d;
      });
      lastCompletedDate = maxDate;
    }
  }

  return { streakCount: streak, lastCompletedDate };
}

const HABITS_KEY = "focusflow_habits";
export const HabitStore = {
  list(): Habit[] {
    let list = getStore<Habit>(HABITS_KEY);
    const hasSystemHabit = list.some((h) => h.id === "system-habit-stay-in-study");
    if (!hasSystemHabit) {
      const systemHabit: Habit = {
        id: "system-habit-stay-in-study",
        name: "ماندن در محیط درس",
        color: "#6366f1",
        completed_dates: [],
        created_date: "2026-01-01",
        streakCount: 0,
        lastCompletedDate: "",
        is_pinned: true,
      };
      list.push(systemHabit);
      setStore(HABITS_KEY, list);
    }

    let changed = false;
    const updatedList = list.map((habit) => {
      if (habit.id === "system-habit-stay-in-study" && (!habit.is_pinned || habit.name !== "ماندن در محیط درس")) {
        habit.is_pinned = true;
        habit.name = "ماندن در محیط درس";
        changed = true;
      }
      const { streakCount, lastCompletedDate } = calculateHabitStreak(habit.completed_dates || []);
      if (habit.streakCount !== streakCount || habit.lastCompletedDate !== lastCompletedDate) {
        changed = true;
        return { ...habit, streakCount, lastCompletedDate };
      }
      return habit;
    });

    if (changed) {
      setStore(HABITS_KEY, updatedList);
    }

    return updatedList.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
    });
  },
  saveAll(list: Habit[]): void {
    setStore(HABITS_KEY, list);
  },
  create(data: Omit<Habit, "id" | "created_date">): Habit {
    const habit: Habit = { 
      ...data, 
      id: generateId(), 
      created_date: getToday(),
      streakCount: 0,
      lastCompletedDate: ""
    };
    const habits = getStore<Habit>(HABITS_KEY);
    habits.unshift(habit);
    setStore(HABITS_KEY, habits);
    return habit;
  },
  update(id: string, data: Partial<Habit>): Habit | null {
    const habits = getStore<Habit>(HABITS_KEY);
    const idx = habits.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    habits[idx] = { ...habits[idx], ...data };
    setStore(HABITS_KEY, habits);
    return habits[idx];
  },
  delete(id: string): void {
    if (id === "system-habit-stay-in-study") return;
    const habits = getStore<Habit>(HABITS_KEY).filter((h) => h.id !== id);
    setStore(HABITS_KEY, habits);
  },
};

const HABIT_GROUPS_KEY = "focusflow_habit_groups";
export const HabitGroupStore = {
  list(): HabitGroup[] {
    return getStore<HabitGroup>(HABIT_GROUPS_KEY).sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
    });
  },
  saveAll(list: HabitGroup[]): void {
    setStore(HABIT_GROUPS_KEY, list);
  },
  create(data: Omit<HabitGroup, "id" | "created_date">): HabitGroup {
    const group: HabitGroup = {
      ...data,
      id: generateId(),
      created_date: getToday(),
    };
    const groups = getStore<HabitGroup>(HABIT_GROUPS_KEY);
    groups.push(group);
    setStore(HABIT_GROUPS_KEY, groups);
    return group;
  },
  update(id: string, data: Partial<HabitGroup>): HabitGroup | null {
    const groups = getStore<HabitGroup>(HABIT_GROUPS_KEY);
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    groups[idx] = { ...groups[idx], ...data };
    setStore(HABIT_GROUPS_KEY, groups);
    return groups[idx];
  },
  delete(id: string): void {
    const groups = getStore<HabitGroup>(HABIT_GROUPS_KEY).filter((g) => g.id !== id);
    setStore(HABIT_GROUPS_KEY, groups);

    const habits = getStore<Habit>(HABITS_KEY);
    const updatedHabits = habits.map((h) => {
      if (h.group_id === id) {
        return { ...h, group_id: null };
      }
      return h;
    });
    setStore(HABITS_KEY, updatedHabits);
  }
};

const TOPICS_KEY = "focusflow_topics";
export const TopicStore = {
  list(): StudyTopic[] {
    return getStore<StudyTopic>(TOPICS_KEY).sort((a, b) => {
      const ad = a.next_review_date || "9999-12-31";
      const bd = b.next_review_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
  },
  create(data: Omit<StudyTopic, "id" | "created_date">): StudyTopic {
    const topic: StudyTopic = { ...data, id: generateId(), created_date: getToday() };
    const topics = getStore<StudyTopic>(TOPICS_KEY);
    topics.push(topic);
    setStore(TOPICS_KEY, topics);
    return topic;
  },
  update(id: string, data: Partial<StudyTopic>): StudyTopic | null {
    const topics = getStore<StudyTopic>(TOPICS_KEY);
    const idx = topics.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    topics[idx] = { ...topics[idx], ...data };
    setStore(TOPICS_KEY, topics);
    return topics[idx];
  },
  delete(id: string): void {
    const topics = getStore<StudyTopic>(TOPICS_KEY).filter((t) => t.id !== id);
    setStore(TOPICS_KEY, topics);
  },
};

const QUIZ_SUBJECTS_KEY = "focusflow_quiz_subjects";
export const QuizSubjectStore = {
  list(): QuizSubject[] {
    return getStore<QuizSubject>(QUIZ_SUBJECTS_KEY).sort(
      (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    );
  },
  create(data: Omit<QuizSubject, "id" | "created_date">): QuizSubject {
    const subject: QuizSubject = { ...data, id: generateId(), created_date: getToday() };
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    subjects.push(subject);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subject;
  },
  update(id: string, data: Partial<QuizSubject>): QuizSubject | null {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    const idx = subjects.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    subjects[idx] = { ...subjects[idx], ...data };
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subjects[idx];
  },
  delete(id: string): void {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY).filter((s) => s.id !== id);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
  },
  addChapter(subjectId: string, chapterName: string): QuizSubject | null {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    const idx = subjects.findIndex((s) => s.id === subjectId);
    if (idx === -1) return null;
    const chapter: QuizChapter = { id: generateId(), name: chapterName };
    subjects[idx].chapters.push(chapter);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subjects[idx];
  },
  removeChapter(subjectId: string, chapterId: string): QuizSubject | null {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    const idx = subjects.findIndex((s) => s.id === subjectId);
    if (idx === -1) return null;
    subjects[idx].chapters = subjects[idx].chapters.filter((c) => c.id !== chapterId);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subjects[idx];
  },
};

const QUIZ_ENTRIES_KEY = "focusflow_quiz_entries";
export const QuizEntryStore = {
  list(): QuizEntry[] {
    return getStore<QuizEntry>(QUIZ_ENTRIES_KEY).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  },
  listByDate(date: string): QuizEntry[] {
    return getStore<QuizEntry>(QUIZ_ENTRIES_KEY)
      .filter((e) => e.date === date)
      .sort((a, b) => b.created_date.localeCompare(a.created_date));
  },
  listByRange(from: string, to: string): QuizEntry[] {
    return getStore<QuizEntry>(QUIZ_ENTRIES_KEY)
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  create(data: Omit<QuizEntry, "id" | "created_date">): QuizEntry {
    const entry: QuizEntry = { ...data, id: generateId(), created_date: getToday() };
    const entries = getStore<QuizEntry>(QUIZ_ENTRIES_KEY);
    entries.push(entry);
    setStore(QUIZ_ENTRIES_KEY, entries);
    return entry;
  },
  update(id: string, data: Partial<QuizEntry>): QuizEntry | null {
    const entries = getStore<QuizEntry>(QUIZ_ENTRIES_KEY);
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    entries[idx] = { ...entries[idx], ...data };
    setStore(QUIZ_ENTRIES_KEY, entries);
    return entries[idx];
  },
  delete(id: string): void {
    const entries = getStore<QuizEntry>(QUIZ_ENTRIES_KEY).filter((e) => e.id !== id);
    setStore(QUIZ_ENTRIES_KEY, entries);
  },
};

const TIMELINE_ENTRIES_KEY = "focusflow_timeline_entries";
export const TimelineEntryStore = {
  list(): TimelineActivityEntry[] {
    return getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY);
  },
  listByDate(date: string): TimelineActivityEntry[] {
    return getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY).filter((e) => e.date === date);
  },
  listByRange(from: string, to: string): TimelineActivityEntry[] {
    return getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY).filter(
      (e) => e.date >= from && e.date <= to
    );
  },
  create(data: Omit<TimelineActivityEntry, "id" | "created_date">): TimelineActivityEntry {
    const entry: TimelineActivityEntry = { ...data, id: generateId(), created_date: getToday() };
    const list = getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY);
    list.push(entry);
    setStore(TIMELINE_ENTRIES_KEY, list);
    return entry;
  },
  delete(id: string): void {
    const list = getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY).filter((e) => e.id !== id);
    setStore(TIMELINE_ENTRIES_KEY, list);
  },
};

const NOTES_KEY = "focusflow_notes";
export const NoteStore = {
  list(): Note[] {
    return getStore<Note>(NOTES_KEY).sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return b.updated_at - a.updated_at;
    });
  },
  create(data: Omit<Note, "id" | "created_date" | "updated_at">): Note {
    const note: Note = {
      ...data,
      id: generateId(),
      created_date: getToday(),
      updated_at: Date.now()
    };
    const list = getStore<Note>(NOTES_KEY);
    list.unshift(note);
    setStore(NOTES_KEY, list);
    return note;
  },
  update(id: string, data: Partial<Note>): Note | null {
    const list = getStore<Note>(NOTES_KEY);
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data, updated_at: Date.now() };
    setStore(NOTES_KEY, list);
    return list[idx];
  },
  delete(id: string): void {
    const list = getStore<Note>(NOTES_KEY).filter((n) => n.id !== id);
    setStore(NOTES_KEY, list);
  }
};

const PLANNER_KEY = "focusflow_planner";
const DEFAULT_TIME_SLOTS = [
  "07:30 - 09:00",
  "09:00 - 10:30",
  "10:30 - 12:00",
  "12:00 - 13:30",
  "13:30 - 15:00",
  "15:00 - 16:30",
  "16:30 - 18:00",
  "18:00 - 19:30",
  "19:30 - 21:00",
  "21:00 - 22:30"
];

export const PlannerStore = {
  listByDate(date: string): PlannerEntry[] {
    let list = getStore<PlannerEntry>(PLANNER_KEY);
    let dayEntries = list.filter((e) => e.date === date);
    
    // اگر روز انتخابی در آینده است و از قبل رکوردهایی دارد، بررسی می‌کنیم دست‌نخورده است یا خیر.
    // اگر دست‌نخورده بود و فاقد قالب اعمالی دستی بود، آن را حذف می‌کنیم تا با الگوی پیش‌فرض جدید لود شود.
    const todayStr = getToday();
    if (date > todayStr && dayEntries.length > 0) {
      let hasCustomApplied = false;
      if (typeof window !== "undefined" && window.localStorage) {
        hasCustomApplied = !!window.localStorage.getItem(`focusflow_custom_applied_${date}`);
      }

      if (!hasCustomApplied) {
        const isUntouched = dayEntries.every(e => {
          const isCheckedEmpty = !e.is_checked;
          const isActualEmpty = !(e.actual_main || "").trim() && 
                               !(e.actual_side || "").trim() && 
                               !(e.actual_rest || "").trim() && 
                               !(e.actual_music || "").trim();
          const isPlanEmpty = !(e.plan_main || "").trim() && 
                             !(e.plan_side || "").trim() && 
                             !(e.plan_rest || "").trim() && 
                             !(e.plan_music || "").trim() &&
                             !(e.subject || "").trim();
          const isLinkEmpty = !e.task_id && !e.habit_id && !e.custom_threshold;
          return isCheckedEmpty && isActualEmpty && isPlanEmpty && isLinkEmpty;
        });
        
        if (isUntouched) {
          // حذف رکوردهای قدیمی دست‌نخورده آینده برای تولید مجدد بر اساس الگوی جدید فعال
          list = list.filter((e) => e.date !== date);
          setStore(PLANNER_KEY, list, true);
          dayEntries = [];
        }
      }
    }

    if (dayEntries.length === 0) {
      // مقداردهی اولیه روز با بازه‌های زمانی استاندارد یا قالب پیش‌فرض
      let slotsToUse = DEFAULT_TIME_SLOTS.map((slot, index) => ({
        time_slot: slot,
        is_checked: false,
        plan_main: "",
        plan_side: "",
        plan_rest: "",
        plan_music: "",
        actual_main: "",
        actual_side: "",
        actual_rest: "",
        actual_music: "",
        subject: "",
        order: index
      }));

      if (typeof window !== "undefined") {
        const activePresetId = localStorage.getItem("focusflow_active_preset_id");
        if (activePresetId && activePresetId !== "default") {
          const presets = getStore<PlannerPreset>(PLANNER_PRESETS_KEY);
          const foundPreset = presets.find((p) => p.id === activePresetId);
          if (foundPreset && foundPreset.slots && foundPreset.slots.length > 0) {
            slotsToUse = foundPreset.slots.map((s, index) => ({
              time_slot: s.time_slot || "00:00 - 00:00",
              is_checked: false, // روز جدید همیشه غیرفعال و بدون تیک شروع می‌شود
              plan_main: s.plan_main || "",
              plan_side: s.plan_side || "",
              plan_rest: s.plan_rest || "",
              plan_music: s.plan_music || "",
              actual_main: "", // روز جدید زمان واقعی ندارد
              actual_side: "",
              actual_rest: "",
              actual_music: "",
              subject: s.subject || "",
              order: s.order !== undefined ? s.order : index
            }));
          }
        }
      }

      const newEntries: PlannerEntry[] = slotsToUse.map((slot, index) => ({
        id: generateId() + "_" + index,
        date,
        time_slot: slot.time_slot,
        is_checked: slot.is_checked,
        plan_main: slot.plan_main,
        plan_side: slot.plan_side,
        plan_rest: slot.plan_rest,
        plan_music: slot.plan_music,
        actual_main: slot.actual_main,
        actual_side: slot.actual_side,
        actual_rest: slot.actual_rest,
        actual_music: slot.actual_music,
        subject: slot.subject,
        created_date: getToday(),
        order: slot.order
      }));
      list = [...list, ...newEntries];
      setStore(PLANNER_KEY, list, true);
      return newEntries;
    }
    return dayEntries.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  },
  saveAll(list: PlannerEntry[]): void {
    setStore(PLANNER_KEY, list);
  },
  create(date: string, data: Partial<PlannerEntry>): PlannerEntry {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    const otherEntries = list.filter((e) => e.date !== date);
    const dayEntries = list
      .filter((e) => e.date === date)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    const entry: PlannerEntry = {
      id: generateId(),
      date,
      time_slot: data.time_slot || "00:00 - 00:00",
      is_checked: !!data.is_checked,
      plan_main: data.plan_main || "",
      plan_side: data.plan_side || "",
      plan_rest: data.plan_rest || "",
      plan_music: data.plan_music || "",
      actual_main: data.actual_main || "",
      actual_side: data.actual_side || "",
      actual_rest: data.actual_rest || "",
      actual_music: data.actual_music || "",
      subject: data.subject || "",
      created_date: getToday(),
      order: dayEntries.length,
    };
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`focusflow_custom_applied_${date}`, "custom");
    }
    dayEntries.push(entry);
    dayEntries.forEach((e, idx) => {
      e.order = idx;
    });
    setStore(PLANNER_KEY, [...otherEntries, ...dayEntries]);
    return entry;
  },
  insertAt(date: string, index: number, data: Partial<PlannerEntry>, afterId?: string): PlannerEntry {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    const otherEntries = list.filter((e) => e.date !== date);
    const dayEntries = list
      .filter((e) => e.date === date)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // تعیین دقیق اندیس درج: بر اساس شناسه سطر انتخاب‌شده یا ایندکس
    let insertIndex = index;
    if (afterId) {
      const foundIdx = dayEntries.findIndex((e) => e.id === afterId);
      if (foundIdx !== -1) {
        insertIndex = foundIdx + 1;
      }
    }
    insertIndex = Math.max(0, Math.min(insertIndex, dayEntries.length));

    const entry: PlannerEntry = {
      id: generateId(),
      date,
      time_slot: data.time_slot || "00:00 - 00:00",
      is_checked: !!data.is_checked,
      plan_main: data.plan_main || "",
      plan_side: data.plan_side || "",
      plan_rest: data.plan_rest || "",
      plan_music: data.plan_music || "",
      actual_main: data.actual_main || "",
      actual_side: data.actual_side || "",
      actual_rest: data.actual_rest || "",
      actual_music: data.actual_music || "",
      subject: data.subject || "",
      created_date: getToday(),
      order: insertIndex,
    };

    dayEntries.splice(insertIndex, 0, entry);

    // بازتخصیص متوالی و قطعی فیلد order برای تمام سطرهای روز جاری از 0 تا N
    dayEntries.forEach((e, idx) => {
      e.order = idx;
    });

    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`focusflow_custom_applied_${date}`, "custom");
    }

    const updatedList = [...otherEntries, ...dayEntries];
    setStore(PLANNER_KEY, updatedList);
    return entry;
  },
  get(id: string): PlannerEntry | null {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    return list.find((e) => e.id === id) || null;
  },
  reorder(date: string, sourceIndex: number, targetIndex: number): void {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    const dayEntries = list.filter((e) => e.date === date).sort((a, b) => a.order - b.order);
    
    if (sourceIndex < 0 || sourceIndex >= dayEntries.length || targetIndex < 0 || targetIndex >= dayEntries.length) {
      return;
    }
    
    // جابجایی عنصر در آرایه
    const [moved] = dayEntries.splice(sourceIndex, 1);
    dayEntries.splice(targetIndex, 0, moved);
    
    // تخصیص مجدد ترتیب از ۰ تا طول آرایه جهت تمیزی و پایداری
    dayEntries.forEach((entry, idx) => {
      entry.order = idx;
    });
    
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`focusflow_custom_applied_${date}`, "custom");
    }
    // ادغام مجدد با لیست اصلی
    const remainingList = list.filter((e) => e.date !== date);
    const newList = [...remainingList, ...dayEntries];
    setStore(PLANNER_KEY, newList);
  },
  update(id: string, data: Partial<PlannerEntry>): PlannerEntry | null {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`focusflow_custom_applied_${list[idx].date}`, "custom");
    }
    setStore(PLANNER_KEY, list);
    return list[idx];
  },
  delete(id: string): void {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    const target = list.find((e) => e.id === id);
    if (!target) return;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`focusflow_custom_applied_${target.date}`, "custom");
    }
    const otherEntries = list.filter((e) => e.date !== target.date);
    const dayEntries = list
      .filter((e) => e.date === target.date && e.id !== id)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    dayEntries.forEach((entry, idx) => {
      entry.order = idx;
    });
    setStore(PLANNER_KEY, [...otherEntries, ...dayEntries]);
  },
  replaceDayEntries(date: string, slots: any[]): PlannerEntry[] {
    const list = getStore<PlannerEntry>(PLANNER_KEY);
    const filteredList = list.filter((e) => e.date !== date);
    
    const newEntries: PlannerEntry[] = slots.map((slot, index) => ({
      id: generateId() + "_" + index + "_" + Date.now().toString(36),
      date,
      time_slot: slot.time_slot || "00:00 - 00:00",
      is_checked: !!slot.is_checked,
      plan_main: slot.plan_main || "",
      plan_side: slot.plan_side || "",
      plan_rest: slot.plan_rest || "",
      plan_music: slot.plan_music || "",
      actual_main: slot.actual_main || "",
      actual_side: slot.actual_side || "",
      actual_rest: slot.actual_rest || "",
      actual_music: slot.actual_music || "",
      subject: slot.subject || "",
      created_date: getToday(),
      order: slot.order !== undefined ? slot.order : index
    }));
    
    const updatedList = [...filteredList, ...newEntries];
    setStore(PLANNER_KEY, updatedList);
    return newEntries;
  },
  clearUntouchedFutureDays(todayDate: string): void {
    let list = getStore<PlannerEntry>(PLANNER_KEY);
    
    // پیدا کردن تمام تاریخ‌های منحصربه‌فرد که بعد از امروز هستند
    const futureDates = Array.from(new Set(
      list.filter(e => e.date > todayDate).map(e => e.date)
    ));
    
    // برای هر تاریخ آینده، بررسی می‌کنیم که آیا دست‌نخورده (فاقد عملکرد واقعی) است یا خیر
    const datesToRemove = futureDates.filter(date => {
      // اگر روی این روز در آینده، الگوی اختصاصی به طور دستی اعمال شده باشد، نباید آن را حذف کنیم تا باقی بماند
      if (typeof window !== "undefined" && window.localStorage) {
        if (window.localStorage.getItem(`focusflow_custom_applied_${date}`)) {
          return false;
        }
      }

      const dayEntries = list.filter(e => e.date === date);
      // اگر کلاً سطری نداشت، نیازی به حذف نیست
      if (dayEntries.length === 0) return false;
      
      // بررسی می‌کنیم که آیا تمام سطرها فاقد تیک و فاقد زمان واقعی هستند (یعنی دست‌نخورده از نظر اجرا)
      return dayEntries.every(e => {
        const isCheckedEmpty = !e.is_checked;
        const isActualEmpty = !(e.actual_main || "").trim() && 
                             !(e.actual_side || "").trim() && 
                             !(e.actual_rest || "").trim() && 
                             !(e.actual_music || "").trim();
        
        return isCheckedEmpty && isActualEmpty;
      });
    });
    
    if (datesToRemove.length > 0) {
      const updatedList = list.filter(e => !datesToRemove.includes(e.date));
      setStore(PLANNER_KEY, updatedList);
    }
  },
  getGlobalThreshold(): number {
    if (typeof window === "undefined" || !window.localStorage) return 80;
    const val = localStorage.getItem("focusflow_planner_threshold");
    if (!val) return 80;
    const num = parseInt(val, 10);
    return isNaN(num) ? 80 : Math.max(10, Math.min(100, num));
  },
  setGlobalThreshold(val: number): void {
    const safeVal = Math.max(10, Math.min(100, val));
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("focusflow_planner_threshold", safeVal.toString());
      window.dispatchEvent(new CustomEvent("focusflow-threshold-changed", { detail: safeVal }));
      window.dispatchEvent(new Event("focusflow-data-changed"));
    }
  },
  syncTaskAndHabit(entry: PlannerEntry, isCompleted: boolean, date: string): void {
    // ۱. هماهنگ‌سازی تسک (مدیریت تسک و کانبان)
    if (entry.task_id) {
      if (isCompleted) {
        TaskStore.update(entry.task_id, {
          status: "done",
          kanban_column: "done",
          completed_at: Date.now()
        });
      } else {
        TaskStore.update(entry.task_id, {
          status: "todo",
          kanban_column: "todo",
          completed_at: null
        });
      }
    }
    // ۲. هماهنگ‌سازی ردیاب عادت
    if (entry.habit_id) {
      const habits = HabitStore.list();
      const habit = habits.find((h) => h.id === entry.habit_id);
      if (habit) {
        const completed = new Set(habit.completed_dates || []);
        if (isCompleted) {
          completed.add(date);
        } else {
          completed.delete(date);
        }
        HabitStore.update(habit.id, {
          completed_dates: Array.from(completed)
        });
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("focusflow-data-changed"));
      window.dispatchEvent(new CustomEvent("focusflow-tasks-updated"));
      window.dispatchEvent(new CustomEvent("focusflow-habits-updated"));
    }
  }
};

export interface PlannerPreset {
  id: string;
  name: string;
  slots: {
    time_slot: string;
    is_checked: boolean;
    plan_main: string;
    plan_side?: string;
    plan_rest: string;
    plan_music?: string;
    actual_main: string;
    actual_side?: string;
    actual_rest: string;
    actual_music?: string;
    subject: string;
    order: number;
  }[];
}

const PLANNER_PRESETS_KEY = "focusflow_planner_presets";

export const PlannerPresetStore = {
  list(): PlannerPreset[] {
    return getStore<PlannerPreset>(PLANNER_PRESETS_KEY);
  },
  save(name: string, slots: PlannerPreset["slots"]): PlannerPreset {
    const list = getStore<PlannerPreset>(PLANNER_PRESETS_KEY);
    const preset: PlannerPreset = {
      id: generateId(),
      name,
      slots: slots.map(s => ({
        time_slot: s.time_slot,
        is_checked: s.is_checked,
        plan_main: s.plan_main,
        plan_side: s.plan_side,
        plan_rest: s.plan_rest,
        plan_music: s.plan_music || "",
        actual_main: s.actual_main,
        actual_side: s.actual_side,
        actual_rest: s.actual_rest,
        actual_music: s.actual_music || "",
        subject: s.subject,
        order: s.order
      }))
    };
    list.push(preset);
    setStore(PLANNER_PRESETS_KEY, list);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("focusflow-planner-presets-changed"));
    }
    return preset;
  },
  delete(id: string): void {
    const list = getStore<PlannerPreset>(PLANNER_PRESETS_KEY).filter((p) => p.id !== id);
    setStore(PLANNER_PRESETS_KEY, list);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("focusflow-planner-presets-changed"));
    }
  }
};

export interface BitterMemory {
  id: string;
  title: string;
  description: string;
  is_pinned: boolean;
  created_at: number;
}

const MEMORIES_KEY = "focusflow_memories";
const KONKUR_DATE_KEY = "focusflow_konkur_date";
const FINAL_EXAMS_DATE_KEY = "focusflow_final_exams_date";

export const MotivationStore = {
  getMemories(): BitterMemory[] {
    const memories = getStore<BitterMemory>(MEMORIES_KEY);
    return memories.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return b.created_at - a.created_at;
    });
  },
  
  addMemory(title: string, description: string): BitterMemory {
    const memory: BitterMemory = {
      id: generateId(),
      title,
      description,
      is_pinned: false,
      created_at: Date.now()
    };
    const list = getStore<BitterMemory>(MEMORIES_KEY);
    list.unshift(memory);
    setStore(MEMORIES_KEY, list);
    return memory;
  },
  
  deleteMemory(id: string): void {
    const list = getStore<BitterMemory>(MEMORIES_KEY).filter((m) => m.id !== id);
    setStore(MEMORIES_KEY, list);
  },
  
  togglePinMemory(id: string): void {
    const list = getStore<BitterMemory>(MEMORIES_KEY);
    const idx = list.findIndex((m) => m.id === id);
    if (idx !== -1) {
      list[idx].is_pinned = !list[idx].is_pinned;
      setStore(MEMORIES_KEY, list);
    }
  },
  
  getKonkurDate(): string {
    return localStorage.getItem(KONKUR_DATE_KEY) || "2027-06-25";
  },
  
  setKonkurDate(date: string): void {
    localStorage.setItem(KONKUR_DATE_KEY, date);
    window.dispatchEvent(new CustomEvent("motivation-updated"));
  },
  
  getFinalExamsDate(): string {
    return localStorage.getItem(FINAL_EXAMS_DATE_KEY) || "2027-05-20";
  },
  
  setFinalExamsDate(date: string): void {
    localStorage.setItem(FINAL_EXAMS_DATE_KEY, date);
    window.dispatchEvent(new CustomEvent("motivation-updated"));
  }
};

export const BACKUP_KEYS = [
  "focusflow_tasks",
  "focusflow_recurring_activities",
  "focusflow_habits",
  "focusflow_habit_groups",
  "focusflow_topics",
  "focusflow_quiz_subjects",
  "focusflow_quiz_entries",
  "focusflow_timeline_entries",
  "focusflow_notes",
  "focusflow_memories",
  "focusflow_going_up_settings",
  "focusflow_going_up_state",
  "focusflow_going_up_evaluated_days",
  "focusflow_planner",
  "focusflow_planner_presets",
  "focusflow_planner_threshold"
];

export function exportDatabase(): string {
  const data: Record<string, any> = {};
  BACKUP_KEYS.forEach((key) => {
    try {
      const val = localStorage.getItem(key);
      if (val) {
        data[key] = JSON.parse(val);
      } else {
        data[key] = (key === "focusflow_going_up_settings" || key === "focusflow_going_up_state") ? {} : [];
      }
    } catch {
      data[key] = (key === "focusflow_going_up_settings" || key === "focusflow_going_up_state") ? {} : [];
    }
  });
  data["focusflow_konkur_date"] = localStorage.getItem("focusflow_konkur_date") || "2027-06-25";
  data["focusflow_final_exams_date"] = localStorage.getItem("focusflow_final_exams_date") || "2027-05-20";
  data["focusflow_active_preset_id"] = localStorage.getItem("focusflow_active_preset_id") || "default";
  data["focusflow_safe_mode"] = localStorage.getItem("focusflow_safe_mode") || "true";
  data["focusflow-theme"] = localStorage.getItem("focusflow-theme") || "dark";

  // همگام‌سازی وضعیت زنده تایمر پلنر بین تمام دستگاه‌ها
  const activeTimerRaw = localStorage.getItem("focusflow_active_planner_timer");
  data["focusflow_active_planner_timer"] = activeTimerRaw ? JSON.parse(activeTimerRaw) : null;

  return JSON.stringify(data, null, 2);
}

export function importDatabase(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== "object" || parsed === null) return false;
    
    BACKUP_KEYS.forEach((key) => {
      if (parsed[key] !== undefined) {
        if (Array.isArray(parsed[key]) || typeof parsed[key] === "object") {
          localStorage.setItem(key, JSON.stringify(parsed[key]));
        }
      }
    });
    if (parsed["focusflow_konkur_date"]) {
      localStorage.setItem("focusflow_konkur_date", parsed["focusflow_konkur_date"]);
    }
    if (parsed["focusflow_final_exams_date"]) {
      localStorage.setItem("focusflow_final_exams_date", parsed["focusflow_final_exams_date"]);
    }
    if (parsed["focusflow_active_preset_id"]) {
      localStorage.setItem("focusflow_active_preset_id", parsed["focusflow_active_preset_id"]);
    }
    if (parsed["focusflow_safe_mode"]) {
      localStorage.setItem("focusflow_safe_mode", parsed["focusflow_safe_mode"]);
    }
    if (parsed["focusflow-theme"]) {
      localStorage.setItem("focusflow-theme", parsed["focusflow-theme"]);
    }

    // همگام‌سازی بلادرنگ تایمر فعال پلنر
    if ("focusflow_active_planner_timer" in parsed) {
      const prevTimerRaw = localStorage.getItem("focusflow_active_planner_timer");
      const newTimer = parsed["focusflow_active_planner_timer"];
      const newTimerStr = newTimer ? JSON.stringify(newTimer) : null;

      if (prevTimerRaw !== newTimerStr) {
        if (newTimerStr) {
          localStorage.setItem("focusflow_active_planner_timer", newTimerStr);
        } else {
          localStorage.removeItem("focusflow_active_planner_timer");
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("focusflow-planner-timer-change", { detail: newTimer || null }));
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function confirmAndDelete(title: string, onConfirm: () => void) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("request-delete", {
      detail: { title, onConfirm }
    }));
  } else {
    onConfirm();
  }
}

