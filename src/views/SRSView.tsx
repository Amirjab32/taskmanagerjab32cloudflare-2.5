import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Plus, Trash2, BookOpen, Settings2, Calendar as CalendarIcon, List, GripVertical, CheckCircle2 } from "lucide-react";
import { StudyTopic } from "@/lib/store";
import { getGregorianToday, toShamsiShort, toPersianDigits, gregorianToJalali, toShamsi } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import JalaliCalendar, { DayMeta } from "@/components/shared/JalaliCalendar";

interface Props {
  topics: StudyTopic[];
  onAdd: (data: { title: string; description?: string; total_stages: number }) => void;
  onReview: (topic: StudyTopic) => void;
  onDelete: (id: string) => void;
  onUpdateTopic?: (id: string, data: Partial<StudyTopic>) => void;
}

const ALL_INTERVALS = [1, 3, 7, 14, 30, 60];
const DEFAULT_STAGES = 4;
const STAGE_OPTIONS = [
  { value: 2, label: "۲ مرحله", sub: "۱، ۳ روز" },
  { value: 3, label: "۳ مرحله", sub: "۱، ۳، ۷ روز" },
  { value: 4, label: "۴ مرحله", sub: "۱، ۳، ۷، ۱۴ روز" },
  { value: 5, label: "۵ مرحله", sub: "۱، ۳، ۷، ۱۴، ۳۰ روز" },
  { value: 6, label: "۶ مرحله", sub: "۱، ۳، ۷، ۱۴، ۳۰، ۶۰ روز" },
];

export default function SRSView({ topics, onAdd, onReview, onDelete, onUpdateTopic }: Props) {
  const { fg, fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [activeTab, setActiveTab] = useState<"list" | "calendar">("list");
  
  // States for adding a topic
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedStages, setSelectedStages] = useState(DEFAULT_STAGES);

  // Jalali Calendar states
  const now = new Date();
  const [todayJY, todayJM] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [jy, setJy] = useState(todayJY);
  const [jm, setJm] = useState(todayJM);
  
  const today = getGregorianToday();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);

  // Sidebar panel tab inside the calendar view
  const [panelTab, setPanelTab] = useState<"day-reviews" | "backlog">("day-reviews");

  const isCompleted = (topic: StudyTopic) => topic.review_count >= (topic.total_stages ?? DEFAULT_STAGES);

  const activeTopics = topics.filter((t) => !isCompleted(t));
  const completedTopics = topics.filter((t) => isCompleted(t));

  const dueTodayTopics = activeTopics.filter((t) => !t.next_review_date || t.next_review_date <= today);
  const futureTopics = activeTopics.filter((t) => t.next_review_date && t.next_review_date > today);

  // Map active topics by their due date for instant O(1) calendar querying
  const srsByDate: Record<string, StudyTopic[]> = {};
  activeTopics.forEach((topic) => {
    const dueDate = topic.next_review_date || today; // Overdue or undated default to today
    if (!srsByDate[dueDate]) {
      srsByDate[dueDate] = [];
    }
    srsByDate[dueDate].push(topic);
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({ title: newTitle.trim(), description: newDesc.trim() || undefined, total_stages: selectedStages });
    setNewTitle("");
    setNewDesc("");
    setSelectedStages(DEFAULT_STAGES);
    setShowForm(false);
  };

  const getIntervals = (topic: StudyTopic) => ALL_INTERVALS.slice(0, topic.total_stages ?? DEFAULT_STAGES);

  const handlePrevMonth = () => {
    setJm((m) => {
      if (m === 1) {
        setJy((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  };

  const handleNextMonth = () => {
    setJm((m) => {
      if (m === 12) {
        setJy((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  };

  // Drag and drop events
  const handleDragStart = (e: React.DragEvent, topicId: string) => {
    e.dataTransfer.setData("text/plain", topicId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, _dayNum: number, meta: DayMeta) => {
    e.preventDefault();
    if (draggedOverDate !== meta.gregDate) {
      setDraggedOverDate(meta.gregDate);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, _dayNum: number, meta: DayMeta) => {
    e.preventDefault();
    setDraggedOverDate(null);
    const id = e.dataTransfer.getData("text/plain");
    if (id && onUpdateTopic) {
      onUpdateTopic(id, { next_review_date: meta.gregDate });
    }
  };

  // Render function for each day cell of the JalaliCalendar
  const renderDayCell = (dayNum: number, meta: DayMeta) => {
    // Overdue items are mapped to today, so we query correctly
    const dayReviews = srsByDate[meta.gregDate] || [];
    const count = dayReviews.length;
    const isSelected = meta.gregDate === selectedDate;
    const isToday = meta.gregDate === today;
    const isDraggedOver = draggedOverDate === meta.gregDate;

    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center rounded-xl p-1 transition-all duration-300"
        style={{
          border: isDraggedOver
            ? "2px dashed #10b981"
            : isSelected
            ? "2px solid #6366f1"
            : isToday
            ? "2px solid rgba(129,140,248,0.5)"
            : `1px solid ${cardBorder}`,
          backgroundColor: isDraggedOver
            ? "rgba(16,185,129,0.12)"
            : isSelected
            ? "rgba(99,102,241,0.12)"
            : isToday
            ? "rgba(129,140,248,0.06)"
            : cardBg,
          color: isSelected ? "#818cf8" : fg,
        }}
      >
        <span className="text-xs font-bold select-none">{toPersianDigits(dayNum)}</span>
        {count > 0 && (
          <span
            className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: isToday ? "#ef4444" : "#6366f1",
              boxShadow: isToday ? "0 0 6px #ef4444" : "0 0 6px #6366f1",
            }}
          />
        )}
        {count > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold transition-all duration-300"
            style={{
              backgroundColor: isToday ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
              color: isToday ? "#f87171" : "#818cf8",
            }}
          >
            {toPersianDigits(count)}
          </span>
        )}
      </div>
    );
  };

  // Determine what is displayed in selected day's panel
  const currentPanelTopics = selectedDate === today ? dueTodayTopics : (srsByDate[selectedDate] || []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Tab Switcher & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: fg }}>جعبه لایتنر هوشمند</h1>
            <p className="text-xs" style={{ color: fgMuted }}>برنامه‌ریزی مرورهای فاصله‌دار علمی براساس الگوریتم تکرار</p>
          </div>
        </div>

        {/* Beautiful Segmented Tab Controller */}
        <div className="flex rounded-xl p-1 text-sm font-medium self-start sm:self-auto" style={{ backgroundColor: "rgba(128,128,128,0.06)", border: `1px solid ${cardBorder}` }}>
          <button
            onClick={() => setActiveTab("list")}
            className="flex items-center gap-2 rounded-lg px-4 py-1.5 transition-all cursor-pointer"
            style={{
              backgroundColor: activeTab === "list" ? cardBg : "transparent",
              color: activeTab === "list" ? fg : fgMuted,
              boxShadow: activeTab === "list" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <List className="h-4 w-4" />
            <span>لیست موضوعات</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className="flex items-center gap-2 rounded-lg px-4 py-1.5 transition-all cursor-pointer"
            style={{
              backgroundColor: activeTab === "calendar" ? cardBg : "transparent",
              color: activeTab === "calendar" ? fg : fgMuted,
              boxShadow: activeTab === "calendar" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>تقویم SRS</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "list" ? (
          /* ================= LIST VIEW ================= */
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                <span className="text-sm" style={{ color: fgMuted }}>
                  {toPersianDigits(dueTodayTopics.length)} موضوع آماده برای مرور
                </span>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-600"
                style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.2)" }}
              >
                <Plus className="h-4 w-4" />
                موضوع جدید
              </button>
            </div>

            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 rounded-2xl p-4"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
                >
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="عنوان موضوع..."
                    autoFocus
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                  />
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="توضیحات (اختیاری)..."
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" style={{ color: fgMuted }} />
                      <span className="text-xs font-semibold" style={{ color: fgMuted }}>تعداد مراحل مرور</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {STAGE_OPTIONS.map(({ value, label, sub }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedStages(value)}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-right transition-all cursor-pointer"
                          style={{
                            border: `1px solid ${selectedStages === value ? "#6366f1" : cardBorder}`,
                            backgroundColor: selectedStages === value ? "rgba(99,102,241,0.12)" : "transparent",
                            color: selectedStages === value ? "#818cf8" : fgMuted,
                          }}
                        >
                          <span className="text-xs font-semibold">{label}</span>
                          <span className="text-[11px] opacity-70">{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setSelectedStages(DEFAULT_STAGES);
                      }}
                      className="rounded-xl px-4 py-2 text-xs transition-colors cursor-pointer"
                      style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}
                    >
                      لغو
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={!newTitle.trim()}
                      className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      افزودن
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overdue/Today section */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                <h2 className="text-sm font-semibold" style={{ color: fg }}>
                  آماده برای مرور امروز ({toPersianDigits(dueTodayTopics.length)})
                </h2>
              </div>
              {dueTodayTopics.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl p-6 text-center text-sm"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}
                >
                  مروری برای امروز نداری 🎉
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AnimatePresence>
                    {dueTodayTopics.map((topic) => {
                      const intervals = getIntervals(topic);
                      const completed = isCompleted(topic);
                      const currentStageIdx = Math.min(topic.review_count, intervals.length - 1);
                      return (
                        <motion.div
                          key={topic.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="rounded-xl p-4 flex flex-col justify-between transition-all"
                          style={{
                            border: `1px solid ${completed ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.2)"}`,
                            backgroundColor: completed ? "rgba(16,185,129,0.03)" : "rgba(244,63,94,0.03)",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: completed ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
                              }}
                            >
                              <Brain className="h-5 w-5" style={{ color: completed ? "#34d399" : "#f87171" }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm" style={{ color: fg }}>{topic.title}</p>
                              {topic.description && (
                                <p className="mt-0.5 text-xs" style={{ color: fgMuted }}>{topic.description}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1">
                                {intervals.map((interval, i) => (
                                  <div
                                    key={i}
                                    className="flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[10px]"
                                    style={{
                                      backgroundColor:
                                        i < topic.review_count
                                          ? "rgba(99,102,241,0.2)"
                                          : i === currentStageIdx && !completed
                                          ? "rgba(244,63,94,0.2)"
                                          : "rgba(128,128,128,0.1)",
                                      color:
                                        i < topic.review_count
                                          ? "#818cf8"
                                          : i === currentStageIdx && !completed
                                          ? "#f87171"
                                          : fgMuted,
                                    }}
                                  >
                                    {toPersianDigits(interval)}ر
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: fgMuted }}>
                                <span>
                                  {completed
                                    ? "✅ تمام مراحل کامل شد"
                                    : `مرحله ${toPersianDigits(topic.review_count + 1)} از ${toPersianDigits(
                                        intervals.length
                                      )}`}
                                </span>
                                {!completed && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      مرور بعدی:{" "}
                                      {topic.next_review_date ? toShamsiShort(topic.next_review_date) : "امروز"}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-2" style={{ borderColor: `${cardBorder}55` }}>
                            <button
                              onClick={() => onDelete(topic.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-500/15 transition-colors cursor-pointer"
                              style={{ color: fgMuted }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "#f87171";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = fgMuted;
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {!completed && (
                              <button
                                onClick={() => onReview(topic)}
                                className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 transition-colors cursor-pointer"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                مرور کردم
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Future/Scheduled section */}
            {futureTopics.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  <h2 className="text-sm font-semibold" style={{ color: fg }}>
                    آینده ({toPersianDigits(futureTopics.length)})
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AnimatePresence>
                    {futureTopics.map((topic) => {
                      const intervals = getIntervals(topic);
                      return (
                        <motion.div
                          key={topic.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="rounded-xl p-4 flex flex-col justify-between"
                          style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: "rgba(99,102,241,0.15)" }}
                            >
                              <Brain className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm" style={{ color: fg }}>{topic.title}</p>
                              {topic.description && (
                                <p className="mt-0.5 text-xs" style={{ color: fgMuted }}>{topic.description}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1">
                                {intervals.map((interval, i) => (
                                  <div
                                    key={i}
                                    className="flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[10px]"
                                    style={{
                                      backgroundColor:
                                        i < topic.review_count ? "rgba(99,102,241,0.2)" : "rgba(128,128,128,0.1)",
                                      color: i < topic.review_count ? "#818cf8" : fgMuted,
                                    }}
                                  >
                                    {toPersianDigits(interval)}ر
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-[11px]" style={{ color: fgMuted }}>
                                <span>
                                  مرور بعدی: {topic.next_review_date ? toShamsiShort(topic.next_review_date) : "—"}
                                </span>
                                <span>·</span>
                                <span>
                                  مرحله {toPersianDigits(topic.review_count + 1)} از {toPersianDigits(intervals.length)}
                                </span>
                                <span>·</span>
                                <span>هر {toPersianDigits(topic.current_interval)} روز</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-end border-t pt-2" style={{ borderColor: `${cardBorder}55` }}>
                            <button
                              onClick={() => onDelete(topic.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-500/15 transition-colors cursor-pointer"
                              style={{ color: fgMuted }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "#f87171";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = fgMuted;
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Completed section */}
            {completedTopics.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-semibold" style={{ color: fg }}>
                    موضوعات کامل شده ({toPersianDigits(completedTopics.length)})
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AnimatePresence>
                    {completedTopics.map((topic) => {
                      return (
                        <motion.div
                          key={topic.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="rounded-xl p-4 flex flex-col justify-between"
                          style={{
                            border: `1px solid rgba(16,185,129,0.25)`,
                            backgroundColor: "rgba(16,185,129,0.03)",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
                            >
                              <Brain className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm line-through" style={{ color: fgMuted }}>
                                {topic.title}
                              </p>
                              {topic.description && (
                                <p className="mt-0.5 text-xs line-through" style={{ color: fgMuted }}>
                                  {topic.description}
                                </p>
                              )}
                              <p className="mt-2 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                تمام {toPersianDigits(topic.total_stages)} مرحله مرور کامل شد!
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-end border-t pt-2" style={{ borderColor: `${cardBorder}55` }}>
                            <button
                              onClick={() => onDelete(topic.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-500/15 transition-colors cursor-pointer"
                              style={{ color: fgMuted }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "#f87171";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = fgMuted;
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {topics.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3 rounded-xl p-12 text-center"
                style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
              >
                <Brain className="mx-auto h-12 w-12" style={{ color: `${fgMuted}44` }} />
                <p className="text-sm font-medium" style={{ color: fgMuted }}>هنوز موضوعی اضافه نکردی</p>
              </motion.div>
            )}

            {/* Intervals info card */}
            <div className="rounded-xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="mb-2 text-xs font-bold" style={{ color: fgMuted }}>
                فاصله‌های زمانی تکرار لایتنر
              </h3>
              <div className="flex flex-wrap gap-2">
                {ALL_INTERVALS.map((interval, i) => (
                  <span
                    key={interval}
                    className="rounded-lg px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: "rgba(99,102,241,0.08)", color: "#818cf8" }}
                  >
                    مرحله {toPersianDigits(i + 1)}: {toPersianDigits(interval)} روز
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ================= CALENDAR VIEW ================= */
          <motion.div
            key="calendar-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-6 md:grid-cols-12"
          >
            {/* The Integrated Jalali Calendar Column */}
            <div
              className="rounded-2xl p-4 md:col-span-7 flex flex-col justify-between"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold" style={{ color: fg }}>تقویم زمان‌بندی هوشمند</h3>
                  <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-400">
                    امروز: {toShamsiShort(today)}
                  </span>
                </div>
                <JalaliCalendar
                  jy={jy}
                  jm={jm}
                  onPrev={handlePrevMonth}
                  onNext={handleNextMonth}
                  canNext={true} // Allow scheduling reviews into the infinite future!
                  todayGreg={today}
                  selectedGreg={selectedDate}
                  renderDay={renderDayCell}
                  onDayClick={(_, meta) => setSelectedDate(meta.gregDate)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              </div>

              {/* Drag instruction notice */}
              <div className="mt-6 border-t pt-3 text-[11px] leading-relaxed" style={{ borderColor: `${cardBorder}55`, color: fgMuted }}>
                💡 <strong>آموزش کشیدن و رها کردن (Drag & Drop):</strong> کارتی را از بخش <span className="font-semibold text-indigo-400">«همه فعالان»</span> یا <span className="font-semibold text-indigo-400">«مرورهای روز»</span> بکشید و روی یکی از خانه‌های تقویم رها کنید تا تاریخ مرور آن تغییر کند.
              </div>
            </div>

            {/* Sidebar Details and Backlog Control Column */}
            <div className="flex flex-col gap-4 md:col-span-5">
              {/* Local Sub Tabs for Panel */}
              <div className="flex rounded-xl p-1 text-xs font-semibold" style={{ backgroundColor: "rgba(128,128,128,0.06)", border: `1px solid ${cardBorder}` }}>
                <button
                  onClick={() => setPanelTab("day-reviews")}
                  className="flex-1 rounded-lg py-2 transition-all text-center cursor-pointer"
                  style={{
                    backgroundColor: panelTab === "day-reviews" ? cardBg : "transparent",
                    color: panelTab === "day-reviews" ? fg : fgMuted,
                  }}
                >
                  مرورهای روز ({toPersianDigits(currentPanelTopics.length)})
                </button>
                <button
                  onClick={() => setPanelTab("backlog")}
                  className="flex-1 rounded-lg py-2 transition-all text-center cursor-pointer"
                  style={{
                    backgroundColor: panelTab === "backlog" ? cardBg : "transparent",
                    color: panelTab === "backlog" ? fg : fgMuted,
                  }}
                >
                  همه فعالان ({toPersianDigits(activeTopics.length)})
                </button>
              </div>

              {/* Panel Container */}
              <div
                className="flex-1 rounded-2xl p-4 min-h-[350px] flex flex-col justify-between"
                style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
              >
                <div className="space-y-4">
                  {panelTab === "day-reviews" ? (
                    <>
                      {/* Day Reviews Header */}
                      <div className="border-b pb-2" style={{ borderColor: `${cardBorder}55` }}>
                        <h3 className="text-xs font-bold" style={{ color: fg }}>
                          مرورهای برنامه ریزی شده
                        </h3>
                        <p className="mt-1 text-[11px]" style={{ color: fgMuted }}>
                          تاریخ: <span className="font-semibold text-indigo-400">{toShamsi(selectedDate)}</span>
                        </p>
                      </div>

                      {/* Day Reviews List */}
                      <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-0.5">
                        {currentPanelTopics.length === 0 ? (
                          <div className="py-12 text-center text-xs" style={{ color: fgMuted }}>
                            <p>موضوعی برای این روز برنامه‌ریزی نشده است.</p>
                            <p className="mt-1.5 opacity-70">یک موضوع فعال را از زبانه «همه فعالان» به داخل تقویم بکشید.</p>
                          </div>
                        ) : (
                          currentPanelTopics.map((topic) => {
                            const intervals = getIntervals(topic);
                            const completed = isCompleted(topic);
                            return (
                              <div
                                key={topic.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, topic.id)}
                                className="rounded-xl p-3 border border-dashed transition-all hover:scale-[1.01] active:opacity-60 bg-white/5 cursor-grab flex items-start gap-2 justify-between"
                                style={{ borderColor: cardBorder }}
                              >
                                <div className="min-w-0 flex-1 flex gap-2">
                                  <div className="mt-1 flex-shrink-0 cursor-grab text-gray-500 hover:text-gray-300">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate" style={{ color: fg }}>
                                      {topic.title}
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: fgMuted }}>
                                      مرحله {toPersianDigits(topic.review_count + 1)} از {toPersianDigits(intervals.length)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {!completed && (
                                    <button
                                      onClick={() => onReview(topic)}
                                      className="h-6 rounded bg-rose-500 px-2 text-[10px] font-semibold text-white hover:bg-rose-600 transition-colors cursor-pointer"
                                      title="مرور کردم"
                                    >
                                      مرور
                                    </button>
                                  )}
                                  <button
                                    onClick={() => onDelete(topic.id)}
                                    className="p-1 rounded text-gray-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Backlog Header */}
                      <div className="border-b pb-2" style={{ borderColor: `${cardBorder}55` }}>
                        <h3 className="text-xs font-bold animate-pulse" style={{ color: fg }}>
                          بانک تمام موضوعات فعال لایتنر
                        </h3>
                        <p className="mt-1 text-[11px]" style={{ color: fgMuted }}>
                          کارتی را انتخاب کرده و بر روی یکی از روزهای تقویم رها کنید.
                        </p>
                      </div>

                      {/* Backlog List */}
                      <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-0.5">
                        {activeTopics.length === 0 ? (
                          <div className="py-12 text-center text-xs" style={{ color: fgMuted }}>
                            هیچ موضوع فعال و ناتمامی وجود ندارد. موضوع جدید بسازید!
                          </div>
                        ) : (
                          activeTopics.map((topic) => {
                            return (
                              <div
                                key={topic.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, topic.id)}
                                className="rounded-xl p-3 border border-dashed transition-all hover:scale-[1.01] active:opacity-60 bg-white/5 cursor-grab flex items-start gap-2 justify-between"
                                style={{ borderColor: cardBorder }}
                              >
                                <div className="min-w-0 flex-1 flex gap-2">
                                  <div className="mt-1 flex-shrink-0 cursor-grab text-gray-500 hover:text-gray-300">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate" style={{ color: fg }}>
                                      {topic.title}
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: fgMuted }}>
                                      تاریخ مرور فعلی: {topic.next_review_date ? toShamsiShort(topic.next_review_date) : "برنامه‌ریزی نشده"} · مرحله {toPersianDigits(topic.review_count + 1)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => onDelete(topic.id)}
                                    className="p-1 rounded text-gray-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
