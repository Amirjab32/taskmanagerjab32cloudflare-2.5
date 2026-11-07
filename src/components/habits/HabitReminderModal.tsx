import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BellOff,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Volume2,
  ShieldCheck,
  AlertCircle,
  Play,
  Vibrate,
  Music,
  Upload,
  Trash2
} from "lucide-react";
import { Habit } from "@/lib/store";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { AudioStorageService } from "@/lib/audioStorage";
import {
  getNotificationPermission,
  requestNotificationPermission,
  dispatchNotification,
  playNotificationTone,
  SOUND_PRESETS,
  VIBRATION_PRESETS,
  getVibrationPattern,
  NotificationPermissionState,
  clearNotified,
  runActiveRemindersCheck
} from "@/lib/notifications";

interface Props {
  habit: Habit;
  onClose: () => void;
  onSave: (updated: Partial<Habit>) => void;
}

// نگاشت روزهای هفته در جاوااسکریپت به تقویم فارسی
// JS getDay(): 0 = یکشنبه, 1 = دوشنبه, ..., 6 = شنبه
const WEEK_DAYS = [
  { id: 6, name: "شنبه" },
  { id: 0, name: "یکشنبه" },
  { id: 1, name: "دوشنبه" },
  { id: 2, name: "سه‌شنبه" },
  { id: 3, name: "چهارشنبه" },
  { id: 4, name: "پنج‌شنبه" },
  { id: 5, name: "جمعه" },
];

export default function HabitReminderModal({ habit, onClose, onSave }: Props) {
  const { fg, fgMuted, cardBorder, isDark } = useThemeStyles();
  const modalBg = isDark ? "#18181b" : "#ffffff";
  const headerBg = isDark ? "#131316" : "#f8f9fa";
  const footerBg = isDark ? "#131316" : "#f8f9fa";
  const itemCardBg = isDark ? "#222226" : "rgba(0,0,0,0.03)";
  const itemCardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [enabled, setEnabled] = useState<boolean>(habit.reminder_enabled ?? false);
  const [time, setTime] = useState<string>(habit.reminder_time || "20:00");

  // انتخاب صدای زنگ و الگوی ویبره
  const [selectedSound, setSelectedSound] = useState<string>(habit.reminder_sound || "hygiene");
  const [selectedVibration, setSelectedVibration] = useState<string>(habit.reminder_vibration || "heartbeat");
  const [customSound, setCustomSound] = useState<string | null>(habit.reminder_custom_sound || null);
  
  // پیش‌فرض روزهای هفته: اگر خالی باشد یا مشخص نشده باشد، تمام ۷ روز هفته (هر روز) است
  const [selectedDays, setSelectedDays] = useState<number[]>(
    habit.reminder_days && habit.reminder_days.length > 0
      ? habit.reminder_days
      : [0, 1, 2, 3, 4, 5, 6]
  );

  // وضعیت باز/بسته بودن منوهای آکاردئونی
  const [showDaysPicker, setShowDaysPicker] = useState<boolean>(
    Boolean(habit.reminder_days && habit.reminder_days.length < 7)
  );
  const [showSoundPicker, setShowSoundPicker] = useState<boolean>(false);
  const [showVibePicker, setShowVibePicker] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (granted) {
      setEnabled(true);
    }
  };

  const handleToggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSelectAllDays = () => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  // پیش‌شنوایی فوری صدا
  const handlePreviewSound = (soundId: string) => {
    setUploadError(null);
    setCustomSound(null);
    setSelectedSound(soundId);
    playNotificationTone(soundId);
  };

  // آپلود فایل صوتی اختصاصی از روی گوشی یا سیستم کاربر و ذخیره ایمن در IndexedDB
  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("حداکثر حجم فایل صوتی ۱۰ مگابایت است.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const soundKey = `custom:habit_${habit.id}`;
        await AudioStorageService.saveAudio(soundKey, dataUrl);
        setCustomSound(soundKey);
        playNotificationTone(soundKey);
      } catch {
        setUploadError("خطا در بارگذاری فایل صوتی");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCustomSound = async () => {
    const soundKey = `custom:habit_${habit.id}`;
    await AudioStorageService.deleteAudio(soundKey);
    setCustomSound(null);
    setUploadError(null);
  };

  // پیش‌شنوایی فوری ویبره
  const handlePreviewVibration = (vibeId: string) => {
    setSelectedVibration(vibeId);
    const pattern = getVibrationPattern(vibeId);
    if (typeof navigator !== "undefined" && navigator.vibrate && pattern.length > 0) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const handleTestNotification = async () => {
    setTestSent(true);
    const soundToPlay = customSound || selectedSound;
    const pattern = getVibrationPattern(selectedVibration);

    if (permission === "granted") {
      // dispatchNotification خود به صورت متمرکز صدا و ویبره را پخش می‌کند
      await dispatchNotification({
        title: "تست اعلان عادت FocusFlow",
        body: `یادآوری عادت «${habit.name}» با موفقیت فعال است.`,
        tag: `test_${habit.id}`,
        sound: soundToPlay,
        vibrate: pattern
      });
    } else {
      // در صورت عدم تایید دسترسی سیستم، صدا و ویبره به صورت محلی تست شوند
      playNotificationTone(soundToPlay);
      if (typeof navigator !== "undefined" && navigator.vibrate && pattern.length > 0) {
        try {
          navigator.vibrate(pattern);
        } catch {}
      }
    }

    setTimeout(() => setTestSent(false), 2500);
  };

  const handleSave = () => {
    const isEveryDay = selectedDays.length === 7;
    // پاک کردن وضعیت قبلی تا در صورت تنظیم مجدد ساعت، یادآور آماده اجرا شود
    clearNotified(habit.id);
    onSave({
      reminder_enabled: enabled,
      reminder_time: time,
      reminder_days: isEveryDay ? [0, 1, 2, 3, 4, 5, 6] : selectedDays,
      reminder_sound: selectedSound,
      reminder_vibration: selectedVibration,
      reminder_custom_sound: customSound || undefined
    });
    setTimeout(() => {
      runActiveRemindersCheck();
    }, 100);
    onClose();
  };

  const isEveryDay = selectedDays.length === 7;
  const currentSoundObj = SOUND_PRESETS.find((s) => s.id === selectedSound) || SOUND_PRESETS[0];
  const currentVibeObj = VIBRATION_PRESETS.find((v) => v.id === selectedVibration) || VIBRATION_PRESETS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border"
        style={{
          backgroundColor: modalBg,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ backgroundColor: headerBg, borderColor: itemCardBorder }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${habit.color}25`, color: habit.color }}
            >
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: fg }}>
                تنظیم اعلان عادت
              </h3>
              <p className="text-xs truncate max-w-[200px]" style={{ color: fgMuted }}>
                «{habit.name}»
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
            style={{ color: fgMuted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {/* Permission Alert if not granted */}
          {permission !== "granted" && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-200 leading-relaxed">
                  برای دریافت اعلان‌ها روی گوشی یا لپ‌تاپ، لطفاً دسترسی اعلان را تایید کنید.
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                فعال‌سازی دسترسی اعلان در این دستگاه
              </button>
            </div>
          )}

          {/* Toggle Enable */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border"
            style={{ borderColor: itemCardBorder, backgroundColor: itemCardBg }}
          >
            <div className="flex items-center gap-2.5">
              {enabled ? (
                <Bell className="h-4.5 w-4.5 text-indigo-400" />
              ) : (
                <BellOff className="h-4.5 w-4.5" style={{ color: fgMuted }} />
              )}
              <div>
                <div className="text-xs font-bold" style={{ color: fg }}>
                  یادآوری خودکار
                </div>
                <div className="text-[11px]" style={{ color: fgMuted }}>
                  {enabled ? "اعلان در ساعت مقرر ارسال خواهد شد" : "اعلان این عادت خاموش است"}
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              dir="ltr"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? "bg-indigo-500" : "bg-white/20"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {/* Time Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: fg }}>
                  ساعت ارسال اعلان:
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-center outline-none cursor-pointer tracking-wider"
                    style={{
                      border: `1px solid ${itemCardBorder}`,
                      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      color: fg
                    }}
                  />
                </div>
              </div>

              {/* Sound Selector (Standard Alarm Sounds + Custom Upload) */}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: itemCardBorder, backgroundColor: itemCardBg }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowSoundPicker(!showSoundPicker)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowSoundPicker(!showSoundPicker);
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 text-xs font-medium transition-colors hover:bg-white/5 cursor-pointer select-none"
                  style={{ color: fg }}
                >
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-indigo-400" />
                    <span className="font-bold">صدای زنگ:</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300"
                    >
                      {customSound ? "فایل صوتی اختصاصی شما 🎵" : currentSoundObj.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" style={{ color: fgMuted }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playNotificationTone(customSound || selectedSound);
                      }}
                      title="پخش آزمایشی این صدا"
                      className="p-1 rounded-md hover:bg-white/10 text-indigo-400 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-indigo-400" />
                    </button>
                    {showSoundPicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {showSoundPicker && (
                  <div className="p-2.5 border-t border-dashed space-y-2 max-h-64 overflow-y-auto" style={{ borderColor: cardBorder }}>
                    {/* Custom Uploaded Sound Card if present */}
                    {customSound && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-indigo-400" />
                          <span className="font-bold text-indigo-300">فایل صوتی اختصاصی آپلودشده شما</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => playNotificationTone(customSound)}
                            className="p-1 rounded-lg bg-indigo-500 text-white cursor-pointer"
                            title="پخش"
                          >
                            <Play className="h-3 w-3 fill-white" />
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteCustomSound}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="حذف و بازگشت به صداهای پیش‌فرض"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {uploadError && (
                      <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center font-bold">
                        {uploadError}
                      </div>
                    )}

                    {/* Button to Upload Custom Audio */}
                    <label className="flex items-center justify-center gap-2 p-2 rounded-xl border border-dashed border-indigo-400/40 hover:bg-indigo-500/10 text-xs font-bold text-indigo-400 cursor-pointer transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      <span>انتخاب فایل زنگ دلخواه از گوشی (MP3 یا WAV)</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleUploadAudio}
                        className="hidden"
                      />
                    </label>

                    <div className="text-[10px] text-slate-400 px-1 pt-1 font-semibold">
                      یا انتخاب از صداهای زنگ استاندارد آماده:
                    </div>

                    {/* Standard Pre-recorded Acoustic Ringtones */}
                    <div className="space-y-1">
                      {SOUND_PRESETS.map((preset) => {
                        const isSelected = !customSound && selectedSound === preset.id;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => handlePreviewSound(preset.id)}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "bg-indigo-500/20 border border-indigo-500/40 font-bold"
                                : "hover:bg-white/5 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isSelected ? "bg-indigo-400" : "bg-white/20"
                                }`}
                              />
                              <div>
                                <div style={{ color: fg }}>{preset.name}</div>
                                <div className="text-[10px]" style={{ color: fgMuted }}>
                                  {preset.description}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewSound(preset.id);
                                }}
                                className="flex items-center justify-center h-6 w-6 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-300 cursor-pointer"
                                title="پخش صدا"
                              >
                                <Play className="h-3 w-3 fill-indigo-300" />
                              </button>
                              {isSelected && <Check className="h-4 w-4 text-indigo-400" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Vibration Selector */}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: itemCardBorder, backgroundColor: itemCardBg }}
              >
                <button
                  type="button"
                  onClick={() => setShowVibePicker(!showVibePicker)}
                  className="w-full flex items-center justify-between p-3 text-xs font-medium transition-colors hover:bg-white/5 cursor-pointer"
                  style={{ color: fg }}
                >
                  <div className="flex items-center gap-2">
                    <Vibrate className="h-4 w-4 text-emerald-400" />
                    <span className="font-bold">الگوی ویبره:</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300"
                    >
                      {currentVibeObj.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1" style={{ color: fgMuted }}>
                    {showVibePicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {showVibePicker && (
                  <div className="p-2 border-t border-dashed space-y-1" style={{ borderColor: cardBorder }}>
                    {VIBRATION_PRESETS.map((vibe) => {
                      const isSelected = selectedVibration === vibe.id;
                      return (
                        <div
                          key={vibe.id}
                          onClick={() => handlePreviewVibration(vibe.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-emerald-500/20 border border-emerald-500/40 font-bold"
                              : "hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          <div>
                            <div style={{ color: fg }}>{vibe.name}</div>
                            <div className="text-[10px]" style={{ color: fgMuted }}>
                              {vibe.description}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-emerald-400" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Days Selection Section with Toggle Arrow */}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: itemCardBorder, backgroundColor: itemCardBg }}
              >
                <button
                  type="button"
                  onClick={() => setShowDaysPicker(!showDaysPicker)}
                  className="w-full flex items-center justify-between p-3 text-xs font-medium transition-colors hover:bg-white/5 cursor-pointer"
                  style={{ color: fg }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">تکرار یادآوری:</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: isEveryDay ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)",
                        color: isEveryDay ? "#818cf8" : "#fbbf24"
                      }}
                    >
                      {isEveryDay ? "هر روز هفته" : `${selectedDays.length} روز در هفته`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1" style={{ color: fgMuted }}>
                    <span className="text-[10px]">
                      {showDaysPicker ? "بستن روزها" : "انتخاب روزهای خاص"}
                    </span>
                    {showDaysPicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {showDaysPicker && (
                  <div className="p-3 border-t border-dashed space-y-2.5" style={{ borderColor: cardBorder }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: fgMuted }}>
                        روزهای انتخابی:
                      </span>
                      {!isEveryDay && (
                        <button
                          type="button"
                          onClick={handleSelectAllDays}
                          className="text-[10px] font-bold text-indigo-400 hover:underline cursor-pointer"
                        >
                          انتخاب همه (هر روز)
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {WEEK_DAYS.map((day) => {
                        const isSelected = selectedDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => handleToggleDay(day.id)}
                            className={`py-2 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                              isSelected
                                ? "bg-indigo-500 text-white shadow-sm font-bold"
                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            <span>{day.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Behaviour Notice */}
              <div
                className="p-2.5 rounded-xl space-y-1 text-[11px] leading-relaxed border"
                style={{ backgroundColor: itemCardBg, borderColor: itemCardBorder, color: fgMuted }}
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Check className="h-3.5 w-3.5" />
                  رفتار هوشمند بدون مزاحمت:
                </div>
                <div>
                  اگر در طول روز عادت را تیک بزنید، یادآور آن روز به صورت خودکار لغو شده و فرستاده نمی‌شود.
                </div>
              </div>
            </motion.div>
          )}

          {/* Always Visible Test Button */}
          <div className="pt-2 border-t border-white/5 space-y-1">
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testSent}
              className="w-full py-2.5 px-3 rounded-xl border border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              style={{ color: fg }}
            >
              <Volume2 className="h-4 w-4 text-indigo-400" />
              {testSent ? "صدا، ویبره و اعلان پخش شد ✓" : "تست زنگ، صدا و ویبره فعلی"}
            </button>
            <div className="text-[10px] text-center" style={{ color: fgMuted }}>
              (پخش صدای واقعی: «{customSound ? "فایل اختصاصی شما" : currentSoundObj.name}» و ویبره «{currentVibeObj.name}»)
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center justify-end gap-2 p-3.5 border-t"
          style={{ backgroundColor: footerBg, borderColor: itemCardBorder }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium hover:bg-white/10 cursor-pointer"
            style={{ color: fgMuted }}
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            ذخیره تنظیمات
          </button>
        </div>
      </motion.div>
    </div>
  );
}
