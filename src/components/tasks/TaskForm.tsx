import { useState, useEffect, useRef } from "react";
import { Plus, X, Star, Hash, Tag, ChevronDown, MessageSquare, Trash2 } from "lucide-react";
import {
  getGregorianToday,
  getTodayJalali,
  gregorianToJalali,
  toPersianDigits,
  toShamsiShort,
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import JalaliCalendar from "@/components/shared/JalaliCalendar";
import type { DayMeta } from "@/components/shared/JalaliCalendar";
import { RecurringActivity, RecurringActivityStore } from "@/lib/store";
import DelayedTagDelete from "@/components/shared/DelayedTagDelete";
import DeleteConfirmationModal from "@/components/shared/DeleteConfirmationModal";

interface Props {
  onAdd: (data: {
    title: string;
    priority: "low" | "medium" | "high";
    scheduled_date: string;
    comment?: string;
    tags?: string[];
    activity_id?: string | null;
  }) => void;
  activities: RecurringActivity[];
}

const PRIORITIES = [
  { value: "low" as const, label: "کم", color: "#10b981" },
  { value: "medium" as const, label: "متوسط", color: "#f59e0b" },
  { value: "high" as const, label: "زیاد", color: "#f43f5e" },
];

const ACTIVITY_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b",
  "#06b6d4", "#ef4444", "#8b5cf6", "#f97316", "#14b8a6",
];

export default function TaskForm({ onAdd, activities }: Props) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [selectedDate, setSelectedDate] = useState(getGregorianToday());
  const [showCal, setShowCal] = useState(false);
  const [comment, setComment] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showExtra, setShowExtra] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showNewActivityForm, setShowNewActivityForm] = useState(false);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityColor, setNewActivityColor] = useState(ACTIVITY_COLORS[0]);
  const calRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const actRef = useRef<HTMLDivElement>(null);
  const todayGreg = getGregorianToday();
  const selJalali = gregorianToJalali(
    ...(selectedDate.split("-").map(Number) as [number, number, number])
  );
  const [calJy, setCalJy] = useState(selJalali[0]);
  const [calJm, setCalJm] = useState(selJalali[1]);

  const [activityToDelete, setActivityToDelete] = useState<RecurringActivity | null>(null);

  const handleDeleteActivity = (act: RecurringActivity) => {
    const isSafeMode = localStorage.getItem("focusflow_safe_mode") !== "false";
    if (isSafeMode) {
      setActivityToDelete(act);
    } else {
      executeDeleteActivity(act.id);
    }
  };

  const executeDeleteActivity = (id: string) => {
    RecurringActivityStore.delete(id);
    if (selectedActivityId === id) {
      setSelectedActivityId(null);
    }
    window.dispatchEvent(new CustomEvent("activities-updated"));
    window.dispatchEvent(new CustomEvent("focusflow-data-changed"));
    setActivityToDelete(null);
  };

  useEffect(() => {
    if (!showCal) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        calRef.current && !calRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setShowCal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCal]);

  useEffect(() => {
    if (!showActivityPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actRef.current && !actRef.current.contains(e.target as Node)) {
        setShowActivityPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActivityPicker]);

  const prevMonth = () => {
    if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1);
  };
  const nextMonth = () => {
    if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1);
  };

  const handleDayClick = (_day: number, meta: DayMeta) => {
    setSelectedDate(meta.gregDate);
    setShowCal(false);
  };

  const addTag = (raw?: string) => {
    const cleaned = (raw ?? tagInput).replace(/^#+/, "").trim();
    if (!cleaned) return;
    if (!tags.includes(cleaned)) {
      const newTags = [...tags, cleaned];
      setTags(newTags);
      if (selectedActivityId) {
        RecurringActivityStore.addTag(selectedActivityId, cleaned);
      }
    }
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleRemovePermanentTag = (tag: string) => {
    if (!selectedActivityId) return;
    RecurringActivityStore.removeTag(selectedActivityId, tag);
    window.dispatchEvent(new CustomEvent("activities-updated"));
  };

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const activitySavedTags = selectedActivity?.tags ?? [];
  const suggestedTags = activitySavedTags.filter((t) => !tags.includes(t));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = selectedActivity ? selectedActivity.name : title.trim();
    if (!finalTitle) return;

    // استخراج خودکار هر متنی که در کادر هشتگ نوشته شده حتی اگر کاربر قبل از ثبت، کلید اینتر را نزده باشد
    const finalTags = [...tags];
    if (tagInput.trim()) {
      const parts = tagInput.trim().split(/[ ,，،\n\r\t\u00a0]+/);
      parts.forEach((p) => {
        const cleaned = p.replace(/^#+/, "").trim();
        if (cleaned && !finalTags.includes(cleaned)) {
          finalTags.push(cleaned);
        }
      });
    }

    onAdd({
      title: finalTitle,
      priority,
      scheduled_date: selectedDate,
      comment: comment.trim() || undefined,
      tags: finalTags.length > 0 ? finalTags : undefined,
      activity_id: selectedActivityId,
    });
    setTitle("");
    setPriority("medium");
    setSelectedDate(getGregorianToday());
    setComment("");
    setTags([]);
    setTagInput("");
    setSelectedActivityId(null);
    setShowExtra(false);
    const tj = getTodayJalali();
    setCalJy(tj[0]);
    setCalJm(tj[1]);
  };

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-4"
        style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
      >
        <div className="flex flex-col gap-3">
          {selectedActivity ? (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ border: `1px solid ${selectedActivity.color}55`, backgroundColor: `${selectedActivity.color}12` }}
            >
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedActivity.color }} />
              <span className="flex-1 text-sm font-semibold" style={{ color: selectedActivity.color }}>
                {selectedActivity.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedActivityId(null)}
                className="text-xs opacity-60 hover:opacity-100"
                style={{ color: selectedActivity.color }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="تسک جدید اضافه کن..."
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-xl p-1"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}
            >
              {PRIORITIES.map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    backgroundColor: priority === value ? "rgba(128,128,128,0.15)" : "transparent",
                    color: priority === value ? fg : fgMuted,
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </button>
              ))}
            </div>
            <button
              ref={btnRef}
              type="button"
              onClick={() => setShowCal((s) => !s)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}
            >
              📅 {toShamsiShort(selectedDate)}
            </button>
            <button
              type="button"
              onClick={() => setShowActivityPicker((s) => !s)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all"
              style={{
                border: `1px solid ${selectedActivityId ? "#6366f1" : cardBorder}`,
                backgroundColor: selectedActivityId ? "rgba(99,102,241,0.12)" : cardBg,
                color: selectedActivityId ? "#818cf8" : fgMuted,
              }}
            >
              <Star className="h-3.5 w-3.5" />
              {selectedActivityId ? "اکتیویتی انتخاب شد" : "اکتیویتی همیشگی"}
              <ChevronDown className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setShowExtra((s) => !s)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}
            >
              <Hash className="h-3.5 w-3.5" />
              {showExtra ? "کمتر" : "هشتگ / کامنت"}
            </button>
            <button
              type="submit"
              disabled={!selectedActivity && !title.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.2)" }}
            >
              <Plus className="h-4 w-4" />
              افزودن
            </button>
          </div>
          {showExtra && (
            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 flex-shrink-0 mt-2" style={{ color: fgMuted }} />
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-xl px-3 py-1.5"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                    {tags.map((t) => (
                      <span key={t} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                        #{t}
                        <button type="button" onClick={() => removeTag(t)} className="hover:opacity-70">
                          <X className="h-3 w-3" />
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
                              addTag(tag.trim());
                            }
                          });
                          setTagInput(remaining);
                        } else {
                          setTagInput(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addTag(); }
                      }}
                      placeholder="هشتگ بزن (Enter)..."
                      className="min-w-[120px] flex-1 bg-transparent text-xs outline-none"
                      style={{ color: fg }}
                    />
                  </div>
                  {suggestedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1 items-center">
                      <span className="text-[10px]" style={{ color: fgMuted }}>هشتگ‌های قبلی:</span>
                      {suggestedTags.map((t) => (
                        <div
                          key={t}
                          className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all"
                          style={{
                            backgroundColor: selectedActivity ? `${selectedActivity.color}20` : "rgba(99,102,241,0.1)",
                            color: selectedActivity ? selectedActivity.color : "#818cf8",
                            border: `1px solid ${selectedActivity ? `${selectedActivity.color}40` : "rgba(99,102,241,0.3)"}`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => addTag(t)}
                            className="flex items-center gap-1 hover:opacity-80"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            #{t}
                          </button>
                          <DelayedTagDelete
                            onDelete={() => handleRemovePermanentTag(t)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 flex-shrink-0 mt-2" style={{ color: fgMuted }} />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="کامنت / توضیح..."
                  rows={2}
                  className="flex-1 resize-none rounded-xl px-3 py-2 text-xs outline-none"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Calendar dropdown */}
      {showCal && (
        <div
          ref={calRef}
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl p-4 shadow-2xl"
          style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }}
          dir="rtl"
        >
          <JalaliCalendar
            jy={calJy}
            jm={calJm}
            onPrev={prevMonth}
            onNext={nextMonth}
            canNext={true}
            todayGreg={todayGreg}
            selectedGreg={selectedDate}
            onDayClick={handleDayClick}
            renderDay={(day, meta) => {
              const bg2 = meta.isSelected
                ? "#6366f1"
                : meta.isToday
                  ? "rgba(99,102,241,0.15)"
                  : "transparent";
              const color2 = meta.isSelected
                ? "#fff"
                : meta.isToday
                  ? "#818cf8"
                  : `${fgMuted}cc`;
              const outline =
                meta.isToday && !meta.isSelected ? "1px solid rgba(99,102,241,0.5)" : "none";
              return (
                <span
                  className="flex h-full w-full items-center justify-center rounded-lg"
                  style={{ backgroundColor: bg2, color: color2, outline }}
                >
                  {toPersianDigits(day)}
                </span>
              );
            }}
          />
          <button
            type="button"
            onClick={() => setShowCal(false)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs transition-colors"
            style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
          >
            <X className="h-3 w-3" />
            بستن
          </button>
        </div>
      )}

      {/* Activity Picker dropdown */}
      {showActivityPicker && (
        <div
          ref={actRef}
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl p-4 shadow-2xl"
          style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }}
          dir="rtl"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: fg }}>اکتیویتی‌های همیشگی</span>
            <button onClick={() => setShowActivityPicker(false)} style={{ color: fgMuted }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {activities.length === 0 && (
              <p className="py-4 text-center text-xs" style={{ color: fgMuted }}>هنوز اکتیویتی‌ای تعریف نشده</p>
            )}
            {activities.map((a) => (
              <div key={a.id} className="group flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => { setSelectedActivityId(a.id); setShowActivityPicker(false); }}
                  className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 transition-all text-right min-w-0"
                  style={{
                    border: `1px solid ${selectedActivityId === a.id ? a.color : cardBorder}`,
                    backgroundColor: selectedActivityId === a.id ? `${a.color}15` : "transparent",
                    color: selectedActivityId === a.id ? a.color : fg,
                  }}
                >
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="flex-1 text-right text-sm font-medium truncate">{a.name}</span>
                  {a.tags && a.tags.length > 0 && (
                    <span className="text-[10px]" style={{ color: fgMuted }}>{toPersianDigits(a.tags.length)} هشتگ</span>
                  )}
                </button>
                <button
                  id={`delete-activity-${a.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteActivity(a);
                  }}
                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-400 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                  title="حذف اکتیویتی همیشگی"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
            {!showNewActivityForm ? (
              <button
                type="button"
                onClick={() => setShowNewActivityForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs transition-all"
                style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
              >
                <Plus className="h-3.5 w-3.5" />
                اکتیویتی جدید
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  placeholder="نام اکتیویتی..."
                  autoFocus
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewActivityColor(c)}
                      className="h-6 w-6 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        transform: newActivityColor === c ? "scale(1.3)" : "scale(1)",
                        outline: newActivityColor === c ? "2px solid rgba(255,255,255,0.5)" : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowNewActivityForm(false); setNewActivityName(""); }}
                    className="flex-1 rounded-xl py-2 text-xs"
                    style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
                  >
                    لغو
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newActivityName.trim()) return;
                      const a = RecurringActivityStore.create({ name: newActivityName.trim(), color: newActivityColor, tags: [] });
                      setSelectedActivityId(a.id);
                      setShowNewActivityForm(false);
                      setNewActivityName("");
                      setShowActivityPicker(false);
                      window.dispatchEvent(new CustomEvent("activities-updated"));
                    }}
                    disabled={!newActivityName.trim()}
                    className="flex-1 rounded-xl bg-indigo-500 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40"
                  >
                    افزودن
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activityToDelete && (
        <DeleteConfirmationModal
          title={`حذف فعالیت همیشگی: ${activityToDelete.name}`}
          onConfirm={() => executeDeleteActivity(activityToDelete.id)}
          onCancel={() => setActivityToDelete(null)}
        />
      )}
    </div>
  );
}
