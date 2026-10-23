import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Flame, Folder, FolderPlus, ChevronDown, ChevronUp, GripVertical, Settings } from "lucide-react";
import { Habit, HabitGroup, HabitGroupStore, HabitStore, confirmAndDelete } from "@/lib/store";
import { getGregorianToday, addDays, toShamsiShort, toPersianDigits } from "@/lib/shamsi";
import HabitMonthModal from "@/components/habits/HabitMonthModal";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  habits: Habit[];
  onAdd: (data: { name: string; color: string }) => void;
  onToggle: (habit: Habit, date?: string, force?: boolean) => void;
  onDelete: (id: string) => void;
}

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#ef4444"];

function computeStreak(dates: string[]): number {
  if (!dates || dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cursor = getGregorianToday();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  while (set.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

export default function HabitTrackerView({ habits, onAdd, onToggle, onDelete }: Props) {
  const { fg, fgMuted, bg, cardBg, cardBorder } = useThemeStyles();
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showForm, setShowForm] = useState(false);
  const [modalHabitId, setModalHabitId] = useState<string | null>(null);
  const modalHabit = habits.find((h) => h.id === modalHabitId) || null;
  const today = getGregorianToday();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));

  // Group Management States
  const [groups, setGroups] = useState<HabitGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupColor, setSelectedGroupColor] = useState(COLORS[0]);

  // Inside group adding habits states
  const [activeAddingGroupHabitId, setActiveAddingGroupHabitId] = useState<string | null>(null);
  const [newGroupHabitName, setNewGroupHabitName] = useState("");
  const [selectedGroupHabitColor, setSelectedGroupHabitColor] = useState(COLORS[0]);

  // Confirmation States (2 Seconds Mechanism)
  const [confirmingHabit, setConfirmingHabit] = useState<{ habit: Habit; date?: string } | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState(2.0);

  // Correction Mode States (5 Seconds Mechanism)
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState(5.0);
  const [showCorrectionConfirmModal, setShowCorrectionConfirmModal] = useState(false);

  // Drag and Drop States
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveringGroupId, setHoveringGroupId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string, type: "group" | "standalone-habit" | "group-habit", index: number, parentId: string | null = null) => {
    e.stopPropagation();
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, type, index, parentId }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, targetType: "group" | "standalone-habit" | "group-habit", targetParentId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(null);
    try {
      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;
      const { type, index, parentId } = JSON.parse(rawData);

      if (type !== targetType) return;
      if (parentId !== targetParentId) return;
      if (index === targetIndex) return;

      if (type === "group") {
        const sortedGroups = [...groups];
        const [moved] = sortedGroups.splice(index, 1);
        sortedGroups.splice(targetIndex, 0, moved);
        const updatedGroups = sortedGroups.map((g, idx) => ({ ...g, order: idx }));
        setGroups(updatedGroups);
        HabitGroupStore.saveAll(updatedGroups);
      } 
      else if (type === "standalone-habit") {
        const standalones = habits.filter(h => !h.group_id && h.id !== "system-habit-stay-in-study");
        const [moved] = standalones.splice(index, 1);
        standalones.splice(targetIndex, 0, moved);
        const updatedStandalones = standalones.map((h, idx) => ({ ...h, order: idx }));
        const otherHabits = habits.filter(h => h.group_id || h.id === "system-habit-stay-in-study");
        const allUpdated = [...otherHabits, ...updatedStandalones];
        HabitStore.saveAll(allUpdated);
      }
      else if (type === "group-habit") {
        if (!parentId) return;
        const groupHabitList = habits.filter(h => h.group_id === parentId);
        const [moved] = groupHabitList.splice(index, 1);
        groupHabitList.splice(targetIndex, 0, moved);
        const updatedGroupHabits = groupHabitList.map((h, idx) => ({ ...h, order: idx }));
        const otherHabits = habits.filter(h => h.group_id !== parentId);
        const allUpdated = [...otherHabits, ...updatedGroupHabits];
        HabitStore.saveAll(allUpdated);
      }
    } catch (err) {
      console.error("خطا در جابه‌جایی:", err);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  useEffect(() => {
    setGroups(HabitGroupStore.list());
  }, [habits]);

  useEffect(() => {
    if (!confirmingHabit) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 2.0 - elapsed);
      setConfirmCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [confirmingHabit]);

  useEffect(() => {
    if (!isCountingDown) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 5.0 - elapsed);
      setCountdownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setIsCountingDown(false);
        setShowCorrectionConfirmModal(true);
        setCountdownRemaining(5.0);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isCountingDown]);

  const handleToggleClick = (habit: Habit, date?: string) => {
    // Exception (Bypass Rule): if the habit being toggled is the default "ماندن در محیط درس" habit, bypass the timer!
    if (habit.is_pinned || habit.id === "system-habit-stay-in-study") {
      if (isCorrectionMode) {
        onToggle(habit, date, true);
      }
      return;
    }

    setConfirmingHabit({ habit, date });
    setConfirmCountdown(2.0);
  };

  const handleConfirmToggle = () => {
    if (confirmingHabit) {
      onToggle(confirmingHabit.habit, confirmingHabit.date);
      setConfirmingHabit(null);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ name: newName.trim(), color: selectedColor });
    setNewName(""); setSelectedColor(COLORS[0]); setShowForm(false);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    HabitGroupStore.create({
      name: newGroupName.trim(),
      color: selectedGroupColor,
    });
    setNewGroupName("");
    setShowGroupForm(false);
    setGroups(HabitGroupStore.list());
  };

  const handleDeleteGroup = (group: HabitGroup) => {
    confirmAndDelete(`حذف گروه: ${group.name}`, () => {
      HabitGroupStore.delete(group.id);
      setGroups(HabitGroupStore.list());
    });
  };

  const handleAddHabitToGroup = (groupId: string) => {
    if (!newGroupHabitName.trim()) return;
    // We can use HabitStore.create directly, it updates localStorage & focusflow-data-changed
    HabitStore.create({
      name: newGroupHabitName.trim(),
      color: selectedGroupHabitColor,
      group_id: groupId,
      completed_dates: [],
    });
    setNewGroupHabitName("");
    setActiveAddingGroupHabitId(null);
  };

  const toggleGroupExpand = (groupId: string, forceState?: boolean) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: forceState !== undefined ? forceState : !prev[groupId],
    }));
  };

  const defaultHabit = habits.find((h) => h.id === "system-habit-stay-in-study");
  const remainingStandaloneHabits = habits.filter((h) => !h.group_id && h.id !== "system-habit-stay-in-study");

  return (
    <div className="mx-auto max-w-2xl space-y-4" dir="rtl">
      {/* Top Header & Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold" style={{ color: fgMuted }}>{toPersianDigits(habits.length)} عادت</h2>
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => {
              setIsReorderMode(!isReorderMode);
              setShowForm(false);
              setShowGroupForm(false);
              setActiveAddingGroupHabitId(null);
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all cursor-pointer ${
              isReorderMode 
                ? "bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold" 
                : "bg-slate-500/10 hover:bg-slate-500/20"
            }`}
            style={{ borderColor: isReorderMode ? undefined : cardBorder, color: isReorderMode ? undefined : fg }}>
            <Settings className={`h-4 w-4 ${isReorderMode ? "animate-spin text-amber-400" : "text-slate-400"}`} />
            {isReorderMode ? "خروج از تنظیم ترتیب" : "ویرایش ترتیب"}
          </button>
          {!isReorderMode && (
            <>
              <button onClick={() => { setShowGroupForm(!showGroupForm); setShowForm(false); }}
                className="flex items-center gap-1.5 rounded-xl bg-slate-500/10 border px-3.5 py-2 text-xs font-medium transition-all hover:bg-slate-500/20 cursor-pointer"
                style={{ borderColor: cardBorder, color: fg }}>
                <FolderPlus className="h-4.5 w-4.5 text-indigo-400" />
                گروه جدید
              </button>
              <button onClick={() => { setShowForm(!showForm); setShowGroupForm(false); }}
                className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-600 cursor-pointer"
                style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.2)" }}>
                <Plus className="h-4 w-4" />عادت جدید
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reorder Mode Hint Banner */}
      {isReorderMode && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 text-center border border-amber-500/30 bg-amber-500/5 text-amber-400 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-semibold text-right">حالت تنظیم و ویرایش ترتیب فعال است</span>
          </div>
          <p className="text-[11px] opacity-90 text-right leading-relaxed">
            برای جابه‌جایی، از بخش سمت راست هر کارت (علامت <GripVertical className="inline h-3 w-3 mx-0.5 text-amber-500 align-middle" />) استفاده کرده و با کشیدن و رها کردن (درگ و دراپ) ترتیب دلخواه را تعیین کنید.
          </p>
        </motion.div>
      )}

      {/* Form: Add New Habit */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="نام عادت..." autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setSelectedColor(c)}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, transform: selectedColor === c ? "scale(1.25)" : "scale(1)", outline: selectedColor === c ? "2px solid rgba(255,255,255,0.4)" : "none", outlineOffset: "2px" }} />
                ))}
              </div>
              <div className="mr-auto flex gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-xl px-3 py-2 text-xs cursor-pointer"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>لغو</button>
                <button onClick={handleAdd} disabled={!newName.trim()}
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40 cursor-pointer">افزودن</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form: Add New Group */}
      <AnimatePresence>
        {showGroupForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              placeholder="نام گروه جدید (مثلاً: نمازها، ورزش، درس)..." autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none text-right"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setSelectedGroupColor(c)}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, transform: selectedGroupColor === c ? "scale(1.25)" : "scale(1)", outline: selectedGroupColor === c ? "2px solid rgba(255,255,255,0.4)" : "none", outlineOffset: "2px" }} />
                ))}
              </div>
              <div className="mr-auto flex gap-2">
                <button onClick={() => setShowGroupForm(false)} className="rounded-xl px-3 py-2 text-xs cursor-pointer"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>لغو</button>
                <button onClick={handleCreateGroup} disabled={!newGroupName.trim()}
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40 cursor-pointer">ایجاد گروه</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {habits.length === 0 && groups.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-10 text-center text-sm"
          style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
          هنوز عادتی اضافه نکردی
        </motion.div>
      ) : (
        <div className={`space-y-4 transition-all duration-300 p-1 rounded-3xl ${
          isReorderMode 
            ? "border border-dashed border-amber-500/20 bg-amber-500/[0.01]" 
            : ""
        }`}>
          {/* Default Habit "ماندن در محیط درس" at the Very Top */}
          {defaultHabit && (
            <div className="space-y-3">
              {(() => {
                const habit = defaultHabit;
                const completedSet = new Set(habit.completed_dates);
                const isToday = completedSet.has(today);
                const streak = computeStreak(habit.completed_dates);

                if (isReorderMode) {
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between rounded-xl p-3 border border-dashed border-slate-500/10 bg-slate-500/5 cursor-not-allowed opacity-60"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                        <span className="text-xs font-semibold" style={{ color: fg }}>{habit.name}</span>
                        {streak > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#fb923c" }}>
                            <Flame className="h-2.5 w-2.5 text-orange-500" />{toPersianDigits(streak)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                        ثابت در بالا (بدون تغییر ترتیب)
                      </div>
                    </div>
                  );
                }

                return (
                  <motion.div key={habit.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}
                    className={`space-y-3 rounded-2xl p-4 transition-all duration-300 ${
                      isCorrectionMode 
                        ? "border border-amber-500/40 bg-amber-500/[0.03] shadow-[0_0_15px_rgba(245,158,11,0.08)] animate-pulse-subtle" 
                        : ""
                    }`} 
                    style={isCorrectionMode ? undefined : { border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                        <button onClick={() => setModalHabitId(habit.id)}
                          className="text-sm font-semibold transition-colors hover:opacity-70 cursor-pointer" style={{ color: fg }}>
                          {habit.name}
                        </button>
                        {streak > 0 && (
                          <motion.span 
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                            <Flame className="h-3 w-3 text-orange-500 animate-pulse" />{toPersianDigits(streak)}
                          </motion.span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isCorrectionMode ? (
                          <button
                            onClick={() => setIsCorrectionMode(false)}
                            className="text-[9px] sm:text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-500/25 transition-all hover:scale-105 cursor-pointer flex items-center gap-1"
                          >
                            <span>قفل مجدد 🔒</span>
                          </button>
                        ) : isCountingDown ? (
                          <div className="text-[9px] sm:text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1 animate-pulse">
                            <span>{toPersianDigits(countdownRemaining.toFixed(1))} ثانیه... ⏳</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setIsCountingDown(true);
                              setCountdownRemaining(5.0);
                            }}
                            className="text-[9px] sm:text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/25 transition-all hover:scale-105 cursor-pointer flex items-center gap-1"
                            title="فعال‌سازی حالت تغییر دستی تیک‌های سیستم"
                          >
                            <span>اصلاح تیک‌ها 🛠️</span>
                          </button>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                          ثبت خودکار سیستم
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {last7.map((dateStr) => {
                        const done = completedSet.has(dateStr);
                        return (
                          <button key={dateStr}
                            disabled={!isCorrectionMode}
                            onClick={() => handleToggleClick(habit, dateStr)}
                            className={`flex h-8 flex-1 items-center justify-center rounded-lg transition-all duration-300 ${isCorrectionMode ? "cursor-pointer hover:scale-105 border-amber-500/30" : "cursor-not-allowed opacity-75"}`}
                            style={done ? { backgroundColor: habit.color, transform: "scale(1.02)" } : { backgroundColor: "rgba(128,128,128,0.08)", border: `1px solid ${isCorrectionMode ? "rgba(245,158,11,0.3)" : cardBorder}` }}
                            title={toShamsiShort(dateStr)}>
                            {done && <Check className="h-3.5 w-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                    <motion.button 
                      disabled={!isCorrectionMode}
                      onClick={() => handleToggleClick(habit)}
                      whileTap={isCorrectionMode ? { scale: 0.98 } : undefined}
                      className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-300 ${isCorrectionMode ? "cursor-pointer border-amber-500/30" : "cursor-not-allowed opacity-80"}`}
                      style={isToday ? { backgroundColor: habit.color, color: "#ffffff", boxShadow: `0 4px 14px ${habit.color}33` } : { border: `1px solid ${isCorrectionMode ? "rgba(245,158,11,0.3)" : cardBorder}`, backgroundColor: "rgba(128,128,128,0.06)", color: fgMuted }}>
                      {isCorrectionMode ? (isToday ? "امروز انجام شد ✓ (برداشتن تیک)" : "ثبت دستی امروز") : (isToday ? "ثبت خودکار امروز انجام شد ✓" : "تیک خودکار ساعت ۲۳:۳۰ شب")}
                    </motion.button>
                  </motion.div>
                );
              })()}
            </div>
          )}

          {/* Groups of Habits List */}
          {groups.map((group, index) => {
            const groupHabits = habits.filter((h) => h.group_id === group.id);
            const isExpanded = !!expandedGroups[group.id];
            const isThisGroupReorder = isReorderMode;

            return (
              <div 
                key={group.id} 
                draggable={isReorderMode && hoveringGroupId !== group.id}
                onDragStart={(e) => handleDragStart(e, group.id, "group", index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index, "group")}
                onDragEnd={handleDragEnd}
                className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isReorderMode 
                    ? `border-amber-500/30 bg-amber-500/[0.02] shadow-[0_4px_12px_rgba(245,158,11,0.03)] ${
                        draggingId === group.id ? "opacity-30 border-dashed border-amber-500" : "hover:border-amber-500/50 hover:bg-amber-500/[0.04]"
                      }`
                    : ""
                }`}
                style={isReorderMode ? undefined : { borderColor: cardBorder, backgroundColor: cardBg }}
              >
                
                {/* Group Header Card */}
                <div 
                  className={`flex items-center justify-between p-4 transition-colors ${
                    isReorderMode ? "cursor-grab active:cursor-grabbing hover:bg-amber-500/[0.02]" : "cursor-pointer hover:bg-white/5"
                  }`}
                  onClick={isReorderMode ? undefined : () => toggleGroupExpand(group.id)}
                >
                  <div className="flex items-center gap-2.5">
                    {isReorderMode && (
                      <GripVertical className="h-4.5 w-4.5 text-amber-500/50 cursor-grab active:cursor-grabbing hover:text-amber-400" />
                    )}
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                    <Folder className="h-4.5 w-4.5 text-indigo-400" />
                    <span className="text-sm font-bold" style={{ color: fg }}>{group.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5" style={{ color: fgMuted }}>
                      {toPersianDigits(groupHabits.length)} عادت
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!isReorderMode && (
                      <>
                        {/* Add habit inside this group */}
                        <button
                          onClick={() => {
                            toggleGroupExpand(group.id, true);
                            if (activeAddingGroupHabitId === group.id) {
                              setActiveAddingGroupHabitId(null);
                            } else {
                              setActiveAddingGroupHabitId(group.id);
                              setNewGroupHabitName("");
                              setSelectedGroupHabitColor(group.color);
                            }
                          }}
                          title="ایجاد عادت درون این گروه"
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
                          style={{ color: fgMuted }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        {/* Delete group */}
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          title="حذف گروه"
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-rose-500/15 text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {/* Expand indicator */}
                    <button
                      onClick={() => toggleGroupExpand(group.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
                      style={{ color: fgMuted }}
                    >
                      {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>

                {/* Group Content Dropdown */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      onDragStart={(e) => e.stopPropagation()}
                      onMouseEnter={() => setHoveringGroupId(group.id)}
                      onMouseLeave={() => setHoveringGroupId(null)}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-dashed px-4 py-3 space-y-3"
                      style={{ borderColor: isReorderMode ? "rgba(245,158,11,0.2)" : cardBorder }}
                    >
                      {/* Group title inside expanded group */}
                      {groupHabits.length > 0 && (
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-[11px] font-bold text-slate-400">عادت‌های درون گروه</span>
                        </div>
                      )}

                      {/* Method 1: Create Habit directly inside group */}
                      {!isReorderMode && activeAddingGroupHabitId === group.id && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-xl space-y-3"
                          style={{ backgroundColor: "rgba(128,128,128,0.03)", border: `1px solid ${cardBorder}` }}
                        >
                          <div className="text-[11px] font-bold text-indigo-400">ایجاد عادت جدید درون گروه «{group.name}»</div>
                          <input
                            type="text"
                            value={newGroupHabitName}
                            onChange={(e) => setNewGroupHabitName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddHabitToGroup(group.id)}
                            placeholder="نام عادت..."
                            className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                            style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1.5">
                              {COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setSelectedGroupHabitColor(c)}
                                  className="h-5.5 w-5.5 rounded-full transition-transform hover:scale-110 cursor-pointer"
                                  style={{
                                    backgroundColor: c,
                                    transform: selectedGroupHabitColor === c ? "scale(1.2)" : "scale(1)",
                                    outline: selectedGroupHabitColor === c ? "2px solid rgba(255,255,255,0.4)" : "none",
                                  }}
                                />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setActiveAddingGroupHabitId(null)}
                                className="rounded-lg px-2.5 py-1.5 text-[10px] cursor-pointer"
                                style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}
                              >
                                لغو
                              </button>
                              <button
                                onClick={() => handleAddHabitToGroup(group.id)}
                                disabled={!newGroupHabitName.trim()}
                                className="rounded-lg bg-indigo-500 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-indigo-600 disabled:opacity-40 cursor-pointer"
                              >
                                افزودن به گروه
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {groupHabits.length === 0 ? (
                        <div className="text-center text-xs py-4" style={{ color: fgMuted }}>
                          هیچ عادتی در این گروه وجود ندارد.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {groupHabits.map((habit, hIdx) => {
                            const completedSet = new Set(habit.completed_dates);
                            const isToday = completedSet.has(today);
                            const streak = computeStreak(habit.completed_dates);

                            if (isThisGroupReorder) {
                              return (
                                <div
                                  key={habit.id}
                                  draggable={!habit.is_pinned}
                                  onDragStart={(e) => handleDragStart(e, habit.id, "group-habit", hIdx, group.id)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, hIdx, "group-habit", group.id)}
                                  onDragEnd={handleDragEnd}
                                  className={`flex items-center justify-between rounded-xl p-3 border transition-all duration-200 ${
                                    draggingId === habit.id 
                                      ? "opacity-30 border-dashed border-amber-500 bg-amber-500/10" 
                                      : "border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/40 hover:bg-amber-500/[0.04] cursor-grab active:cursor-grabbing"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <GripVertical className="h-4.5 w-4.5 text-amber-500/50" />
                                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                                    <span className="text-xs font-semibold" style={{ color: fg }}>{habit.name}</span>
                                    {streak > 0 && (
                                      <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                                        style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#fb923c" }}>
                                        <Flame className="h-2.5 w-2.5 text-orange-500" />{toPersianDigits(streak)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px]" style={{ color: fgMuted }}>
                                    کشیدن برای تنظیم ترتیب
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <motion.div key={habit.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}
                                className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                                    <button onClick={() => setModalHabitId(habit.id)}
                                      className="text-sm font-semibold transition-colors hover:opacity-70 cursor-pointer" style={{ color: fg }}>
                                      {habit.name}
                                    </button>
                                    {streak > 0 && (
                                      <motion.span 
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                                        style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                                        <Flame className="h-3 w-3 text-orange-500 animate-pulse" />{toPersianDigits(streak)}
                                      </motion.span>
                                    )}
                                  </div>
                                  {!habit.is_pinned ? (
                                    <button onClick={() => onDelete(habit.id)}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-rose-500/15 cursor-pointer" style={{ color: fgMuted }}
                                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; }}>
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                                      ثبت خودکار سیستم
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1.5">
                                  {last7.map((dateStr) => {
                                    const done = completedSet.has(dateStr);
                                    return (
                                      <button key={dateStr}
                                        onClick={habit.is_pinned ? undefined : () => handleToggleClick(habit, dateStr)}
                                        disabled={habit.is_pinned}
                                        className={`flex h-8 flex-1 items-center justify-center rounded-lg transition-all duration-300 ${habit.is_pinned ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:scale-105"}`}
                                        style={done ? { backgroundColor: habit.color, transform: "scale(1.02)" } : { backgroundColor: "rgba(128,128,128,0.08)", border: `1px solid ${cardBorder}` }}
                                        title={toShamsiShort(dateStr)}>
                                        {done && <Check className="h-3.5 w-3.5 text-white" />}
                                      </button>
                                    );
                                  })}
                                </div>
                                <motion.button 
                                  whileTap={habit.is_pinned ? undefined : { scale: 0.96 }}
                                  whileHover={habit.is_pinned ? undefined : { scale: 1.01 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                  onClick={habit.is_pinned ? undefined : () => handleToggleClick(habit)}
                                  disabled={habit.is_pinned}
                                  className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors duration-300 ${habit.is_pinned ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                                  style={isToday ? { backgroundColor: habit.color, color: "#ffffff", boxShadow: `0 4px 14px ${habit.color}33` } : { border: `1px solid ${cardBorder}`, backgroundColor: "rgba(128,128,128,0.06)", color: fgMuted }}>
                                  {habit.is_pinned ? (isToday ? "ثبت خودکار امروز انجام شد ✓" : "تیک خودکار ساعت ۲۳:۳۰ شب") : (isToday ? "امروز انجام شد ✓" : "علامت‌گذاری امروز")}
                                </motion.button>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Standalone / Un-grouped Habits */}
          {remainingStandaloneHabits.length > 0 && (
            <div className="space-y-3">
              {remainingStandaloneHabits.map((habit, sIdx) => {
                const completedSet = new Set(habit.completed_dates);
                const isToday = completedSet.has(today);
                const streak = computeStreak(habit.completed_dates);

                if (isReorderMode) {
                  return (
                    <div
                      key={habit.id}
                      draggable={!habit.is_pinned}
                      onDragStart={(e) => handleDragStart(e, habit.id, "standalone-habit", sIdx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, sIdx, "standalone-habit")}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between rounded-xl p-3 border transition-all duration-200 ${
                        habit.is_pinned 
                          ? "border-slate-500/10 bg-slate-500/5 cursor-not-allowed opacity-75" 
                          : draggingId === habit.id 
                            ? "opacity-30 border-dashed border-amber-500 bg-amber-500/10" 
                            : "border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/40 hover:bg-amber-500/[0.04] cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {!habit.is_pinned ? (
                          <GripVertical className="h-4.5 w-4.5 text-amber-500/50" />
                        ) : (
                          <div className="w-4.5 h-4.5" />
                        )}
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                        <span className="text-xs font-semibold" style={{ color: fg }}>{habit.name}</span>
                        {streak > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ backgroundColor: "rgba(249,115,22,0.1)", color: "#fb923c" }}>
                            <Flame className="h-2.5 w-2.5 text-orange-500" />{toPersianDigits(streak)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px]" style={{ color: fgMuted }}>
                        {habit.is_pinned ? "ثبت خودکار سیستم (پین‌شده)" : "عادت مستقل (کشیدن برای تنظیم)"}
                      </div>
                    </div>
                  );
                }

                return (
                  <motion.div key={habit.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}
                    className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                        <button onClick={() => setModalHabitId(habit.id)}
                          className="text-sm font-semibold transition-colors hover:opacity-70 cursor-pointer" style={{ color: fg }}>
                          {habit.name}
                        </button>
                        {streak > 0 && (
                          <motion.span 
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                            <Flame className="h-3 w-3 text-orange-500 animate-pulse" />{toPersianDigits(streak)}
                          </motion.span>
                        )}
                      </div>
                      {!habit.is_pinned ? (
                        <button onClick={() => onDelete(habit.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-rose-500/15 cursor-pointer" style={{ color: fgMuted }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                          ثبت خودکار سیستم
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {last7.map((dateStr) => {
                        const done = completedSet.has(dateStr);
                        return (
                          <button key={dateStr}
                            onClick={habit.is_pinned ? undefined : () => handleToggleClick(habit, dateStr)}
                            disabled={habit.is_pinned}
                            className={`flex h-8 flex-1 items-center justify-center rounded-lg transition-all duration-300 ${habit.is_pinned ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:scale-105"}`}
                            style={done ? { backgroundColor: habit.color, transform: "scale(1.02)" } : { backgroundColor: "rgba(128,128,128,0.08)", border: `1px solid ${cardBorder}` }}
                            title={toShamsiShort(dateStr)}>
                            {done && <Check className="h-3.5 w-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                    <motion.button 
                      whileTap={habit.is_pinned ? undefined : { scale: 0.96 }}
                      whileHover={habit.is_pinned ? undefined : { scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      onClick={habit.is_pinned ? undefined : () => handleToggleClick(habit)}
                      disabled={habit.is_pinned}
                      className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors duration-300 ${habit.is_pinned ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      style={isToday ? { backgroundColor: habit.color, color: "#ffffff", boxShadow: `0 4px 14px ${habit.color}33` } : { border: `1px solid ${cardBorder}`, backgroundColor: "rgba(128,128,128,0.06)", color: fgMuted }}>
                      {habit.is_pinned ? (isToday ? "ثبت خودکار امروز انجام شد ✓" : "تیک خودکار ساعت ۲۳:۳۰ شب") : (isToday ? "امروز انجام شد ✓" : "علامت‌گذاری امروز")}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {modalHabit && (
          <HabitMonthModal
            habit={modalHabit}
            onClose={() => setModalHabitId(null)}
            onToggleDate={(_habitId, date) => handleToggleClick(modalHabit, date)}
            isCorrectionMode={isCorrectionMode}
          />
        )}
      </AnimatePresence>

      {/* Elegant 2-Second Confirmation Popup */}
      <AnimatePresence>
        {confirmingHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmingHabit(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Popup Box */}
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-right space-y-5 z-10"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: bg, color: fg }}>
              
              <div className="space-y-2">
                <h3 className="text-base font-bold text-indigo-400">تایید نهایی ثبت عادت</h3>
                <p className="text-xs leading-relaxed" style={{ color: fgMuted }}>
                  آیا مطمئن هستید که می‌خواهید وضعیت عادت <span className="font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: confirmingHabit.habit.color }}>{confirmingHabit.habit.name}</span> را تغییر دهید؟
                </p>
              </div>

              {/* Ticking Countdown Visual Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: fgMuted }}>
                  <span>{confirmCountdown > 0 ? "در حال آماده‌سازی دکمه تایید..." : "آماده تایید ثبت نهایی"}</span>
                  <span className={confirmCountdown > 0 ? "text-amber-400 font-mono" : "text-emerald-400 font-bold"}>
                    {confirmCountdown > 0 ? `${toPersianDigits(confirmCountdown.toFixed(1))} ثانیه` : "تکمیل شد ✓"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden bg-white/5">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: `${((2.0 - confirmCountdown) / 2.0) * 100}%` }}
                    transition={{ duration: 0.05, ease: "linear" }}
                    className={`h-full transition-colors duration-300 ${confirmCountdown > 0 ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-emerald-500 to-emerald-400"}`}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleConfirmToggle}
                  disabled={confirmCountdown > 0}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg ${
                    confirmCountdown > 0
                      ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5 shadow-none"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer shadow-emerald-500/10"
                  }`}>
                  {confirmCountdown > 0 ? "صبر کنید..." : "تایید ثبت عادت"}
                </button>
                <button
                  onClick={() => setConfirmingHabit(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}>
                  لغو
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant 5-Second Correction Mode Confirmation Modal */}
      <AnimatePresence>
        {showCorrectionConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCorrectionConfirmModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Popup Box */}
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-right space-y-5 z-10"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: bg, color: fg }}>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="text-xl">⚠️</span>
                  <h3 className="text-base font-bold">فعال‌سازی حالت ویرایش دستی تیک‌ها</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: fgMuted }}>
                  شما زمان‌سنج ۵ ثانیه‌ای را سپری کردید و اکنون می‌توانید سیستم قفل تیک‌های پین‌شده خودکار را باز کنید.
                </p>
                <p className="text-[11px] leading-relaxed text-amber-300/90 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                  این حالت به عنوان یک راه‌حل پشتیبان (Fallback) طراحی شده تا اگر به هر دلیلی ثبت خودکار سیستم دچار ناهماهنگی شد، به راحتی بتوانید تیک‌ها را مدیریت کنید.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setIsCorrectionMode(true);
                    setShowCorrectionConfirmModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-lg shadow-amber-500/10 cursor-pointer">
                  تایید و باز کردن قفل 🔓
                </button>
                <button
                  onClick={() => setShowCorrectionConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}>
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
