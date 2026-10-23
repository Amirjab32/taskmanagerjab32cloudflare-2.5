import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, ChevronLeft, ChevronRight,
  Settings, X, BarChart3, List, ChevronDown
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { QuizSubject, QuizEntry, QuizSubjectStore, QuizEntryStore, confirmAndDelete } from "@/lib/store";
import {
  getGregorianToday, addDays, toShamsiShort, toPersianDigits,
  getTodayJalali, gregorianToJalali
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import JalaliCalendar from "@/components/shared/JalaliCalendar";
import type { DayMeta } from "@/components/shared/JalaliCalendar";
import DelayedTagDelete from "@/components/shared/DelayedTagDelete";

const SUBJECT_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b",
  "#06b6d4", "#ef4444", "#8b5cf6", "#f97316", "#14b8a6"
];

const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/#[^\s#]+/g);
  return matches ? matches.map((tag) => tag.trim()).filter(Boolean) : [];
};

function DailyLog({ subjects, onSubjectsChange }: { subjects: QuizSubject[]; onSubjectsChange: (s: QuizSubject[]) => void }) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const today = getGregorianToday();
  const [viewDate, setViewDate] = useState(today);
  const [entries, setEntries] = useState<QuizEntry[]>(() => QuizEntryStore.listByDate(today));
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManageSubjects, setShowManageSubjects] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [count, setCount] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [note, setNote] = useState("");
  const [entryTags, setEntryTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagsRefreshTrigger, setTagsRefreshTrigger] = useState(0);
  const todayJalali = getTodayJalali();
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const calRef = useRef<HTMLDivElement>(null);
  const datePickerBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setEntries(QuizEntryStore.listByDate(viewDate)); }, [viewDate]);
  useEffect(() => {
    if (!showDatePicker) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (calRef.current && !calRef.current.contains(t) && datePickerBtnRef.current && !datePickerBtnRef.current.contains(t)) setShowDatePicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showDatePicker]);

  const goDay = (delta: number) => {
    const newDate = addDays(viewDate, delta);
    if (newDate > today) return;
    setViewDate(newDate);
    const jd = gregorianToJalali(...newDate.split("-").map(Number) as [number, number, number]);
    setCalJy(jd[0]); setCalJm(jd[1]);
  };

  const totalToday = entries.reduce((s, e) => s + e.count, 0);

  const previousTagsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return [];
    const all = QuizEntryStore.list();
    const tagsSet = new Set<string>();
    all.forEach((e) => {
      if (e.subject_id === selectedSubjectId) {
        if (e.tags) e.tags.forEach((t) => tagsSet.add(t));
        if (e.note) extractHashtags(e.note).forEach((t) => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  }, [selectedSubjectId, tagsRefreshTrigger]);

  const handleCloseForm = () => {
    setShowAddForm(false);
    setCount("");
    setNote("");
    setEntryTags([]);
    setTagInput("");
  };

  const handleAddEntry = () => {
    if (!count || !selectedSubjectId || isNaN(parseInt(count)) || parseInt(count) <= 0) return;
    const parsedFromNote = extractHashtags(note);
    const typedTags = entryTags.map((t) => {
      const s = t.trim().replace(/^[#\s]+/, "");
      return s ? `#${s}` : "";
    }).filter(Boolean);
    const finalTags = Array.from(new Set([...typedTags, ...parsedFromNote]));

    const entry = QuizEntryStore.create({
      subject_id: selectedSubjectId,
      chapter_id: null,
      count: parseInt(count),
      date: viewDate,
      note: note.trim() || undefined,
      tags: finalTags
    });
    setEntries((prev) => [entry, ...prev]);
    setCount("");
    setNote("");
    setEntryTags([]);
    setTagInput("");
    setShowAddForm(false);
    setTagsRefreshTrigger((prev) => prev + 1);
  };

  const handleDeletePreviousTag = (tagToDelete: string) => {
    if (!selectedSubjectId) return;
    const allEntries = QuizEntryStore.list();
    allEntries.forEach((e) => {
      if (e.subject_id === selectedSubjectId) {
        let changed = false;
        let newTags = e.tags || [];
        if (newTags.includes(tagToDelete)) {
          newTags = newTags.filter((t) => t !== tagToDelete);
          changed = true;
        }
        let newNote = e.note;
        if (e.note && e.note.includes(tagToDelete)) {
          newNote = e.note.replace(new RegExp(tagToDelete, "g"), "").replace(/\s+/g, " ").trim();
          changed = true;
        }
        if (changed) {
          QuizEntryStore.update(e.id, {
            tags: newTags.length > 0 ? newTags : undefined,
            note: newNote || undefined,
          });
        }
      }
    });
    setEntries(QuizEntryStore.listByDate(viewDate));
    setTagsRefreshTrigger((prev) => prev + 1);
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const isToday = viewDate === today;

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-between gap-2 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <button onClick={() => goDay(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-white/10" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}><ChevronRight className="h-4 w-4" /></button>
        <div className="flex flex-col items-center gap-1">
          <button ref={datePickerBtnRef} onClick={() => setShowDatePicker((s) => !s)} className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/5" style={{ color: fg }}>
            <span>{toShamsiShort(viewDate)}</span><ChevronDown className="h-4 w-4" style={{ color: fgMuted }} />
          </button>
          {isToday && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}>امروز</span>}
        </div>
        <button onClick={() => goDay(1)} disabled={isToday} className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-white/10 disabled:opacity-30" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}><ChevronLeft className="h-4 w-4" /></button>
        {showDatePicker && (
          <div ref={calRef} className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-2xl p-4 shadow-2xl" style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }} dir="rtl">
            <JalaliCalendar jy={calJy} jm={calJm}
              onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
              onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
              canNext={calJy < todayJalali[0] || (calJy === todayJalali[0] && calJm < todayJalali[1])}
              todayGreg={today} selectedGreg={viewDate}
              onDayClick={(_, meta) => { if (meta.gregDate > today) return; setViewDate(meta.gregDate); setShowDatePicker(false); }}
              renderDay={(day, meta) => {
                const isFuture = meta.gregDate > today;
                const bg2 = meta.isSelected ? "#6366f1" : meta.isToday ? "rgba(99,102,241,0.15)" : "transparent";
                const col = meta.isSelected ? "#fff" : meta.isToday ? "#818cf8" : isFuture ? `${fgMuted}33` : `${fgMuted}cc`;
                return <span className="flex h-full w-full items-center justify-center rounded-lg" style={{ backgroundColor: bg2, color: col }}>{toPersianDigits(day)}</span>;
              }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between rounded-2xl px-5 py-4" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))", border: "1px solid rgba(99,102,241,0.25)" }}>
        <div>
          <div className="text-3xl font-bold" style={{ color: "#818cf8" }}>{toPersianDigits(totalToday)}</div>
          <div className="text-xs mt-1" style={{ color: fgMuted }}>{isToday ? "تست امروز" : `تست ${toShamsiShort(viewDate)}`}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManageSubjects(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>
            <Settings className="h-3.5 w-3.5" />مدیریت درس‌ها
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">
            <Plus className="h-4 w-4" />ثبت تست
          </button>
        </div>
      </div>
      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: fg }}>ثبت تست جدید</span>
              <button onClick={handleCloseForm} style={{ color: fgMuted }}><X className="h-4 w-4" /></button>
            </div>
            <input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder="تعداد تست..." min={1} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} autoFocus />
            {subjects.length === 0 ? (
              <div className="rounded-xl p-3 text-center text-xs" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>ابتدا درس اضافه کن 👆</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {subjects.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSelectedSubjectId(s.id)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all" style={{ border: `1px solid ${selectedSubjectId === s.id ? s.color : cardBorder}`, backgroundColor: selectedSubjectId === s.id ? `${s.color}20` : "transparent", color: selectedSubjectId === s.id ? s.color : fgMuted }}>
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} /><span className="truncate font-medium">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
            
            {selectedSubjectId && (
              <div className="space-y-1.5 border-t border-dashed pt-2.5" style={{ borderColor: `${cardBorder}50` }}>
                <span className="text-xs font-medium" style={{ color: fgMuted }}>هشتگ‌های اختصاصی (اختیاری):</span>
                
                {entryTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {entryTags.map((t) => (
                      <span key={t} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs animate-fade-in"
                        style={{ backgroundColor: `${selectedSubject?.color ?? '#818cf8'}15`, color: selectedSubject?.color ?? '#818cf8', border: `1px solid ${(selectedSubject?.color ?? '#818cf8')}25` }}>
                        #{t}
                        <button type="button" onClick={() => setEntryTags(entryTags.filter((x) => x !== t))} className="hover:text-red-400 mr-0.5 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <input type="text" value={tagInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parts = val.split(/[ ,，،\n\r\t\u00a0]+/);
                      if (parts.length > 1) {
                        const tagsToAdd = parts.slice(0, -1);
                        const remaining = parts[parts.length - 1];
                        
                        let updatedTags = [...entryTags];
                        tagsToAdd.forEach((tag) => {
                          const clean = tag.replace(/[#\s,]/g, "").trim();
                          if (clean && !updatedTags.includes(clean)) {
                            updatedTags.push(clean);
                          }
                        });
                        setEntryTags(updatedTags);
                        setTagInput(remaining);
                      } else {
                        setTagInput(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const clean = tagInput.replace(/[#\s,]/g, "").trim();
                        if (clean && !entryTags.includes(clean)) {
                          setEntryTags([...entryTags, clean]);
                        }
                        setTagInput("");
                      }
                    }}
                    placeholder="افزودن هشتگ جدید (مثلاً کنکور، شیمی_آلی)..." className="w-full rounded-xl px-4 py-2 text-xs outline-none" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
                  <button type="button" onClick={() => {
                    const clean = tagInput.replace(/[#\s,]/g, "").trim();
                    if (clean && !entryTags.includes(clean)) {
                      setEntryTags([...entryTags, clean]);
                    }
                    setTagInput("");
                  }} className="rounded-xl px-3 text-xs bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">افزودن</button>
                </div>

                {previousTagsForSelectedSubject.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px]" style={{ color: fgMuted }}>هشتگ‌های قبلی این درس:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {previousTagsForSelectedSubject.map((t) => {
                        const raw = t.replace("#", "");
                        const isSelected = entryTags.includes(raw);
                        return (
                          <div
                            key={t}
                            onClick={() => {
                              if (isSelected) {
                                setEntryTags(entryTags.filter((x) => x !== raw));
                              } else {
                                setEntryTags([...entryTags, raw]);
                              }
                            }}
                            className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] transition-all cursor-pointer select-none border"
                            style={{
                              borderColor: isSelected ? (selectedSubject?.color ?? '#818cf8') : cardBorder,
                              backgroundColor: isSelected ? `${selectedSubject?.color ?? '#818cf8'}20` : "transparent",
                              color: isSelected ? (selectedSubject?.color ?? '#818cf8') : fgMuted
                            }}
                          >
                            <span className="font-medium">
                              {t}
                            </span>
                            <div onClick={(e) => e.stopPropagation()}>
                              <DelayedTagDelete
                                onDelete={() => handleDeletePreviousTag(t)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت (اختیاری)..." className="w-full rounded-xl px-4 py-2 text-xs outline-none" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
            <div className="flex justify-end gap-2">
              <button onClick={handleCloseForm} className="rounded-xl px-3 py-2 text-xs" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>لغو</button>
              <button onClick={handleAddEntry} disabled={!count || !selectedSubjectId || parseInt(count) <= 0} className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40">ثبت</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {entries.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl p-10 text-center text-sm" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
          هیچ تستی برای این روز ثبت نشده
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {entries.map((entry, idx) => {
              const subject = subjects.find((s) => s.id === entry.subject_id);
              return (
                <motion.div key={entry.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ delay: idx * 0.04 }}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
                  style={{ border: `1px solid ${subject ? `${subject.color}30` : cardBorder}`, backgroundColor: subject ? `${subject.color}08` : cardBg }}>
                  <div className="absolute right-0 top-0 h-full w-1 rounded-r-xl" style={{ backgroundColor: subject?.color ?? "#6366f1" }} />
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: subject ? `${subject.color}20` : "rgba(99,102,241,0.15)", color: subject?.color ?? "#818cf8" }}>{toPersianDigits(entry.count)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: fg }}>{subject?.name ?? "نامشخص"}</span>
                    </div>
                    {entry.note && <p className="mt-0.5 text-xs" style={{ color: fgMuted }}>{entry.note}</p>}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: subject ? `${subject.color}15` : "rgba(99,102,241,0.08)", color: subject?.color ?? "#818cf8" }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <p className="mt-0.5 text-[11px]" style={{ color: fgMuted }}>{toPersianDigits(entry.count)} تست</p>
                  </div>
                  <button onClick={() => {
                    confirmAndDelete(`رکورد ثبت تست ${subject ? subject.name : ""}`, () => {
                      QuizEntryStore.delete(entry.id);
                      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                    });
                  }}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg opacity-70 md:opacity-0 transition-all md:group-hover:opacity-100" style={{ color: fgMuted }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(244,63,94,0.12)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence>
        {showManageSubjects && <ManageSubjectsModal subjects={subjects} onClose={() => setShowManageSubjects(false)} onSubjectsChange={onSubjectsChange} />}
      </AnimatePresence>
    </div>
  );
}

function ManageSubjectsModal({ subjects, onClose, onSubjectsChange }: { subjects: QuizSubject[]; onClose: () => void; onSubjectsChange: (s: QuizSubject[]) => void }) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const modalRef = useRef<HTMLDivElement>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const addSubject = () => {
    if (!newSubjectName.trim()) return;
    const s = QuizSubjectStore.create({ name: newSubjectName.trim(), color: newSubjectColor, chapters: [] });
    onSubjectsChange([...subjects, s]);
    setNewSubjectName(""); setNewSubjectColor(SUBJECT_COLORS[0]);
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} dir="rtl">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
      <motion.div ref={modalRef} className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5 shadow-2xl" style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 280 }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold text-base" style={{ color: fg }}>مدیریت درس‌ها</span>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 space-y-2 rounded-xl p-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
          <input type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject()} placeholder="نام درس..." className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${cardBorder}`, backgroundColor: bg, color: fg }} />
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setNewSubjectColor(c)} className="h-6 w-6 rounded-full transition-transform" style={{ backgroundColor: c, transform: newSubjectColor === c ? "scale(1.3)" : "scale(1)", outline: newSubjectColor === c ? "2px solid rgba(255,255,255,0.5)" : "none", outlineOffset: "2px" }} />
              ))}
            </div>
            <button onClick={addSubject} disabled={!newSubjectName.trim()} className="mr-auto flex items-center gap-1 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" />افزودن
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: cardBg }}>
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-sm font-medium" style={{ color: fg }}>{s.name}</span>
                <button onClick={() => {
                  confirmAndDelete(`درس/مبحث: ${s.name}`, () => {
                    QuizSubjectStore.delete(s.id);
                    onSubjectsChange(subjects.filter((x) => x.id !== s.id));
                  });
                }} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: fgMuted }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; }}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatisticsTab({ subjects }: { subjects: QuizSubject[] }) {
  const { fg, fgMuted, cardBg, cardBorder, bg, isDark } = useThemeStyles();
  const today = getGregorianToday();
  const todayJalali = getTodayJalali();
  const [rangeFrom, setRangeFrom] = useState<string | null>(() => addDays(getGregorianToday(), -6));
  const [rangeTo, setRangeTo] = useState<string | null>(() => getGregorianToday());
  const [pickingEnd, setPickingEnd] = useState(false);
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const [rangeConfirmed, setRangeConfirmed] = useState(true);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTagsBySubject, setSelectedTagsBySubject] = useState<Record<string, string[]>>({});
  const entries = useMemo(() => {
    if (!rangeConfirmed || !rangeFrom || !rangeTo) return [];
    let raw = QuizEntryStore.listByRange(rangeFrom, rangeTo);
    if (selectedSubjectIds.length > 0) {
      raw = raw.filter((e) => selectedSubjectIds.includes(e.subject_id));
    }
    
    const hasAnySelectedTag = Object.values(selectedTagsBySubject).some((tags) => tags.length > 0);
    if (hasAnySelectedTag) {
      raw = raw.filter((e) => {
        const subId = e.subject_id;
        const selectedTagsForSub = selectedTagsBySubject[subId] ?? [];
        if (selectedTagsForSub.length === 0) return true;
        const entryTags = [
          ...(e.tags ?? []),
          ...(e.note ? extractHashtags(e.note) : [])
        ];
        return selectedTagsForSub.some((t) => entryTags.includes(t));
      });
    }
    return raw;
  }, [rangeConfirmed, rangeFrom, rangeTo, selectedSubjectIds, selectedTagsBySubject]);

  const toggleTagForSubject = (subjectId: string, tag: string) => {
    setSelectedTagsBySubject((prev) => {
      const current = prev[subjectId] ?? [];
      const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [subjectId]: updated };
    });
  };

  const handleDayClick = useCallback((_day: number, meta: DayMeta) => {
    if (meta.gregDate > today) return;
    if (!rangeFrom || !pickingEnd) {
      setRangeFrom(meta.gregDate);
      setRangeTo(null);
      setPickingEnd(true);
      setRangeConfirmed(false);
    } else {
      const from = rangeFrom!;
      const to = meta.gregDate;
      if (to < from) {
        setRangeFrom(to);
        setRangeTo(from);
      } else {
        setRangeTo(to);
      }
      setPickingEnd(false);
      setRangeConfirmed(true);
    }
  }, [rangeFrom, pickingEnd, today]);

  const tagsBySubjectId = useMemo(() => {
    const map: Record<string, string[]> = {};
    const all = QuizEntryStore.list();
    all.forEach((e) => {
      const subId = e.subject_id;
      if (!map[subId]) {
        map[subId] = [];
      }
      if (e.tags) {
        e.tags.forEach((tag) => {
          if (!map[subId].includes(tag)) {
            map[subId].push(tag);
          }
        });
      }
      if (e.note) {
        extractHashtags(e.note).forEach((tag) => {
          if (!map[subId].includes(tag)) {
            map[subId].push(tag);
          }
        });
      }
    });
    return map;
  }, [subjects]);

  const visibleSubjectsForTags = useMemo(() => {
    return subjects.filter((s) => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(s.id));
  }, [subjects, selectedSubjectIds]);

  const hasAnyTags = useMemo(() => {
    return visibleSubjectsForTags.some((s) => (tagsBySubjectId[s.id] ?? []).length > 0);
  }, [visibleSubjectsForTags, tagsBySubjectId]);

  const pieData = subjects.filter((s) => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(s.id)).map((s) => ({ name: s.name, value: entries.filter((e) => e.subject_id === s.id).reduce((acc, e) => acc + e.count, 0), color: s.color })).filter((d) => d.value > 0);

  const allDatesInRange: string[] = [];
  if (rangeFrom && rangeTo) { let c = rangeFrom; while (c <= rangeTo) { allDatesInRange.push(c); c = addDays(c, 1); } }

  const dateMap = new Map<string, Record<string, number>>();
  entries.forEach((e) => { if (!dateMap.has(e.date)) dateMap.set(e.date, {}); const m = dateMap.get(e.date)!; m[e.subject_id] = (m[e.subject_id] || 0) + e.count; });

  const lineData = allDatesInRange.map((date) => { const m = dateMap.get(date) || {}; const entry: Record<string, string | number> = { date: toShamsiShort(date) }; subjects.forEach((s) => { if (selectedSubjectIds.length === 0 || selectedSubjectIds.includes(s.id)) entry[s.name] = m[s.id] || 0; }); entry.total = Object.values(m).reduce((a: number, b) => a + (b as number), 0); return entry; });

  const totalInRange = entries.reduce((acc, e) => acc + e.count, 0);
  const daysInRange = allDatesInRange.length;
  const avgPerDay = daysInRange > 0 ? Math.round(totalInRange / daysInRange) : 0;
  const activeSubjectsForChart = subjects.filter((s) => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(s.id));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const total = dataPoint.total || 0;

      // Filter active subjects that have registered values on this specific day
      const subjectsWithData = activeSubjectsForChart.filter(
        (s) => dataPoint[s.name] !== undefined && dataPoint[s.name] > 0
      );

      return (
        <div className="rounded-xl p-3 shadow-xl border text-right text-xs space-y-2 font-sans animate-fade-in"
          style={{ backgroundColor: bg, borderColor: cardBorder, color: fg }}>
          <p className="font-bold border-b pb-1 mb-1" style={{ borderColor: `${cardBorder}50` }}>
            {label}
          </p>
          {subjectsWithData.length > 0 ? (
            <div className="space-y-1.5">
              {subjectsWithData.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span style={{ color: fgMuted }}>{s.name}:</span>
                  </div>
                  <span className="font-bold" style={{ color: fg }}>
                    {toPersianDigits(dataPoint[s.name])} تست
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: fgMuted }}>هیچ تستی ثبت نشده</p>
          )}
          <div className="border-t pt-1.5 mt-1.5 flex items-center justify-between gap-6 font-bold"
            style={{ borderColor: `${cardBorder}50` }}>
            <span style={{ color: fg }}>مجموع کل روز:</span>
            <span style={{ color: "#818cf8" }}>{toPersianDigits(total)} تست</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: fg }}>انتخاب بازه تاریخی</span>
          <div className="flex gap-2 text-xs" style={{ color: fgMuted }}>{rangeFrom && <span>از: {toShamsiShort(rangeFrom)}</span>}{rangeTo && <span>تا: {toShamsiShort(rangeTo)}</span>}</div>
        </div>
        {pickingEnd && <div className="rounded-xl px-3 py-2 text-center text-xs animate-pulse" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>حالا روز پایانی را انتخاب کن</div>}
        <JalaliCalendar jy={calJy} jm={calJm}
          onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
          onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
          canNext={calJy < todayJalali[0] || (calJy === todayJalali[0] && calJm < todayJalali[1])}
          todayGreg={today} onDayClick={handleDayClick}
          renderDay={(day, meta) => {
            const isFuture = meta.gregDate > today;
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
          {[{ label: "هفته اخیر", days: 7 }, { label: "ماه اخیر", days: 30 }, { label: "۳ ماه اخیر", days: 90 }].map(({ label, days }) => (
            <button key={label} onClick={() => { const from = addDays(today, -(days - 1)); setRangeFrom(from); setRangeTo(today); setPickingEnd(false); setRangeConfirmed(true); const jd = gregorianToJalali(...from.split("-").map(Number) as [number, number, number]); setCalJy(jd[0]); setCalJm(jd[1]); }} className="rounded-lg px-3 py-1.5 text-xs transition-all" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>{label}</button>
          ))}
        </div>
        {subjects.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium" style={{ color: fgMuted }}>فیلتر درس:</span>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setSelectedSubjectIds([]); setSelectedTagsBySubject({}); }} className="rounded-lg px-3 py-1.5 text-xs transition-all" style={{ border: `1px solid ${selectedSubjectIds.length === 0 ? "#6366f1" : cardBorder}`, backgroundColor: selectedSubjectIds.length === 0 ? "rgba(99,102,241,0.15)" : "transparent", color: selectedSubjectIds.length === 0 ? "#818cf8" : fgMuted }}>همه</button>
              {subjects.map((s) => (
                <button key={s.id} onClick={() => { setSelectedSubjectIds((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]); }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all" style={{ border: `1px solid ${selectedSubjectIds.includes(s.id) ? s.color : cardBorder}`, backgroundColor: selectedSubjectIds.includes(s.id) ? `${s.color}20` : "transparent", color: selectedSubjectIds.includes(s.id) ? s.color : fgMuted }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-medium" style={{ color: fgMuted }}>فیلتر هشتگ‌ها:</span>
          {!hasAnyTags ? (
            <div className="rounded-xl p-3 text-right text-xs" style={{ border: `1px solid ${cardBorder}`, backgroundColor: `${cardBorder}08`, color: fgMuted, lineHeight: "1.6" }}>
              💡 <strong style={{ color: fg }}>هنوز هشتگی ثبت نشده است!</strong> برای استفاده از فیلتر هشتگی، هنگام ثبت تست جدید، می‌توانید در بخش یادداشت هشتگ بنویسید (مانند #مکانیک، #شیمی_آلی) یا موقع ثبت تست از بخش «هشتگ‌های اختصاصی» استفاده کنید.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleSubjectsForTags.map((sub) => {
                const tagsForSub = tagsBySubjectId[sub.id] ?? [];
                if (tagsForSub.length === 0) return null;
                const selectedTags = selectedTagsBySubject[sub.id] ?? [];
                return (
                  <div key={sub.id} className="space-y-1.5 rounded-xl p-2.5"
                    style={{ border: `1px solid ${sub.color}30`, backgroundColor: `${sub.color}08` }}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sub.color }} />
                      <span className="text-xs font-medium" style={{ color: sub.color }}>هشتگ‌های {sub.name}:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tagsForSub.map((tag) => (
                        <button key={tag} onClick={() => toggleTagForSubject(sub.id, tag)}
                          className="rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer"
                          style={{
                            border: `1px solid ${selectedTags.includes(tag) ? sub.color : `${sub.color}40`}`,
                            backgroundColor: selectedTags.includes(tag) ? `${sub.color}20` : "transparent",
                            color: selectedTags.includes(tag) ? sub.color : fgMuted,
                          }}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={() => { if (rangeFrom && rangeTo) setRangeConfirmed(true); }} disabled={!rangeFrom || !rangeTo} className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40">نمایش آمار</button>
      </div>
      {rangeConfirmed && rangeFrom && rangeTo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(99,102,241,0.25)", backgroundColor: "rgba(99,102,241,0.08)" }}>
              <div className="text-2xl font-bold" style={{ color: "#818cf8" }}>{toPersianDigits(totalInRange)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>کل تست</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(16,185,129,0.25)", backgroundColor: "rgba(16,185,129,0.08)" }}>
              <div className="text-2xl font-bold" style={{ color: "#34d399" }}>{toPersianDigits(daysInRange)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>روز</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.08)" }}>
              <div className="text-2xl font-bold" style={{ color: "#fbbf24" }}>{toPersianDigits(avgPerDay)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>میانگین روزانه</div>
            </div>
          </div>
          {entries.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-sm" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>در این بازه داده‌ای یافت نشد</div>
          ) : (
            <>
              {pieData.length > 0 && (
                <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                  <h3 className="text-sm font-semibold" style={{ color: fg }}>سهم هر درس</h3>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div style={{ width: "100%", maxWidth: 220, height: 220 }}>
                      <ResponsiveContainer><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">{pieData.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><RechartTooltip formatter={(value) => [`${toPersianDigits(Number(value))} تست`]} contentStyle={{ backgroundColor: bg, border: `1px solid ${cardBorder}`, borderRadius: 12, direction: "rtl", color: fg }} /></PieChart></ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      {pieData.map((d) => { const pct = totalInRange > 0 ? Math.round((d.value / totalInRange) * 100) : 0; return <div key={d.name} className="flex items-center gap-2"><span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} /><span className="flex-1 text-sm" style={{ color: fg }}>{d.name}</span><span className="text-sm font-bold" style={{ color: d.color }}>{toPersianDigits(d.value)} ({toPersianDigits(pct)}%)</span></div>; })}
                    </div>
                  </div>
                </div>
              )}
              {lineData.length > 1 && (
                <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                  <h3 className="text-sm font-semibold" style={{ color: fg }}>روند تست‌ها در زمان</h3>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: fgMuted }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10, fill: fgMuted }} tickLine={false} axisLine={false} />
                        <RechartTooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
                        {activeSubjectsForChart.length > 1 ? activeSubjectsForChart.map((s) => <Line key={s.id} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />) : <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="کل تست" />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function QuizTrackerView() {
  const { fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [tab, setTab] = useState<"log" | "stats">("log");
  const [subjects, setSubjects] = useState<QuizSubject[]>(() => QuizSubjectStore.list());
  const TABS = [{ id: "log" as const, label: "ثبت روزانه", icon: List }, { id: "stats" as const, label: "آمار و نمودار", icon: BarChart3 }];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex gap-1 rounded-2xl p-1" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all" style={tab === id ? { backgroundColor: "#6366f1", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" } : { color: fgMuted }}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === "log" ? <DailyLog subjects={subjects} onSubjectsChange={setSubjects} /> : <StatisticsTab subjects={subjects} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
