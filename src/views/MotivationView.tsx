import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Pin, Plus, Skull, HelpCircle, Flame, Clock, ChevronDown, Calendar as CalendarIcon, Play } from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { MotivationStore, BitterMemory, confirmAndDelete } from "@/lib/store";
import { getGregorianToday, toShamsi, dayDiff, toPersianDigits, gregorianToJalali, toShamsiShort } from "@/lib/shamsi";
import JalaliCalendar, { DayMeta } from "@/components/shared/JalaliCalendar";

function ShamsiDatePicker({
  value,
  onChange,
  accentColorClass,
  label,
}: {
  value: string;
  onChange: (date: string) => void;
  accentColorClass: string;
  label: string;
}) {
  const { bg, fg, fgMuted, cardBorder, inputBg } = useThemeStyles();
  const [showCal, setShowCal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const today = getGregorianToday();
  const selJalali = gregorianToJalali(
    ...(value ? value.split("-").map(Number) as [number, number, number] : today.split("-").map(Number) as [number, number, number])
  );

  const [calJy, setCalJy] = useState(selJalali[0]);
  const [calJm, setCalJm] = useState(selJalali[1]);

  useEffect(() => {
    if (value) {
      const jal = gregorianToJalali(...(value.split("-").map(Number) as [number, number, number]));
      setCalJy(jal[0]);
      setCalJm(jal[1]);
    }
  }, [value]);

  useEffect(() => {
    if (!showCal) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        calRef.current && !calRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowCal(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showCal]);

  const prevMonth = () => {
    if (calJm === 1) {
      setCalJy(calJy - 1);
      setCalJm(12);
    } else {
      setCalJm(calJm - 1);
    }
  };

  const nextMonth = () => {
    if (calJm === 12) {
      setCalJy(calJy + 1);
      setCalJm(1);
    } else {
      setCalJm(calJm + 1);
    }
  };

  const handleDayClick = (_day: number, meta: DayMeta) => {
    onChange(meta.gregDate);
    setShowCal(false);
  };

  return (
    <div className="relative text-right">
      <label className="block text-xs font-medium mb-1.5" style={{ color: fgMuted }}>
        {label}
      </label>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setShowCal(!showCal)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-all outline-none border focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-zinc-400" />
          {value ? toShamsiShort(value) : "انتخاب تاریخ..."}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      <AnimatePresence>
        {showCal && (
          <motion.div
            ref={calRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 right-0 z-50 mt-2 rounded-2xl p-4 shadow-2xl border"
            style={{ backgroundColor: bg, borderColor: cardBorder }}
            dir="rtl"
          >
            <JalaliCalendar
              jy={calJy}
              jm={calJm}
              onPrev={prevMonth}
              onNext={nextMonth}
              canNext={true}
              todayGreg={today}
              selectedGreg={value}
              onDayClick={handleDayClick}
              renderDay={(day, meta) => {
                const bg2 = meta.isSelected
                  ? accentColorClass === "amber" ? "#f59e0b" : "#6366f1"
                  : meta.isToday
                    ? accentColorClass === "amber" ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)"
                    : "transparent";
                const color2 = meta.isSelected
                  ? "#fff"
                  : meta.isToday
                    ? accentColorClass === "amber" ? "#f59e0b" : "#818cf8"
                    : `${fgMuted}cc`;
                const outline =
                  meta.isToday && !meta.isSelected 
                    ? accentColorClass === "amber" ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(99,102,241,0.5)" 
                    : "none";
                return (
                  <span
                    className="flex h-full w-full items-center justify-center rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: bg2, color: color2, outline }}
                  >
                    {toPersianDigits(day)}
                  </span>
                );
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MotivationView() {
  const { cardBg, cardBorder, fg, fgMuted, inputBg } = useThemeStyles();
  
  // State for dates
  const [konkurDate, setKonkurDate] = useState("");
  const [finalExamsDate, setFinalExamsDate] = useState("");
  
  // State for memories
  const [memories, setMemories] = useState<BitterMemory[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  
  const today = getGregorianToday();

  // Load initial data
  useEffect(() => {
    setKonkurDate(MotivationStore.getKonkurDate());
    setFinalExamsDate(MotivationStore.getFinalExamsDate());
    setMemories(MotivationStore.getMemories());
  }, []);

  const handleSaveKonkurDate = (val: string) => {
    setKonkurDate(val);
    MotivationStore.setKonkurDate(val);
  };

  const handleSaveFinalExamsDate = (val: string) => {
    setFinalExamsDate(val);
    MotivationStore.setFinalExamsDate(val);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    MotivationStore.addMemory(newTitle.trim(), newDescription.trim());
    setMemories(MotivationStore.getMemories());
    setNewTitle("");
    setNewDescription("");
  };

  const handleDeleteMemory = (id: string) => {
    confirmAndDelete("آیا از حذف این یادآور تلخ مطمئن هستید؟ با این کار یکی از محرک‌های انگیزشی شما حذف خواهد شد.", () => {
      MotivationStore.deleteMemory(id);
      setMemories(MotivationStore.getMemories());
    });
  };

  const handleTogglePin = (id: string) => {
    MotivationStore.togglePinMemory(id);
    setMemories(MotivationStore.getMemories());
  };

  // Remaining days calculation
  const konkurRemaining = dayDiff(today, konkurDate);
  const finalRemaining = dayDiff(today, finalExamsDate);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6" style={{ borderColor: cardBorder }}>
        <div className="flex flex-col gap-1.5 max-w-xl text-right">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: fg }}>
            <Flame className="h-6 w-6 text-rose-500 animate-pulse" />
            تنظیمات انگیزه و اهداف (دارال)
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: fgMuted }}>
            محل تنظیم روزشمارهای حیاتی کنکور و امتحانات نهایی، به همراه ثبت محرک‌ها و خاطرات تلخی که شما را برای تلاش بیشتر به جلو هل می‌دهند.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("trigger-intro-overlay"));
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95 self-start sm:self-center"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>نمایش مجدد روزشمار و انیمیشن‌ها</span>
        </button>
      </div>

      {/* Grid for settings */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Konkur Date Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 border transition-all"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Skull className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: fg }}>تاریخ کنکور سراسری</h2>
              <p className="text-xs" style={{ color: fgMuted }}>روز شمار نهایی آزمون سراسری</p>
            </div>
          </div>

          <div className="space-y-4">
            <ShamsiDatePicker
              label="انتخاب تاریخ کنکور (شمسی)"
              value={konkurDate}
              onChange={handleSaveKonkurDate}
              accentColorClass="indigo"
            />

            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-indigo-400">
                <span>تاریخ شمسی:</span>
                <span className="font-semibold">{konkurDate ? toShamsi(konkurDate) : "تعیین نشده"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold" style={{ color: fg }}>زمان باقی‌مانده:</span>
                <span className="text-lg font-bold text-indigo-400">
                  {konkurRemaining >= 0 ? `${toPersianDigits(konkurRemaining)} روز` : "برگزار شده"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Final Exams Date Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 border transition-all"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: fg }}>تاریخ امتحانات نهایی</h2>
              <p className="text-xs" style={{ color: fgMuted }}>روز شمار امتحانات هماهنگ کشوری</p>
            </div>
          </div>

          <div className="space-y-4">
            <ShamsiDatePicker
              label="انتخاب تاریخ امتحانات (شمسی)"
              value={finalExamsDate}
              onChange={handleSaveFinalExamsDate}
              accentColorClass="amber"
            />

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-amber-400">
                <span>تاریخ شمسی:</span>
                <span className="font-semibold">{finalExamsDate ? toShamsi(finalExamsDate) : "تعیین نشده"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold" style={{ color: fg }}>زمان باقی‌مانده:</span>
                <span className="text-lg font-bold text-amber-400">
                  {finalRemaining >= 0 ? `${toPersianDigits(finalRemaining)} روز` : "برگزار شده"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Daral / Bitter Memories Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: fg }}>
            <Skull className="h-5 w-5 text-rose-500" />
            اتاق خاطرات تلخ (دارال)
          </h2>
          <p className="text-xs" style={{ color: fgMuted }}>
            ثبت شکست‌ها، کنایه‌های اطرافیان، حسرت‌ها و اتفاقاتی که با یادآوری آن‌ها آتش پشتکار درون شما شعله‌ورتر می‌شود.
          </p>
        </div>

        {/* Add Memory Form */}
        <form onSubmit={handleAddMemory} className="rounded-2xl p-6 border space-y-4" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium mb-1.5" style={{ color: fgMuted }}>
                سرفصل یا عنوان خاطره (مثلاً: رتبه افتضاح قلم‌چی آذر)
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="یک سرفصل کوتاه بنویسید..."
                className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none border focus:ring-2 focus:ring-rose-500"
                style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: fgMuted }}>
                توضیح کوتاه (یک یا دو جمله برای زنده شدن سریع جزئیات تلخ آن خاطره)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="جزئیاتی که یادآور عمیق‌ترین احساسات شما در آن لحظه باشد..."
                className="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none border focus:ring-2 focus:ring-rose-500"
                style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-sm font-semibold transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              افزودن به دارال
            </button>
          </div>
        </form>

        {/* Memories list */}
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {memories.length === 0 ? (
              <div className="sm:col-span-2 rounded-2xl p-8 text-center border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                <HelpCircle className="h-10 w-10 text-rose-500/30 mx-auto mb-3" />
                <p className="text-sm font-semibold" style={{ color: fg }}>هنوز هیچ محرک یا خاطره تلخی ثبت نکرده‌اید!</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: fgMuted }}>
                  سختی‌هایی که تا به امروز کشیده‌اید را اینجا ثبت کنید تا هیچ‌وقت یادتان نرود برای چه دارید تلاش می‌کنید.
                </p>
              </div>
            ) : (
              memories.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl p-5 border relative flex flex-col justify-between group transition-all"
                  style={{ 
                    backgroundColor: cardBg, 
                    borderColor: m.is_pinned ? "rgba(244, 63, 94, 0.4)" : cardBorder,
                    boxShadow: m.is_pinned ? "0 4px 12px rgba(244, 63, 94, 0.05)" : "none"
                  }}
                >
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm flex items-center gap-1.5" style={{ color: m.is_pinned ? "#f43f5e" : fg }}>
                        {m.title}
                      </h3>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(m.id)}
                          className="p-1 rounded-md transition-all hover:bg-white/5"
                          style={{ color: m.is_pinned ? "#f43f5e" : fgMuted }}
                          title={m.is_pinned ? "برداشتن سنجاق" : "سنجاق کردن به بالا"}
                        >
                          <Pin className="h-3.5 w-3.5" style={{ transform: m.is_pinned ? "none" : "rotate(45deg)" }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemory(m.id)}
                          className="p-1 rounded-md text-rose-400 hover:text-rose-500 transition-all hover:bg-white/5 opacity-0 group-hover:opacity-100"
                          title="حذف خاطره"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {m.description && (
                      <p className="text-xs leading-relaxed" style={{ color: fgMuted }}>
                        {m.description}
                      </p>
                    )}
                  </div>
                  <div className="text-[10px] text-right" style={{ color: fgMuted }}>
                    {toPersianDigits(toShamsi(new Date(m.created_at).toISOString().split("T")[0]))}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
