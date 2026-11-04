import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown,
  ChevronUp,
  Calendar, 
  Plus, 
  Trash2, 
  Check, 
  RefreshCw, 
  BookOpen, 
  Coffee, 
  Award, 
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Save,
  BarChart3,
  Trash,
  Star,
  Play,
  Square,
  Link2,
  SlidersHorizontal,
  Activity
} from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { 
  PlannerEntry, 
  PlannerStore, 
  PlannerPreset, 
  PlannerPresetStore, 
  RecurringActivity, 
  RecurringActivityStore,
  TaskStore,
  Task,
  TimelineEntryStore
} from "@/lib/store";
import { PlannerTimerService, ActivePlannerTimer } from "@/lib/plannerTimer";
import PlannerLinkModal from "@/components/planner/PlannerLinkModal";
import { 
  toShamsi, 
  getGregorianToday, 
  addDays, 
  toPersianDigits, 
  gregorianToJalali, 
  getTodayJalali, 
  toShamsiShort
} from "@/lib/shamsi";
import JalaliCalendar, { DayMeta } from "@/components/shared/JalaliCalendar";
import {
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

// مبدل جامع تمام ارقام فارسی و عربی به انگلیسی برای پردازش دقیق
function toEnglishDigits(str: string): string {
  if (!str) return "";
  return str
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
}

// پارسر قدرتمند طول بازه زمانی به دقیقه
function parseTimeSlotDuration(slot: string): number {
  if (!slot) return 0;
  
  // ۱. تبدیل ارقام فارسی و عربی به انگلیسی
  let str = toEnglishDigits(slot);
  
  // ۲. حذف کاراکترهای کنترل جهت متن LTR/RTL (مثل \u200e و \u200f) که ممکن است توسط مرورگر یا کیبورد اضافه شوند
  str = str.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]/g, "");

  // ۳. جایگزینی تمام انواع خط تیره، اسلش، دونقطه، تیلدا و کلمات جداکننده رایج با کاراکتر استاندارد "-"
  str = str.replace(/[\s]*[ـ\-‐‑‒–—―⁃⁻₋−➖_~〜〰\/\\]+[\s]*/g, "-");
  str = str.replace(/(تا ساعت|الی ساعت|تا|الی|to)/gi, "-");
  
  let parts = str.split("-").map(p => p.trim()).filter(Boolean);
  
  // ۴. اگر جداکننده استاندارد پیدا نشد، تلاش کنیم دو زمان مجزا با فرمت ساعت:دقیقه یا ساعت.دقیقه را پیدا کنیم
  if (parts.length !== 2) {
    const timeMatches = str.match(/\d{1,2}[:.٫]\d{2}/g);
    if (timeMatches && timeMatches.length === 2) {
      parts = [timeMatches[0], timeMatches[1]];
    } else {
      // تلاش ثانویه برای پیدا کردن دو عدد ۳ یا ۴ رقمی متمایز (مثل 0730 0900)
      const numberMatches = str.match(/\d{3,4}/g);
      if (numberMatches && numberMatches.length === 2) {
        parts = [numberMatches[0], numberMatches[1]];
      } else {
        // اگر بازه دوطرفه نبود، بررسی کنیم آیا کاربر یک عدد یا مدت زمان مشخص (مثل 20 یا 45 دقیقه) وارد کرده است
        const singleMins = parseMinutesValue(str);
        if (singleMins > 0) return singleMins;
        return 0;
      }
    }
  }

  const parseTimeStr = (t: string): { h: number; m: number } | null => {
    // تبدیل جداکننده‌های نقطه، ممیز و خط مورب به دونقطه
    let normalized = t.replace(/[./\/\\٫]/g, ":");
    const clean = normalized.replace(/[^0-9:]/g, "");
    if (!clean) return null;
    
    let h = 0;
    let m = 0;
    
    if (clean.includes(":")) {
      const bits = clean.split(":").map(Number);
      h = bits[0] || 0;
      m = bits[1] || 0;
    } else {
      const num = Number(clean);
      if (num >= 100 && num <= 2400) {
        h = Math.floor(num / 100);
        m = num % 100;
      } else {
        h = num;
        m = 0;
      }
    }
    
    // تشخیص عصر / شب / بعد از ظهر / PM برای سیستم ۱۲ ساعته
    const isPm = /pm|بعد از ظهر|بعد‌از‌ظهر|عصر|شب/i.test(t);
    if (isPm && h < 12) {
      h += 12;
    }
    
    // تشخیص صبح / قبل از ظهر / AM
    const isAm = /am|صبح|قبل از ظهر|قبل‌از‌ظهر/i.test(t);
    if (isAm && h === 12) {
      h = 0;
    }
    
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return { h, m };
    }
    return null;
  };

  const start = parseTimeStr(parts[0]);
  const end = parseTimeStr(parts[1]);
  if (!start || !end) return 0;

  let startMin = start.h * 60 + start.m;
  let endMin = end.h * 60 + end.m;

  let diff = endMin - startMin;
  if (diff < 0) {
    // اگر اختلاف منفی باشد، دو حالت دارد:
    // ۱. ترتیب شروع و پایان برعکس تایپ/خوانده شده است (مثلاً 09:00 - 07:30 به خاطر جهت راست به چپ یا اشتباه کاربر)
    // ۲. بازه از نیمه‌شب عبور کرده است (مثلاً 23:00 - 01:00)
    // اگر تفاضل مطلق کمتر از ۱۲ ساعت (۷۲۰ دقیقه) باشد، مطمئناً حالت اول (ترتیب معکوس) است.
    const absDiff = Math.abs(diff);
    if (absDiff < 720) {
      diff = absDiff;
    } else {
      // در غیر این صورت بازه از نیمه‌شب عبور کرده است
      diff = diff + 1440;
    }
  }

  return diff;
}

// پارسر هوشمند و بسیار منعطف مقادیر ورودی مطالعه به دقیقه
function parseMinutesValue(val: string | undefined, isRest: boolean = false): number {
  if (!val) return 0;
  let str = val.trim().toLowerCase();
  
  // ۱. تبدیل تمام رقم‌های فارسی و عربی به انگلیسی
  str = toEnglishDigits(str);

  // ۲. هندل کردن اصطلاحات خاص فارسی مثل "نیم ساعت"، "ساعت و نیم"
  if (str === "نیم" || str === "نیم ساعت" || str === "نیم‌ساعت") {
    return 30;
  }
  if (str === "ربع" || str === "ربع ساعت" || str === "یک ربع") {
    return 15;
  }
  if (str === "سه ربع") {
    return 45;
  }

  // ۳. فرمت ساختاری مثل 1:30
  if (/:/.test(str)) {
    const parts = str.split(":").map(Number);
    const hrs = parts[0] || 0;
    const mins = parts[1] || 0;
    return hrs * 60 + mins;
  }

  // ۴. بررسی وجود کلمات کلیدی "ساعت" و "دقیقه" به همراه "و نیم"
  const hasHoursUnit = /ساعت|h|hour|hr/i.test(str);
  const hasMinutesUnit = /دقیقه|min|minute|دق/i.test(str);
  const hasHalfHour = /و نیم|و‌نیم/i.test(str);

  // اگر هم ساعت و هم دقیقه ذکر شده باشد، مثلاً "1 ساعت و 30 دقیقه" یا "1h 30m"
  if (hasHoursUnit && hasMinutesUnit) {
    const numbers = str.match(/[0-9.]+/g);
    if (numbers && numbers.length >= 2) {
      const hrs = parseFloat(numbers[0]) || 0;
      const mins = parseFloat(numbers[1]) || 0;
      return Math.round(hrs * 60 + mins);
    }
  }

  const numMatch = str.match(/[0-9.]+/);
  if (!numMatch) {
    // اگر عددی پیدا نشد ولی کلمه "ساعت و نیم" بود
    if (/ساعت و نیم|ساعت‌ونیم/.test(str)) return 90;
    if (/یک ساعت/.test(str)) return 60;
    if (/دو ساعت/.test(str)) return 120;
    if (/سه ساعت/.test(str)) return 180;
    return 0;
  }

  const num = parseFloat(numMatch[0]);
  if (isNaN(num)) return 0;

  // اگر کلمه "و نیم" داشت یعنی نیم ساعت اضافه شود
  let extraMins = 0;
  if (hasHalfHour) {
    extraMins = 30;
  }

  if (hasHoursUnit) {
    return Math.round(num * 60) + extraMins;
  }

  if (hasMinutesUnit) {
    return Math.round(num);
  }

  // اگر هیچ واحدی مشخص نشده بود:
  // اگر فیلد استراحت باشد، به هیچ وجه فرض ساعت بودن برای اعداد کوچک نمی‌کنیم
  if (isRest) {
    return Math.round(num);
  }

  // اگر "و نیم" داشت، فرض می‌کنیم ساعت است (مثلاً "1 و نیم" -> 90 دقیقه)
  if (hasHalfHour) {
    return Math.round(num * 60) + 30;
  }

  // ۱. اگر عدد اعشاری باشد (مثل 1.5)، ساعت است.
  if (str.includes(".") || str.includes("٫")) {
    return Math.round(num * 60);
  }

  // ۲. در غیر این صورت، ورودی بر حسب دقیقه است (مثل 3، 15، 45، 60، 90، 120)
  return Math.round(num);
}

// بررسی دقیق اینکه آیا یک بازه زمانی شامل زمان لحظه‌ای کنونی است یا خیر
function isSlotCurrentTime(slot: string, dateStr: string, now: Date = new Date()): boolean {
  if (!slot || !dateStr) return false;
  if (dateStr !== getGregorianToday()) return false;

  let str = toEnglishDigits(slot);
  str = str.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]/g, "");
  str = str.replace(/[\s]*[ـ\-‐‑‒–—―⁃⁻₋−➖_~〜〰\/\\]+[\s]*/g, "-");
  str = str.replace(/(تا ساعت|الی ساعت|تا|الی|to)/gi, "-");

  let parts = str.split("-").map(p => p.trim()).filter(Boolean);
  if (parts.length !== 2) {
    const timeMatches = str.match(/\d{1,2}[:.٫]\d{2}/g);
    if (timeMatches && timeMatches.length === 2) {
      parts = [timeMatches[0], timeMatches[1]];
    } else {
      const numberMatches = str.match(/\d{3,4}/g);
      if (numberMatches && numberMatches.length === 2) {
        parts = [numberMatches[0], numberMatches[1]];
      } else {
        return false;
      }
    }
  }

  const parseTimeStr = (t: string): { h: number; m: number } | null => {
    let normalized = t.replace(/[./\/\\٫]/g, ":");
    const clean = normalized.replace(/[^0-9:]/g, "");
    if (!clean) return null;
    let h = 0;
    let m = 0;
    if (clean.includes(":")) {
      const bits = clean.split(":").map(Number);
      h = bits[0] || 0;
      m = bits[1] || 0;
    } else {
      const num = Number(clean);
      if (num >= 100 && num <= 2400) {
        h = Math.floor(num / 100);
        m = num % 100;
      } else {
        h = num;
        m = 0;
      }
    }
    const isPm = /pm|بعد از ظهر|بعد‌از‌ظهر|عصر|شب/i.test(t);
    if (isPm && h < 12) h += 12;
    const isAm = /am|صبح|قبل از ظهر|قبل‌از‌ظهر/i.test(t);
    if (isAm && h === 12) h = 0;
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) {
      if (h === 24) h = 0;
      return { h, m };
    }
    return null;
  };

  const start = parseTimeStr(parts[0]);
  const end = parseTimeStr(parts[1]);
  if (!start || !end) return false;

  let startMin = start.h * 60 + start.m;
  let endMin = end.h * 60 + end.m;

  const diff = endMin - startMin;
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 720) {
      // اگر کمتر از ۱۲ ساعت اختلاف داشته باشد، ترتیب تایپ معکوس بوده است
      const temp = startMin;
      startMin = endMin;
      endMin = temp;
    } else {
      // بازه از نیمه‌شب عبور کرده است (مانند 23:00 تا 01:00)
      const currentMin = now.getHours() * 60 + now.getMinutes();
      return currentMin >= startMin || currentMin < endMin;
    }
  }

  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin >= startMin && currentMin < endMin;
}

// خواندن کل رکوردهای برنامه‌ریزی به صورت خام از لوکال استوریج برای آمار سراسری
function getAllPlannerEntriesRaw(): PlannerEntry[] {
  try {
    const val = localStorage.getItem("focusflow_planner");
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export default function PlannerView() {
  const { bg, fg, fgMuted, cardBorder, inputBg, sidebarBg } = useThemeStyles();
  const [activeTab, setActiveTab] = useState<"planner" | "stats">("planner");
  const [currentDate, setCurrentDate] = useState<string>(getGregorianToday());
  const [entries, setEntries] = useState<PlannerEntry[]>([]);
  const [activities, setActivities] = useState<RecurringActivity[]>([]);
  const [presets, setPresets] = useState<PlannerPreset[]>([]);
  const [activeSubjectDropdown, setActiveSubjectDropdown] = useState<string | null>(null);
  const [selectedActivityForTags, setSelectedActivityForTags] = useState<string | null>(null);
  const [focusedSubjectId, setFocusedSubjectId] = useState<string | null>(null);
  
  // متغیرهای حالت ذخیره پریست جدید
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  // === فیلترها و سیستم تایید نهایی ۳ ثانیه‌ای جدید ===
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    cancelText?: string;
    requireCountdown: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [confirmCountdown, setConfirmCountdown] = useState(3);
  
  // حالت پیام موفقیت (توست شناور)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // خطای اعتبارسنجی ثبت قالب
  const [savePresetError, setSavePresetError] = useState("");

  // حالت اطمینان سراسری (از لوکال استوریج)
  const [safeMode, setSafeMode] = useState(() => {
    return localStorage.getItem("focusflow_safe_mode") !== "false";
  });

  // شناسه قالب فعال و پیش‌فرض برای روزهای جدید آینده
  const [activePresetId, setActivePresetId] = useState<string>(() => {
    return localStorage.getItem("focusflow_active_preset_id") || "default";
  });

  // حالت اتصال تسک و عادت و مدیریت آستانه درصد
  const [linkModalEntry, setLinkModalEntry] = useState<PlannerEntry | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActivePlannerTimer | null>(() => PlannerTimerService.getActiveTimer());
  const [globalThreshold, setGlobalThreshold] = useState<number>(() => PlannerStore.getGlobalThreshold());
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdInput, setThresholdInput] = useState<string>(() => PlannerStore.getGlobalThreshold().toString());

  // بارگذاری داده‌های اولیه
  useEffect(() => {
    setEntries(PlannerStore.listByDate(currentDate));
    setActivities(RecurringActivityStore.list());
    setPresets(PlannerPresetStore.list());
  }, [currentDate]);

  // رویداد هماهنگی تغییرات دیتابیس سراسری
  useEffect(() => {
    const handleDataChanged = () => {
      setEntries(PlannerStore.listByDate(currentDate));
      setActivities(RecurringActivityStore.list());
      setPresets(PlannerPresetStore.list());
      setActiveTimer(PlannerTimerService.getActiveTimer());
    };
    const handleTimerChange = (e: Event) => {
      const customEvent = e as CustomEvent<ActivePlannerTimer | null>;
      setActiveTimer(customEvent.detail);
      setEntries(PlannerStore.listByDate(currentDate));
    };
    const handleThresholdChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setGlobalThreshold(customEvent.detail);
    };

    window.addEventListener("focusflow-data-changed", handleDataChanged);
    window.addEventListener("focusflow-db-synced", handleDataChanged);
    window.addEventListener("focusflow-planner-presets-changed", handleDataChanged);
    window.addEventListener("focusflow-planner-timer-change", handleTimerChange);
    window.addEventListener("focusflow-threshold-changed", handleThresholdChange as any);

    return () => {
      window.removeEventListener("focusflow-data-changed", handleDataChanged);
      window.removeEventListener("focusflow-db-synced", handleDataChanged);
      window.removeEventListener("focusflow-planner-presets-changed", handleDataChanged);
      window.removeEventListener("focusflow-planner-timer-change", handleTimerChange);
      window.removeEventListener("focusflow-threshold-changed", handleThresholdChange as any);
    };
  }, [currentDate]);

  // به‌روزرسانی زنده و ثانیه‌ای درصد و پیشرفت ردیف‌های جدول هنگام فعال بودن تایمر زنده
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => {
      setTimerTick((t) => (t + 1) % 100000);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // پیگیری ریل‌تایم زمان جاری برای تشخیص دقیق بازه زمانی هم‌اکنون و نمایش فلش راهنما
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);


  // هماهنگی حالت اطمینان از منوی کشویی هدر/سایدبار
  useEffect(() => {
    const handleSafeModeChanged = (e: any) => {
      if (e.detail && typeof e.detail.enabled === "boolean") {
        setSafeMode(e.detail.enabled);
      }
    };
    window.addEventListener("safe-mode-changed", handleSafeModeChanged);
    return () => {
      window.removeEventListener("safe-mode-changed", handleSafeModeChanged);
    };
  }, []);

  // بستن منوهای کشویی موضوع با کلیک به بیرون
  useEffect(() => {
    const clickOutside = () => {
      setActiveSubjectDropdown(null);
      setSelectedActivityForTags(null);
      setFocusedSubjectId(null);
    };
    document.addEventListener("click", clickOutside);
    return () => document.removeEventListener("click", clickOutside);
  }, []);

  // مدیریت شمارش معکوس ۳ ثانیه‌ای برای حذف‌های امن و قطعی
  useEffect(() => {
    if (confirmConfig && confirmConfig.isOpen && confirmConfig.requireCountdown) {
      setConfirmCountdown(3);
      const interval = setInterval(() => {
        setConfirmCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [confirmConfig]);

  // انقضای خودکار توست پیام‌ها
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ناوبری روزانه
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handlePrevDay = () => setCurrentDate(prev => addDays(prev, -1));
  const handleGoToToday = () => setCurrentDate(getGregorianToday());

  // مرجع تمرکز روی سطر جدید پس از ایجاد
  const pendingFocusRef = useRef<{ rowIndex: number; colIndex: number } | null>(null);

  // تحلیل موضوع تایپ‌شده برای جداسازی درس اصلی و هشتگ‌ها جهت نمایش زیبا و رنگی
  const parseSubject = (subjectText: string) => {
    if (!subjectText) return { activity: null, tagText: "" };

    const sortedActs = [...activities].sort((a, b) => b.name.length - a.name.length);
    for (const act of sortedActs) {
      const actName = act.name.replace(/^#/, "").trim();
      const cleanSubject = subjectText.replace(/^#/, "").trim();

      if (cleanSubject.startsWith(actName)) {
        const remaining = cleanSubject.slice(actName.length).trim();
        const cleanRemaining = remaining.replace(/^[◂|\-\/✦\s]+/, "").trim();
        return {
          activity: act,
          tagText: cleanRemaining || null
        };
      }
    }
    return { activity: null, tagText: subjectText };
  };

  // فوکوس دقیق و انتخاب متن هر سلول جدول برنامه‌ریزی
  const focusCell = useCallback((targetRow: number, targetCol: number) => {
    if (targetRow < 0 || targetRow >= entries.length) return;
    const clampedCol = Math.max(0, Math.min(5, targetCol));

    if (clampedCol === 5) {
      const entry = entries[targetRow];
      if (entry) {
        setFocusedSubjectId(entry.id);
        setActiveSubjectDropdown(entry.id);
        setSelectedActivityForTags(null);
      }
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          `input[data-row="${targetRow}"][data-col="5"]`
        );
        if (input) {
          input.focus();
          input.select();
        }
      }, 20);
    } else {
      setFocusedSubjectId(null);
      setActiveSubjectDropdown(null);
      setSelectedActivityForTags(null);

      const input = document.querySelector<HTMLInputElement>(
        `[data-row="${targetRow}"][data-col="${clampedCol}"]`
      );
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [entries]);

  // فوکوس خودکار روی سطر تازه ایجاد شده
  useEffect(() => {
    if (pendingFocusRef.current) {
      const { rowIndex, colIndex } = pendingFocusRef.current;
      focusCell(rowIndex, colIndex);
      pendingFocusRef.current = null;
    }
  }, [entries, focusCell]);

  // حرکت سریع بین تمام خانه‌های جدول برنامه‌ریزی با کلیدهای جهت‌نما، اینتر و تب
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>, 
    rowIndex: number, 
    colIndex: number
  ) => {
    // جلوگیری از ناوبری هنگام انتخاب متن با شیفت
    if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      return;
    }

    if (e.key === "Escape") {
      setActiveSubjectDropdown(null);
      setSelectedActivityForTags(null);
      setFocusedSubjectId(null);
      return;
    }

    // کلید اینتر: حرکت به سطر بعد در همان ستون (مشابه اکسل)، یا ساخت سطر جدید در صورت رسیدن به انتهای جدول
    if (e.key === "Enter") {
      e.preventDefault();
      if (colIndex === 5) {
        setActiveSubjectDropdown(null);
        setSelectedActivityForTags(null);
      }
      if (rowIndex === entries.length - 1) {
        pendingFocusRef.current = { rowIndex: rowIndex + 1, colIndex };
        handleAddRow();
      } else {
        focusCell(rowIndex + 1, colIndex);
      }
      return;
    }

    // کلید تب: حرکت به ستون بعد یا سطر بعد
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (colIndex > 0) {
          focusCell(rowIndex, colIndex - 1);
        } else if (rowIndex > 0) {
          focusCell(rowIndex - 1, 5);
        }
      } else {
        if (colIndex < 5) {
          focusCell(rowIndex, colIndex + 1);
        } else if (rowIndex < entries.length - 1) {
          focusCell(rowIndex + 1, 0);
        } else {
          pendingFocusRef.current = { rowIndex: rowIndex + 1, colIndex: 0 };
          handleAddRow();
        }
      }
      return;
    }

    const isArrowKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
    if (!isArrowKey) return;

    // بررسی کرسر و انتخاب در ورودی‌ها برای جابجایی هوشمند
    const target = e.currentTarget as HTMLInputElement;
    const isInput = target.tagName === "INPUT";
    const valLength = isInput && typeof target.value === "string" ? target.value.length : 0;
    const isAllSelected = isInput && target.selectionStart === 0 && target.selectionEnd === valLength;
    const isAtStart = isInput && target.selectionStart === 0 && target.selectionEnd === 0;
    const isAtEnd = isInput && target.selectionStart === valLength && target.selectionEnd === valLength;
    const isCtrl = e.ctrlKey || e.metaKey;

    // فلش بالا: سطر قبل
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        focusCell(rowIndex - 1, colIndex);
      }
      return;
    }

    // فلش پایین: سطر بعد (در صورت قرار داشتن در آخرین سطر، سطر جدید ایجاد می‌شود)
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex === entries.length - 1) {
        pendingFocusRef.current = { rowIndex: rowIndex + 1, colIndex };
        handleAddRow();
      } else {
        focusCell(rowIndex + 1, colIndex);
      }
      return;
    }

    // فلش چپ: در جدول راست‌به‌چپ، جهت حرکت به سمت چپ (ستون بعدی: ۰ تا ۵)
    if (e.key === "ArrowLeft") {
      const shouldMove = !isInput || isCtrl || isAllSelected || isAtEnd || valLength === 0;
      if (shouldMove) {
        e.preventDefault();
        if (colIndex < 5) {
          focusCell(rowIndex, colIndex + 1);
        }
      }
      return;
    }

    // فلش راست: در جدول راست‌به‌چپ، جهت حرکت به سمت راست (ستون قبلی: ۵ تا ۰)
    if (e.key === "ArrowRight") {
      const shouldMove = !isInput || isCtrl || isAllSelected || isAtStart || valLength === 0;
      if (shouldMove) {
        e.preventDefault();
        if (colIndex > 0) {
          focusCell(rowIndex, colIndex - 1);
        }
      }
      return;
    }
  };

  // ذخیره خودکار ویرایش سلول‌ها و موازنه هوشمند استراحت واقعی
  const handleCellChange = (id: string, field: keyof PlannerEntry, value: any) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const updatedData: Partial<PlannerEntry> = { [field]: value };

    // اگر یکی از فیلدهای برنامه‌ریزی ویرایش شد:
    if (["plan_main", "plan_rest"].includes(field)) {
      const pm = parseMinutesValue(field === "plan_main" ? value : entry.plan_main);
      const pr = parseMinutesValue(field === "plan_rest" ? value : entry.plan_rest, true);
      const plannedSum = pm + pr;

      const am = parseMinutesValue(entry.actual_main);

      if (plannedSum > 0) {
        const balancedRest = Math.max(0, plannedSum - am);
        updatedData.actual_rest = balancedRest > 0 ? balancedRest.toString() : "0";
      }
    } else if (field === "actual_main") {
      // اگر فیلد اصلی واقعی ویرایش شد:
      const pm = parseMinutesValue(entry.plan_main);
      const pr = parseMinutesValue(entry.plan_rest, true);
      const plannedSum = pm + pr;

      if (plannedSum > 0) {
        const am = parseMinutesValue(value);
        const balancedRest = Math.max(0, plannedSum - am);
        updatedData.actual_rest = balancedRest > 0 ? balancedRest.toString() : "0";
      }
    }

    const updatedEntry = PlannerStore.update(id, updatedData);
    if (updatedEntry) {
      setEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
    }
  };

  // تیک زدن پارت به همراه هماهنگی خودکار تسک و عادت
  const handleToggleCheck = (entry: PlannerEntry) => {
    const nextChecked = !entry.is_checked;
    const updated = PlannerStore.update(entry.id, { is_checked: nextChecked });
    if (updated) {
      setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
      PlannerStore.syncTaskAndHabit(updated, nextChecked, currentDate);
      if (nextChecked) {
        setToastMessage("بازه تیک خورد و وضعیت تسک و عادت متصل به‌روزرسانی شد.");
      }
    }
  };

  // استارت و توقف تایمر زنده برای بازه زمانی
  const handleToggleTimer = (entry: PlannerEntry) => {
    const active = PlannerTimerService.getActiveTimer();
    if (active && active.entryId === entry.id) {
      const res = PlannerTimerService.stopTimer(entry.id);
      setEntries(PlannerStore.listByDate(currentDate));
      if (res?.isPassed) {
        setToastMessage(`هدف بازه محقق شد (${toPersianDigits(res.percentage)}٪) و تسک و عادت ثبت شدند!`);
      } else if (res) {
        setToastMessage(`تایمر متوقف شد (${toPersianDigits(res.percentage)}٪ ثبت شد).`);
      }
    } else {
      if (active) {
        PlannerTimerService.stopTimer(active.entryId);
      }
      // ملاک محاسبه درصد: زمان برنامه اصلی (اصلی ب)؛ اگر خالی بود طول کل بازه
      const planMainMins = parseMinutesValue(entry.plan_main);
      const slotDur = parseTimeSlotDuration(entry.time_slot);
      const targetDuration = planMainMins > 0 ? planMainMins : (slotDur > 0 ? slotDur : 60);

      PlannerTimerService.startTimer(entry, targetDuration);
      setEntries(PlannerStore.listByDate(currentDate));
      // توجه: طبق درخواست کاربر، پیام toast استارت حذف شد تا جلوی باز کردن سریع منو را نگیرد
    }
  };

  // ذخیره اتصال تسک، عادت و درصد اختصاصی
  const handleSaveLinks = (taskId: string | null, habitId: string | null, customThreshold: number | null) => {
    if (!linkModalEntry) return;

    let subject = linkModalEntry.subject;
    if (!subject.trim() && taskId) {
      const task = TaskStore.list().find(t => t.id === taskId);
      if (task) subject = task.title;
    }

    const updated = PlannerStore.update(linkModalEntry.id, {
      task_id: taskId,
      habit_id: habitId,
      custom_threshold: customThreshold,
      subject
    });

    if (updated) {
      setEntries(prev => prev.map(e => e.id === linkModalEntry.id ? updated : e));
      setToastMessage("اتصال تسک و عادت با موفقیت اعمال شد.");
    }
  };

  const handleInsertRowBetween = (index: number, entryId?: string) => {
    PlannerStore.insertAt(currentDate, index + 1, {
      time_slot: "00:00 - 00:00",
      subject: "",
      is_checked: false,
      plan_main: "",
      plan_side: "",
      plan_rest: "",
      plan_music: "",
      actual_main: "",
      actual_side: "",
      actual_rest: "",
      actual_music: ""
    }, entryId);
    pendingFocusRef.current = { rowIndex: index + 1, colIndex: 0 };
    setEntries(PlannerStore.listByDate(currentDate));
    setToastMessage("بازه زمانی جدید مابین سطرها ایجاد شد.");
  };

  // افزودن سطر جدید زمان‌بندی
  const handleAddRow = () => {
    PlannerStore.create(currentDate, {
      time_slot: "00:00 - 00:00",
      subject: "",
      is_checked: false,
      plan_main: "",
      plan_side: "",
      plan_rest: "",
      plan_music: "",
      actual_main: "",
      actual_side: "",
      actual_rest: "",
      actual_music: ""
    });
    setEntries(PlannerStore.listByDate(currentDate));
  };

  // حذف فیزیکی یک سطر (تایم لاین) با قانون ۳ ثانیه انتظار در صورت روشن بودن حالت اطمینان
  const handleDeleteRow = (id: string) => {
    if (!safeMode) {
      PlannerStore.delete(id);
      setEntries(PlannerStore.listByDate(currentDate));
      setToastMessage("بازه زمانی با موفقیت حذف گردید.");
      return;
    }
    setConfirmConfig({
      isOpen: true,
      title: "حذف بازه زمانی (تایم‌لاین)",
      description: "آیا مطمئن هستید که می‌خواهید این بازه زمانی را حذف کنید؟ این پارت و تمامی اطلاعات ثبت‌شده در آن برای همیشه حذف خواهد شد.",
      confirmText: "حذف قطعی بازه",
      requireCountdown: true,
      onConfirm: () => {
        PlannerStore.delete(id);
        setEntries(PlannerStore.listByDate(currentDate));
        setConfirmConfig(null);
        setToastMessage("بازه زمانی با موفقیت حذف گردید.");
      }
    });
  };

  // صفر کردن و ریست کل برنامه امروز با قانون ۳ ثانیه انتظار در صورت روشن بودن حالت اطمینان
  const handleResetToday = () => {
    const performReset = () => {
      const updated = entries.map(e => {
        const u = PlannerStore.update(e.id, {
          is_checked: false,
          plan_main: "",
          plan_side: "",
          plan_rest: "",
          plan_music: "",
          actual_main: "",
          actual_side: "",
          actual_rest: "",
          actual_music: "",
          subject: ""
        });
        return u || e;
      });
      setEntries(updated);
      setToastMessage("برنامه امروز با موفقیت صفر و بازنشانی شد.");
    };

    if (!safeMode) {
      performReset();
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: "صفر کردن و ریست برنامه امروز",
      description: "آیا از صفر کردن برنامه‌ریزی امروز مطمئن هستید؟ تمام تایم‌های واقعی، برنامه‌ریزی‌ها، تیک‌ها و موضوعات امروز پاک شده و صفر خواهند شد.",
      confirmText: "ریست قطعی برنامه امروز",
      requireCountdown: true,
      onConfirm: () => {
        performReset();
        setConfirmConfig(null);
      }
    });
  };

  // ذخیره ساختار روز جاری به عنوان یک پریست جدید
  const handleSaveAsPreset = () => {
    if (!newPresetName.trim()) {
      setSavePresetError("لطفاً یک نام معتبر برای قالب انتخاب کنید.");
      return;
    }
    
    const currentSlots = entries.map(e => ({
      time_slot: e.time_slot,
      is_checked: false,
      plan_main: e.plan_main,
      plan_side: e.plan_side,
      plan_rest: e.plan_rest,
      plan_music: e.plan_music || "",
      actual_main: "",
      actual_side: "",
      actual_rest: "",
      actual_music: "",
      subject: e.subject,
      order: e.order
    }));

    PlannerPresetStore.save(newPresetName.trim(), currentSlots);
    setNewPresetName("");
    setSavePresetError("");
    setShowSavePresetModal(false);
    setToastMessage("قالب با موفقیت ذخیره شد! این الگو اکنون در سیستم شما ثبت گردید.");
  };

  // بارگذاری پریست انتخاب شده روی روز جاری با تاییدیه ایمن سفارشی در صورت روشن بودن حالت اطمینان
  const handleLoadPreset = (preset: PlannerPreset) => {
    const performLoad = () => {
      // نگاشت اسلات‌ها جهت ریست تیک‌ها و زمان‌های واقعی
      const loadedSlots = preset.slots.map(slot => ({
        ...slot,
        is_checked: false,
        actual_main: "",
        actual_side: "",
        actual_rest: "",
        actual_music: "",
      }));

      // جایگزینی فله‌ای و اتمیک با سرعت بالا بدون تحریک لوپ رندرینگ
      PlannerStore.replaceDayEntries(currentDate, loadedSlots);

      // نشان‌گذاری روز جاری به عنوان دارای قالب شخصی اعمال شده دستی
      localStorage.setItem(`focusflow_custom_applied_${currentDate}`, preset.id);

      // ریلود مجدد وضعیت
      setEntries(PlannerStore.listByDate(currentDate));
      setToastMessage(`قالب "${preset.name}" با موفقیت فقط روی روز جاری اعمال گردید.`);
    };

    if (!safeMode) {
      performLoad();
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: `بارگذاری قالب "${preset.name}"`,
      description: `آیا مایلید قالب برنامه‌ریزی "${preset.name}" را فقط روی روز جاری بارگذاری و اعمال کنید؟ این کار برنامه‌ریزی روز جاری را کاملاً بازنویسی خواهد کرد.`,
      confirmText: "بارگذاری و اعمال الگو",
      requireCountdown: false, // بارگذاری تخریبی برای دیتابیس کلی نیست، تاییدیه فوری کافیست
      onConfirm: () => {
        performLoad();
        setConfirmConfig(null);
      }
    });
  };

  // تنظیم قالب به عنوان الگوی پیش‌فرض و اعمال ریل تایم روی روز جاری (در صورت عدم سفارشی‌سازی) و آینده
  const handleSetDefaultPreset = (presetId: string, name: string) => {
    localStorage.setItem("focusflow_active_preset_id", presetId);
    setActivePresetId(presetId);
    
    const foundPreset = presets.find((p) => p.id === presetId);
    const slots = foundPreset ? foundPreset.slots : [];

    // بررسی کنیم که آیا روز جاری قبلاً الگوی دستی بر روی آن اعمال شده است یا خیر
    const hasCustomAppliedCurrent = !!localStorage.getItem(`focusflow_custom_applied_${currentDate}`);

    if (!hasCustomAppliedCurrent) {
      const loadedSlots = slots.map((slot, index) => ({
        time_slot: slot.time_slot || "00:00 - 00:00",
        is_checked: false,
        plan_main: slot.plan_main || "",
        plan_side: slot.plan_side || "",
        plan_rest: slot.plan_rest || "",
        plan_music: slot.plan_music || "",
        actual_main: "",
        actual_side: "",
        actual_rest: "",
        actual_music: "",
        subject: slot.subject || "",
        order: slot.order !== undefined ? slot.order : index
      }));

      // جایگزینی فله‌ای روی روز جاری در استور
      PlannerStore.replaceDayEntries(currentDate, loadedSlots);
    }
    
    // پاکسازی خودکار روزهای آینده که دست‌نخورده و فاقد قالب اعمالی دستی هستند
    PlannerStore.clearUntouchedFutureDays(getGregorianToday());
    
    // بروزرسانی رکوردهای روز جاری در استیت
    setEntries(PlannerStore.listByDate(currentDate));
    
    setToastMessage(`قالب "${name}" با موفقیت به عنوان الگوی پیش‌فرض ثبت شد و تغییرات فوراً اعمال گردید.`);
  };

  // بازنشانی به زمان‌بندی کالیبره سیستم
  const handleClearDefaultPreset = () => {
    localStorage.setItem("focusflow_active_preset_id", "default");
    setActivePresetId("default");
    
    // پاکسازی خودکار روزهای آینده که دست‌نخورده و سفید هستند
    PlannerStore.clearUntouchedFutureDays(getGregorianToday());
    
    // بروزرسانی رکوردهای روز انتخابی فعلی
    setEntries(PlannerStore.listByDate(currentDate));
    
    setToastMessage("الگوی پیش‌فرض غیرفعال شد. روزهای جدید اکنون با بازه‌های استاندارد سیستم مقداردهی خواهند شد.");
  };

  // حذف فیزیکی یک پریست (قالب) با قانون ۳ ثانیه انتظار در صورت روشن بودن حالت اطمینان
  const handleDeletePreset = (id: string, name: string) => {
    const performDelete = () => {
      PlannerPresetStore.delete(id);
      if (id === activePresetId) {
        localStorage.setItem("focusflow_active_preset_id", "default");
        setActivePresetId("default");
      }
    };

    if (!safeMode) {
      performDelete();
      setToastMessage(`قالب "${name}" با موفقیت حذف گردید.`);
      return;
    }
    setConfirmConfig({
      isOpen: true,
      title: "حذف قالب برنامه‌ریزی (پریست)",
      description: `آیا مطمئن هستید که می‌خواهید قالب برنامه‌ریزی "${name}" را برای همیشه حذف کنید؟ این قالب دیگر در بخش الگوهای شما در دسترس نخواهد بود.`,
      confirmText: "حذف قطعی قالب",
      requireCountdown: true,
      onConfirm: () => {
        performDelete();
        setConfirmConfig(null);
        setToastMessage(`قالب "${name}" با موفقیت حذف گردید.`);
      }
    });
  };

  // محاسبه خلاصه آمارهای روز جاری
  const totals = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const pm = parseMinutesValue(entry.plan_main);
      const pr = parseMinutesValue(entry.plan_rest, true);
      const am = parseMinutesValue(entry.actual_main);
      const ar = parseMinutesValue(entry.actual_rest, true);

      acc.planStudy += pm;
      acc.actualStudy += am;
      acc.planRest += pr;
      acc.actualRest += ar;

      if (entry.is_checked) acc.checkedCount++;

      return acc;
    }, { 
      planStudy: 0, 
      actualStudy: 0, 
      planRest: 0, 
      actualRest: 0,
      checkedCount: 0 
    });
  }, [entries]);

  const studyAchievementRate = totals.planStudy > 0 
    ? Math.min(100, Math.round((totals.actualStudy / totals.planStudy) * 100)) 
    : 0;

  const totalCompletedRate = entries.length > 0
    ? Math.round((totals.checkedCount / entries.length) * 100)
    : 0;

  // نقشه پیش‌محاسبه درصد تحقق روزانه برای درج زیر روزهای تقویم جلالی
  const adherenceMap = useMemo(() => {
    const allEntries = getAllPlannerEntriesRaw();
    const map: Record<string, { plan: number; actual: number }> = {};
    allEntries.forEach(entry => {
      const pm = parseMinutesValue(entry.plan_main);
      const am = parseMinutesValue(entry.actual_main);
      
      if (!map[entry.date]) {
        map[entry.date] = { plan: 0, actual: 0 };
      }
      map[entry.date].plan += pm;
      map[entry.date].actual += am;
    });

    const finalMap: Record<string, number> = {};
    Object.entries(map).forEach(([date, val]) => {
      if (val.plan > 0) {
        finalMap[date] = Math.min(100, Math.round((val.actual / val.plan) * 100));
      } else {
        finalMap[date] = val.actual > 0 ? 100 : 0;
      }
    });
    return finalMap;
  }, [entries]);

  return (
    <div className="space-y-6 max-w-[96%] lg:max-w-[1450px] mx-auto px-1 sm:px-4" dir="rtl">
      {/* سوییچ تب‌های ردیاب */}
      <div className="flex gap-1.5 p-1 rounded-2xl border" style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}>
        <button
          onClick={() => setActiveTab("planner")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "planner" 
              ? "bg-indigo-500 text-white shadow-lg" 
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>دفتر برنامه‌ریزی روزانه (پلنر)</span>
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "stats" 
              ? "bg-indigo-500 text-white shadow-lg" 
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>گزارش‌ها و آمار پیشرفته کنکوری</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "planner" ? (
          <motion.div 
            key="planner-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* هدر ناوبری تاریخ */}
            <div 
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-3xl border gap-4"
              style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black animate-fade-in" style={{ color: fg }}>برنامه‌ریزی دقیق روزانه</h2>
                  <p className="text-[10px]" style={{ color: fgMuted }}>زمان‌بندی، دروس اصلی و جانبی، پارت‌های تفکیکی استراحت و ردیابی تداخل هوشمند</p>
                </div>
              </div>

              {/* بخش ناوبری روزها */}
              <div className="flex items-center gap-2 self-center md:self-auto">
                <button 
                  onClick={handleNextDay}
                  className="p-1.5 rounded-xl hover:bg-white/5 border transition-all text-gray-400 hover:text-white cursor-pointer"
                  style={{ borderColor: cardBorder }}
                  title="روز بعد"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                <div className="px-4 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-2 min-w-[170px] justify-center" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                  <span style={{ color: fg }}>{toShamsi(currentDate)}</span>
                </div>

                <button 
                  onClick={handlePrevDay}
                  className="p-1.5 rounded-xl hover:bg-white/5 border transition-all text-gray-400 hover:text-white cursor-pointer"
                  style={{ borderColor: cardBorder }}
                  title="روز قبل"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {currentDate !== getGregorianToday() && (
                  <button
                    onClick={handleGoToToday}
                    className="px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all bg-amber-500 text-white shadow-md cursor-pointer border-transparent"
                  >
                    امروز
                  </button>
                )}
              </div>
            </div>

            {/* کارت‌های آماری زیبا و راندمان */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* کارت ساعت مطالعه کل */}
              <div className="p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden" style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: fgMuted }}>ساعت مطالعه (درس اصلی)</span>
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="mt-2.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-indigo-400">{toPersianDigits(totals.actualStudy)}</span>
                    <span className="text-[10px] text-gray-400">از</span>
                    <span className="text-xs font-bold" style={{ color: fg }}>{toPersianDigits(totals.planStudy)}</span>
                    <span className="text-[9px]" style={{ color: fgMuted }}>دقیقه</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (totals.actualStudy / (totals.planStudy || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* کارت ردیاب استراحت */}
              <div className="p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden" style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: fgMuted }}>مجموع استراحت روزانه</span>
                  <Coffee className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-emerald-400">{toPersianDigits(totals.actualRest)}</span>
                    <span className="text-[10px] text-gray-400">از</span>
                    <span className="text-xs font-bold" style={{ color: fg }}>{toPersianDigits(totals.planRest)}</span>
                    <span className="text-[9px]" style={{ color: fgMuted }}>دقیقه</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (totals.actualRest / (totals.planRest || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* کارت درصد تحقق برنامه */}
              <div className="p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden" style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: fgMuted }}>درصد تحقق کل برنامه</span>
                  <Award className="h-4 w-4 text-amber-400 animate-bounce" />
                </div>
                <div className="mt-2.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-amber-400">{toPersianDigits(studyAchievementRate)}٪</span>
                    <span className="text-[9px]" style={{ color: fgMuted }}>تحقق هدف</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${studyAchievementRate}%` }} />
                  </div>
                </div>
              </div>

              {/* کارت تیک‌های تمام شده */}
              <div className="p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden" style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: fgMuted }}>بازه های کامل شده</span>
                  <Sparkles className="h-4 w-4 text-pink-400" />
                </div>
                <div className="mt-2.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-pink-400">{toPersianDigits(totals.checkedCount)}</span>
                    <span className="text-[10px] text-gray-400">از</span>
                    <span className="text-xs font-bold" style={{ color: fg }}>{toPersianDigits(entries.length)}</span>
                    <span className="text-[9px] mr-1" style={{ color: fgMuted }}>({toPersianDigits(totalCompletedRate)}٪)</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-pink-500 rounded-full" style={{ width: `${totalCompletedRate}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* راهنمای سریع خانه‌های جدول و تنظیم حد نصاب قبولی هدف */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[10px] text-indigo-300/95 leading-relaxed">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 flex-shrink-0 text-indigo-400" />
                <span>
                  <b>چرا وجود تیک بازه مهم است؟</b> تیک زدن پارت‌ها علاوه بر ثبت اتمام بازه، تسک‌ها و عادات متصل را به طور خودکار ثبت و هماهنگ می‌کند!
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setThresholdInput(globalThreshold.toString());
                    setShowThresholdModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all font-bold text-xs cursor-pointer flex-shrink-0"
                  title="تنظیم درصد قبولی برای کل پلنر"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>حد نصاب قبولی سیستم: {toPersianDigits(globalThreshold)}٪</span>
                </button>
              </div>
            </div>

            {/* جدول برنامه‌ریزی (Excel-like UI) */}
            <div 
              className="rounded-3xl border shadow-xl relative"
              style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}
            >
              <div className="overflow-x-auto pr-7 sm:pr-9">
                <table className="w-full text-right border-collapse min-w-[780px]">
                  <thead>
                    <tr className="border-b text-[10px] font-black tracking-wider text-gray-400 select-none bg-white/5" style={{ borderColor: cardBorder }}>
                      <th className="py-2.5 px-1 text-center w-10" style={{ width: 40 }}>+بین</th>
                      <th className="py-2.5 px-1 text-center w-12" style={{ width: 46 }}>تیک/تایمر</th>
                      <th className="py-2.5 px-2 text-center w-28" style={{ width: 112 }}>بازه زمانی</th>
                      <th className="py-2.5 px-1 text-center w-16 bg-indigo-500/5 border-l border-r" style={{ borderColor: cardBorder, width: 64 }}>اصلی (ب)</th>
                      <th className="py-2.5 px-1 text-center w-16 bg-indigo-500/5 border-r" style={{ borderColor: cardBorder, width: 64 }}>استراحت (ب)</th>
                      <th className="py-2.5 px-1 text-center w-16 bg-amber-500/5 border-r" style={{ borderColor: cardBorder, width: 64 }}>اصلی (و)</th>
                      <th className="py-2.5 px-1 text-center w-16 bg-amber-500/5 border-r" style={{ borderColor: cardBorder, width: 64 }}>استراحت (و)</th>
                      <th className="py-2.5 px-3">موضوع / فعالیت (Subject)</th>
                      <th className="py-2.5 px-2 text-center w-10" style={{ width: 40 }}>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {entries.map((entry, rowIndex) => {
                        // محاسبه دقیق تداخل زمانی
                        const slotDur = parseTimeSlotDuration(entry.time_slot);
                        const plannedSum = parseMinutesValue(entry.plan_main) + parseMinutesValue(entry.plan_rest, true);
                        const actualSum = parseMinutesValue(entry.actual_main) + parseMinutesValue(entry.actual_rest, true);
                        
                        const isTimerRunningThis = activeTimer?.entryId === entry.id;
                        const planMainMinutes = parseMinutesValue(entry.plan_main);

                        // ملاک درصدگیری: اگر تایمر فعال است از زمان هدف تایمر؛ در غیر این صورت زمان درس اصلی؛ اگر خالی بود طول کل بازه
                        const targetDurationMins = (isTimerRunningThis && activeTimer?.targetDurationMinutes)
                          ? activeTimer.targetDurationMinutes
                          : (planMainMinutes > 0 ? planMainMinutes : (slotDur > 0 ? slotDur : 60));

                        const effectiveThreshold = entry.custom_threshold ?? globalThreshold;

                        // محاسبه دقیق کل ثانیه‌های کارکرد با احتساب ثانیه‌های دقیق ذخیره‌شده
                        const actualMainMinutes = parseMinutesValue(entry.actual_main);
                        let totalWorkedSeconds = Math.max(actualMainMinutes * 60, entry.elapsed_seconds || 0);

                        if (isTimerRunningThis && activeTimer) {
                          const elapsedNow = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
                          totalWorkedSeconds = activeTimer.accumulatedSeconds + Math.max(0, elapsedNow);
                        }

                        const targetTotalSeconds = targetDurationMins * 60;
                        const progressPercent = targetTotalSeconds > 0 
                          ? Math.min(100, Math.floor((totalWorkedSeconds / targetTotalSeconds) * 100)) 
                          : 0;
                        const isPassedThreshold = progressPercent >= effectiveThreshold;


                        // بررسی نشست‌های موقت و پاز شده: اگر تایمر فعال است یا عملکرد ثبت‌شده هنوز به حد نصاب نرسیده و در میانه کار است، نباید اخطار عدم تطابق بدهد
                        const isPartialSession = isTimerRunningThis || ((entry.elapsed_seconds || 0) > 0 && !isPassedThreshold);

                        // بررسی دقیق مطابقت با طول بازه (تلرانس جزئی ۲ دقیقه‌ای برای خطاهای ناچیز)
                        const planExceeded = slotDur > 0 && plannedSum > slotDur;
                        const planDeficit = slotDur > 0 && plannedSum > 0 && plannedSum < slotDur && Math.abs(plannedSum - slotDur) > 2;
                        const actualExceeded = slotDur > 0 && actualSum > slotDur;
                        const actualDeficit = !isPartialSession && entry.is_checked && slotDur > 0 && plannedSum > 0 && actualSum > 0 && actualSum < plannedSum && Math.abs(actualSum - plannedSum) > 2;
                        const hasConflict = planExceeded || planDeficit || actualExceeded || actualDeficit;

                        const isOpenUpwards = entries.length > 2 && rowIndex >= entries.length - 2;
                        const isCurrentSlot = isSlotCurrentTime(entry.time_slot, currentDate, nowTime);

                        return (
                          <motion.tr 
                            key={entry.id}
                            id={`planner-row-${entry.id}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.15 }}
                            className="border-b last:border-0 hover:bg-white/5 transition-colors group align-middle relative"
                            style={{ 
                              borderColor: cardBorder,
                              background: progressPercent > 0 
                                ? `linear-gradient(to left, ${isPassedThreshold ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'} ${progressPercent}%, transparent ${progressPercent}%)` 
                                : undefined
                            }}
                          >
                            {/* ایجاد بازه مابین و نشانگر فلش بازه جاری */}
                            <td className="py-2 px-1 text-center relative" style={{ width: 40 }}>
                              {isCurrentSlot && (
                                <div 
                                  className="absolute -right-6 sm:-right-7 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none z-20"
                                  title="بازه زمانی هم‌اکنون"
                                >
                                  <svg 
                                    className="w-5 h-5 text-blue-300 fill-blue-300" 
                                    viewBox="0 0 16 16"
                                    aria-hidden="true"
                                  >
                                    <path d="M2.5 8l9.5-6.5v13L2.5 8z" />
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleInsertRowBetween(rowIndex, entry.id)}
                                className="p-1 rounded hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="ایجاد بازه جدید زیر این سطر"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </td>

                            {/* ۱. چک‌باکس تیک اتمام بازه و استارت/توقف تایمر زنده */}
                            <td className="py-2 px-1 text-center" style={{ width: 46 }}>
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCheck(entry)}
                                  className={`mx-auto h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                                    entry.is_checked 
                                      ? "bg-emerald-500 border-emerald-500 text-white scale-105 shadow-md shadow-emerald-500/20" 
                                      : "border-gray-500 hover:border-amber-500"
                                  }`}
                                  title={entry.is_checked ? "تیک‌خورده (کلیک برای لغو)" : "تیک زدن و ثبت اتمام بازه (هماهنگ با تسک و عادت)"}
                                >
                                  {entry.is_checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleTimer(entry)}
                                  className={`mx-auto h-5 w-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                    isTimerRunningThis
                                      ? "bg-amber-500 text-white animate-pulse shadow-md shadow-amber-500/30 scale-105"
                                      : "bg-white/5 hover:bg-amber-500/20 text-gray-400 hover:text-amber-400"
                                  }`}
                                  title={isTimerRunningThis ? "توقف تایمر و ثبت عملکرد" : "استارت تایمر زنده بازه"}
                                >
                                  {isTimerRunningThis ? (
                                    <Square className="h-2 w-2 fill-current" />
                                  ) : (
                                    <Play className="h-2 w-2 fill-current ml-0.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* ۲. ستون بازه زمانی به همراه اخطار قرمز هوشمند در صورت تداخل */}
                            <td className="py-2 px-1 text-center" style={{ width: 112 }}>
                              <div className="flex items-center gap-1 relative justify-center">
                                <input
                                  type="text"
                                  dir="ltr"
                                  data-row={rowIndex}
                                  data-col={0}
                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                                  onFocus={(e) => e.target.select()}
                                  value={entry.time_slot}
                                  onChange={(e) => handleCellChange(entry.id, "time_slot", e.target.value)}
                                  placeholder="مثلاً ۰۹:۰۰"
                                  className={`w-full bg-transparent border-0 px-0.5 py-1 text-xs font-bold text-center focus:ring-1 rounded-lg transition-all placeholder:text-gray-600 focus:bg-white/5 ${
                                    hasConflict
                                      ? "text-rose-400 focus:ring-rose-500"
                                      : "text-gray-200 focus:ring-amber-500"
                                  }`}
                                />
                                
                                {hasConflict && (
                                  <div 
                                    className="text-rose-500 cursor-help flex-shrink-0 animate-pulse"
                                    title={
                                      [
                                        planExceeded && `⚠️ تداخل برنامه: مجموع برنامه‌ریزی شما (${toPersianDigits(plannedSum)} دقیقه) بیشتر از طول بازه (${toPersianDigits(slotDur)} دقیقه) است.`,
                                        planDeficit && `⚠️ عدم تطابق برنامه: مجموع برنامه‌ریزی شما (${toPersianDigits(plannedSum)} دقیقه) کمتر از طول بازه (${toPersianDigits(slotDur)} دقیقه) است.`,
                                        actualExceeded && `⚠️ تداخل واقعی: مجموع عملکرد واقعی ثبت‌شده (${toPersianDigits(actualSum)} دقیقه) بیشتر از طول بازه (${toPersianDigits(slotDur)} دقیقه) است.`,
                                        actualDeficit && `⚠️ عدم تطابق واقعی: مجموع عملکرد واقعی ثبت‌شده (${toPersianDigits(actualSum)} دقیقه) کمتر از مقدار برنامه‌ریزی شده (${toPersianDigits(plannedSum)} دقیقه) است.`
                                      ].filter(Boolean).join("\n")
                                    }
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              {progressPercent > 0 && (
                                <div className="flex items-center justify-center gap-1 mt-0.5" title={`تحقق بازه: ${toPersianDigits(progressPercent)}٪ (هدف: ${toPersianDigits(effectiveThreshold)}٪)`}>
                                  <span className={`text-[9px] font-mono font-black ${isPassedThreshold ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {toPersianDigits(progressPercent)}٪
                                  </span>
                                  <div className="w-10 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${isPassedThreshold ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* ۳. درس اصلی برنامه‌ریزی‌شده */}
                            <td className="py-2 px-1 border-l border-r bg-indigo-500/[0.01]" style={{ borderColor: cardBorder, width: 64 }}>
                              <input
                                type="text"
                                dir="ltr"
                                data-row={rowIndex}
                                data-col={1}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                                onFocus={(e) => e.target.select()}
                                value={entry.plan_main}
                                onChange={(e) => handleCellChange(entry.id, "plan_main", e.target.value)}
                                placeholder="--"
                                className="w-full bg-transparent border-0 py-1 text-xs font-mono text-center focus:ring-1 focus:ring-indigo-500 rounded-lg text-indigo-300 font-bold focus:bg-white/5 placeholder:text-gray-700"
                              />
                            </td>

                            {/* ۴. استراحت برنامه‌ریزی‌شده */}
                            <td className="py-2 px-1 border-r bg-indigo-500/[0.01]" style={{ borderColor: cardBorder, width: 64 }}>
                              <input
                                type="text"
                                dir="ltr"
                                data-row={rowIndex}
                                data-col={2}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                                onFocus={(e) => e.target.select()}
                                value={entry.plan_rest}
                                onChange={(e) => handleCellChange(entry.id, "plan_rest", e.target.value)}
                                placeholder="--"
                                className="w-full bg-transparent border-0 py-1 text-xs font-mono text-center focus:ring-1 focus:ring-indigo-500 rounded-lg text-emerald-400/80 font-bold focus:bg-white/5 placeholder:text-gray-700"
                              />
                            </td>

                            {/* ۵. تایم واقعی درس اصلی */}
                            <td className="py-2 px-1 border-r bg-amber-500/[0.01]" style={{ borderColor: cardBorder, width: 64 }}>
                              <input
                                type="text"
                                dir="ltr"
                                data-row={rowIndex}
                                data-col={3}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                                onFocus={(e) => e.target.select()}
                                value={entry.actual_main}
                                onChange={(e) => handleCellChange(entry.id, "actual_main", e.target.value)}
                                placeholder="--"
                                className="w-full bg-transparent border-0 py-1 text-xs font-mono text-center focus:ring-1 focus:ring-amber-500 rounded-lg text-amber-400 font-bold focus:bg-white/5 placeholder:text-gray-700"
                              />
                            </td>

                            {/* ۶. تایم واقعی استراحت */}
                            <td className="py-2 px-1 border-r bg-amber-500/[0.01]" style={{ borderColor: cardBorder, width: 64 }}>
                              <input
                                type="text"
                                dir="ltr"
                                data-row={rowIndex}
                                data-col={4}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 4)}
                                onFocus={(e) => e.target.select()}
                                value={entry.actual_rest}
                                onChange={(e) => handleCellChange(entry.id, "actual_rest", e.target.value)}
                                placeholder="--"
                                className="w-full bg-transparent border-0 py-1 text-xs font-mono text-center focus:ring-1 focus:ring-amber-500 rounded-lg text-emerald-400 font-bold focus:bg-white/5 placeholder:text-gray-700"
                              />
                            </td>

                            {/* ۷. موضوع / فعالیت (Subject) با هشتگ‌های میانبر و هوشمند و دکمه اتصال تسک/عادت */}
                            <td className="py-2 px-3 relative">
                              <div className="flex items-center gap-1.5 justify-between">
                                <div className="flex-1 min-w-0 relative">
                                {focusedSubjectId === entry.id ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    data-row={rowIndex}
                                    data-col={5}
                                    onKeyDown={(e) => handleKeyDown(e, rowIndex, 5)}
                                    value={entry.subject}
                                    onChange={(e) => handleCellChange(entry.id, "subject", e.target.value)}
                                    onFocus={(e) => {
                                      e.stopPropagation();
                                      setActiveSubjectDropdown(entry.id);
                                      setSelectedActivityForTags(null);
                                      e.currentTarget.select();
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveSubjectDropdown(entry.id);
                                      setSelectedActivityForTags(null);
                                    }}
                                    placeholder="درس، فعالیت یا استراحت..."
                                    className="w-full bg-white/5 border-0 px-2 py-1 text-xs font-semibold focus:ring-1 focus:ring-amber-500 rounded-lg text-gray-100 transition-all pr-1 placeholder:text-gray-600 focus:bg-white/5"
                                  />
                                ) : (
                                  (() => {
                                    const parsed = parseSubject(entry.subject);
                                    return (
                                      <div
                                        tabIndex={0}
                                        data-row={rowIndex}
                                        data-col={5}
                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 5)}
                                        onFocus={() => {
                                          setFocusedSubjectId(entry.id);
                                          setActiveSubjectDropdown(entry.id);
                                          setSelectedActivityForTags(null);
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFocusedSubjectId(entry.id);
                                          setActiveSubjectDropdown(entry.id);
                                          setSelectedActivityForTags(null);
                                        }}
                                        className="w-full min-h-[28px] flex items-center justify-start bg-transparent hover:bg-white/5 border-0 px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-text text-right outline-none focus:ring-1 focus:ring-amber-500"
                                      >
                                        {parsed.activity ? (
                                          <div className="flex items-center gap-2 select-none flex-wrap text-right">
                                            <span
                                              className="font-extrabold text-[13px] tracking-wide"
                                              style={{ color: parsed.activity.color }}
                                            >
                                              {parsed.activity.name.replace(/^#/, "")}
                                            </span>
                                            {parsed.tagText && (
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                {parsed.tagText
                                                  .split(/\s+/)
                                                  .map(t => t.replace(/^#+/, "").trim())
                                                  .filter(Boolean)
                                                  .map((tag, tIdx) => (
                                                    <span 
                                                      key={tIdx} 
                                                      className="text-[11px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md font-sans font-medium border border-amber-500/20 tracking-normal shadow-sm"
                                                    >
                                                      {tag}
                                                    </span>
                                                  ))
                                                }
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className={entry.subject ? "text-gray-100" : "text-gray-600"}>
                                            {entry.subject || "درس، فعالیت یا استراحت..."}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                                
                                {activeSubjectDropdown === entry.id && (
                                  <div 
                                    className={`absolute left-0 w-64 rounded-2xl border shadow-2xl p-3 z-30 overflow-y-auto max-h-60 select-none text-right ${
                                      isOpenUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                    }`}
                                    style={{ backgroundColor: sidebarBg, borderColor: cardBorder }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* ثبت موضوع دستی در صورت وجود متن تایپی */}
                                    {entry.subject && entry.subject.trim() !== "" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSubjectDropdown(null);
                                          setSelectedActivityForTags(null);
                                          setFocusedSubjectId(null);
                                        }}
                                        className="w-full text-right p-1.5 rounded-lg text-[10px] hover:bg-amber-500/10 text-amber-400 font-bold transition-colors cursor-pointer mb-2 flex items-center gap-1.5 border border-amber-500/10 bg-amber-500/[0.02]"
                                      >
                                        <Check className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="truncate">ثبت موضوع دستی: "{entry.subject}"</span>
                                      </button>
                                    )}

                                    {!selectedActivityForTags ? (
                                      <>
                                        <div className="text-[9px] font-bold text-gray-500 pb-1.5 mb-1.5 border-b border-white/5 pr-1">
                                          🎯 انتخاب از فعالیت‌های همیشگی:
                                        </div>
                                        
                                        {activities.length === 0 ? (
                                          <div className="text-[10px] text-gray-500 text-center py-2">
                                            هیچ فعالیت همیشگی هنوز تعریف نشده است.
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            {activities.map((act) => {
                                              const cleanActName = act.name.replace(/^#/, "").trim();
                                              return (
                                                <button
                                                  key={act.id}
                                                  type="button"
                                                  onClick={() => {
                                                    if (act.tags && act.tags.length > 0) {
                                                      setSelectedActivityForTags(act.id);
                                                    } else {
                                                      handleCellChange(entry.id, "subject", cleanActName);
                                                      setActiveSubjectDropdown(null);
                                                      setFocusedSubjectId(null);
                                                    }
                                                  }}
                                                  className="w-full flex items-center justify-between p-1.5 rounded-lg text-[10px] hover:bg-white/5 text-right transition-colors cursor-pointer text-gray-300"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: act.color }} />
                                                    <span className="font-bold">{cleanActName}</span>
                                                  </div>
                                                  {act.tags && act.tags.length > 0 && (
                                                    <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                                                      {toPersianDigits(act.tags.length)} هشتگ
                                                    </span>
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      // هشتگ‌های اختصاصی فعالیت انتخاب شده
                                      (() => {
                                        const currentAct = activities.find(a => a.id === selectedActivityForTags);
                                        if (!currentAct) return null;

                                        const cleanActName = currentAct.name.replace(/^#/, "").trim();
                                        const customTags = (currentAct.tags || []).map(t => {
                                          const clean = t.trim();
                                          return clean.startsWith("#") ? clean : `#${clean}`;
                                        });

                                        // استخراج هشتگ‌های انتخاب شده فعلی در این سلول برای نمایش حالت متمایز فعال
                                        const parsedSub = parseSubject(entry.subject);
                                        const currentSelectedTags = parsedSub.tagText
                                          ? parsedSub.tagText.split(/\s+/).map(t => t.replace(/^#+/, "").trim()).filter(Boolean)
                                          : [];

                                        const handleToggleTag = (tagToToggle: string) => {
                                          const cleanTagToToggle = tagToToggle.replace(/^#+/, "").trim();
                                          
                                          let tagsList = [...currentSelectedTags];
                                          const tagIndex = tagsList.indexOf(cleanTagToToggle);
                                          
                                          if (tagIndex > -1) {
                                            // تگ قبلا انتخاب شده، آن را حذف می‌کنیم
                                            tagsList.splice(tagIndex, 1);
                                          } else {
                                            // تگ جدید، آن را اضافه می‌کنیم
                                            tagsList.push(cleanTagToToggle);
                                          }

                                          // ساخت مجدد متن موضوع به عنوان نام درس اصلی + هشتگ‌ها
                                          const tagsString = tagsList.map(t => `#${t}`).join(" ");
                                          const newSubject = tagsString ? `${cleanActName} ${tagsString}` : cleanActName;
                                          
                                          handleCellChange(entry.id, "subject", newSubject);
                                        };

                                        return (
                                          <div className="space-y-2.5">
                                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5">
                                              <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: currentAct.color }} />
                                                <span>هشتگ‌های {cleanActName}:</span>
                                              </span>
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setActiveSubjectDropdown(null);
                                                    setSelectedActivityForTags(null);
                                                    setFocusedSubjectId(null);
                                                  }}
                                                  className="text-[9px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded font-bold transition-all cursor-pointer"
                                                >
                                                  تایید ✔
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setSelectedActivityForTags(null)}
                                                  className="text-[9px] text-amber-500 hover:text-amber-400 font-bold cursor-pointer bg-white/5 px-2 py-0.5 rounded"
                                                >
                                                  برگشت 🔙
                                                </button>
                                              </div>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5">
                                              {/* هشتگ اصلی فعالیت */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  handleCellChange(entry.id, "subject", cleanActName);
                                                  // با زدن دکمه اصلی، تمام هشتگ‌ها پاک می‌شوند
                                                }}
                                                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-all ${
                                                  currentSelectedTags.length === 0
                                                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                                                    : "bg-white/5 hover:bg-white/10 text-gray-200 border-white/5"
                                                }`}
                                              >
                                                {cleanActName} (بدون هشتگ)
                                              </button>

                                              {/* هشتگ‌های اختصاصی ثبت‌شده */}
                                              {customTags.map((tag, idx) => {
                                                const cleanTagName = tag.trim().replace(/^#+/, "");
                                                const isSelected = currentSelectedTags.includes(cleanTagName);
                                                return (
                                                  <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleToggleTag(tag)}
                                                    className={`text-[10px] px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-all ${
                                                      isSelected
                                                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.03]"
                                                        : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/10"
                                                    }`}
                                                  >
                                                    {cleanTagName}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })()
                                    )}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkModalEntry(entry);
                                }}
                                className={`flex-shrink-0 p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                  (entry.task_id || entry.habit_id)
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                                    : "text-zinc-500 hover:text-amber-400 hover:bg-white/5"
                                }`}
                                title={
                                  entry.task_id || entry.habit_id
                                    ? "مدیریت تسک و عادت متصل‌شده"
                                    : "اتصال این بازه به تسک یا عادت"
                                }
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                {(entry.task_id || entry.habit_id) && (
                                  <span className="text-[10px] font-bold hidden sm:inline">
                                    {entry.task_id && "تسک"}
                                    {entry.task_id && entry.habit_id && "+"}
                                    {entry.habit_id && "عادت"}
                                    {entry.custom_threshold && ` (${toPersianDigits(entry.custom_threshold)}٪)`}
                                  </span>
                                )}
                              </button>
                            </div>
                          </td>

                            {/* ۱۰. حذف ردیف */}
                            <td className="py-2 px-1 text-center" style={{ width: 40 }}>
                              <button
                                onClick={() => handleDeleteRow(entry.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 transition-all cursor-pointer"
                                title="حذف این بازه"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* دکمه‌های کنترلی */}
              <div 
                className="flex flex-col sm:flex-row items-center justify-between p-4 gap-3 bg-white/[0.02]"
                style={{ borderTop: `1px solid ${cardBorder}` }}
              >
                <button
                  onClick={handleAddRow}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>افزودن بازه زمانی جدید</span>
                </button>

                <button
                  onClick={handleResetToday}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl border hover:bg-rose-500/10 hover:text-rose-400 text-xs font-bold transition-all cursor-pointer text-gray-400"
                  style={{ borderColor: cardBorder }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>صفر کردن و ریست برنامه امروز</span>
                </button>
              </div>
            </div>

            {/* دکمه کشویی کنترل پریست‌ها و الگوهای برنامه‌ریزی (الگوهای من) */}
            <div className="flex flex-col items-center justify-center pt-2">
              <button
                onClick={() => setShowPresets(prev => !prev)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl border text-[11px] font-black transition-all hover:bg-white/5 cursor-pointer"
                style={{ borderColor: cardBorder, backgroundColor: sidebarBg, color: fg }}
              >
                <Save className="h-4 w-4 text-amber-500" />
                <span>مدیریت قالب‌ها و الگوهای برنامه‌ریزی من ({toPersianDigits(presets.length)})</span>
                {showPresets ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
            </div>

            {/* بخش مدیریت قالب‌ها و پریست‌های برنامه‌ریزی روزانه (Preset System) - کشویی */}
            <AnimatePresence>
              {showPresets && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: 10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div 
                    className="p-5 rounded-2xl border space-y-4 mt-2"
                    style={{ borderColor: cardBorder, backgroundColor: sidebarBg }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <Save className="h-3.5 w-3.5 text-amber-400" />
                          <span>قالب‌ها و پریست‌های برنامه‌ریزی من</span>
                        </h3>
                        <p className="text-[10px] text-gray-400">الگوهای مختلف برنامه‌ریزی خود را به همراه زمان‌بندی‌ها ذخیره کنید و هر روز با یک کلیک بارگذاری نمایید.</p>
                      </div>
                      <button
                        onClick={() => setShowSavePresetModal(true)}
                        className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black transition-all cursor-pointer shadow-md shadow-amber-500/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>ذخیره برنامه فعلی به عنوان قالب جدید</span>
                      </button>
                    </div>

                    {activePresetId !== "default" && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 gap-2">
                        <span className="flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                          <span>شما یک قالب فعال برای روزهای آینده تعیین کرده‌اید. تمام روزهای جدید به طور خودکار با این قالب آغاز خواهند شد.</span>
                        </span>
                        <button
                          onClick={handleClearDefaultPreset}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold transition-all cursor-pointer text-[9px] self-end sm:self-auto"
                        >
                          بازگشت به زمان‌بندی استاندارد سیستم
                        </button>
                      </div>
                    )}

                    {presets.length === 0 ? (
                      <div className="text-[10px] text-gray-500 text-center py-4">
                        هنوز هیچ قالب برنامه‌ریزی ذخیره نکرده‌اید. با فشردن دکمه بالا می‌توانید برنامه جاری را به عنوان قالب ذخیره کنید.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {presets.map((preset) => {
                          const isDefault = activePresetId === preset.id;
                          return (
                            <div 
                              key={preset.id}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
                                isDefault 
                                  ? "bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/10" 
                                  : "bg-white/[0.02] hover:bg-white/[0.04]"
                              }`}
                              style={{ borderColor: isDefault ? undefined : cardBorder }}
                            >
                              <button
                                onClick={() => handleSetDefaultPreset(preset.id, preset.name)}
                                className="flex items-center justify-center p-1 rounded-lg hover:bg-white/5 transition-all"
                                title={isDefault ? "قالب پیش‌فرض فعال روزهای آینده" : "تعیین به عنوان قالب پیش‌فرض برای روزهای آینده"}
                              >
                                <Star 
                                  className={`h-3.5 w-3.5 transition-all ${
                                    isDefault ? "text-amber-400 fill-amber-400 scale-110" : "text-gray-500 hover:text-amber-400"
                                  }`} 
                                />
                              </button>

                              <span className="text-[11px] font-bold text-gray-300">{preset.name}</span>
                              <span className="text-[9px] text-gray-500 font-mono">({toPersianDigits(preset.slots.length)} بازه)</span>
                              
                              <span className="h-3 w-px bg-white/10 mx-1" />

                              <button
                                onClick={() => handleLoadPreset(preset)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:bg-white/5 px-2 py-0.5 rounded cursor-pointer"
                                title="بارگذاری و اعمال الگو روی امروز"
                              >
                                اعمال الگو
                              </button>

                              <button
                                onClick={() => handleDeletePreset(preset.id, preset.name)}
                                className="text-[10px] text-rose-500 hover:text-rose-400 font-bold hover:bg-rose-500/10 p-1.5 rounded cursor-pointer transition-colors"
                                title="حذف الگو"
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* مودال فلوتینگ زیبای ذخیره پریست جدید */}
            <AnimatePresence>
              {showSavePresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
                    setShowSavePresetModal(false);
                    setNewPresetName("");
                    setSavePresetError("");
                  }} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative z-10 w-full max-w-md p-6 rounded-3xl border shadow-2xl text-right"
                    style={{ backgroundColor: bg, borderColor: cardBorder }}
                  >
                    <h3 className="text-sm font-black text-gray-100 mb-2">ذخیره قالب برنامه‌ریزی روزانه</h3>
                    <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                      الگوی زمانی و دروس ثبت‌شده در جدول به عنوان یک تمپلت کلی ذخیره می‌شود تا بتوانید آن را در روزهای دیگر هم بارگذاری کنید.
                    </p>

                    <input 
                      type="text"
                      placeholder="نام قالب (مثلاً: روزهای مدرسه، برنامه فشرده کنکور)"
                      value={newPresetName}
                      onChange={(e) => {
                        setNewPresetName(e.target.value);
                        if (savePresetError) setSavePresetError("");
                      }}
                      className="w-full rounded-2xl px-4 py-3 text-xs outline-none border focus:ring-1 focus:ring-amber-500 mb-2 transition-all"
                      style={{ borderColor: cardBorder, backgroundColor: inputBg, color: fg }}
                      autoFocus
                    />

                    {savePresetError && (
                      <div className="text-[10px] text-rose-400 font-bold mb-4 pr-1 animate-pulse">
                        ⚠️ {savePresetError}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 text-xs mt-4">
                      <button
                        onClick={() => {
                          setShowSavePresetModal(false);
                          setNewPresetName("");
                          setSavePresetError("");
                        }}
                        className="px-4 py-2 rounded-xl text-gray-400 hover:bg-white/5 font-bold cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        onClick={handleSaveAsPreset}
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black cursor-pointer"
                      >
                        تایید و ذخیره
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* مودال عمومی تایید نهایی هوشمند با قانون ۳ ثانیه صبر */}
            <AnimatePresence>
              {confirmConfig && confirmConfig.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    onClick={() => setConfirmConfig(null)} 
                  />
                  {/* Modal Content */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="relative z-10 w-full max-w-md p-6 rounded-3xl border shadow-2xl text-right overflow-hidden"
                    style={{ backgroundColor: bg, borderColor: cardBorder }}
                  >
                    {/* تزیین پس‌زمینه */}
                    <div className={`absolute top-0 right-0 left-0 h-1.5 ${confirmConfig.requireCountdown ? "bg-rose-500" : "bg-indigo-500"}`} />
                    
                    <div className="flex items-center gap-3 mb-3 pt-1">
                      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${confirmConfig.requireCountdown ? "bg-rose-500/10 text-rose-500" : "bg-indigo-500/10 text-indigo-400"}`}>
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-black text-gray-100" style={{ color: fg }}>
                        {confirmConfig.title}
                      </h3>
                    </div>

                    <p className="text-xs text-gray-400 mb-6 leading-relaxed pr-1">
                      {confirmConfig.description}
                    </p>

                    {confirmConfig.requireCountdown && confirmCountdown > 0 && (
                      <div className="mb-5 p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] font-bold text-rose-400">
                          <span>برای جلوگیری از کلیک تصادفی، لطفاً صبور باشید...</span>
                          <span>{toPersianDigits(confirmCountdown)} ثانیه</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                          <motion.div 
                            initial={{ width: "100%" }}
                            animate={{ width: "0%" }}
                            transition={{ duration: 3, ease: "linear" }}
                            className="absolute top-0 bottom-0 right-0 bg-rose-500 rounded-full" 
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 text-xs pt-2 border-t border-white/5">
                      <button
                        onClick={() => setConfirmConfig(null)}
                        className="px-4 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 font-bold cursor-pointer transition-all border border-transparent hover:border-white/5"
                      >
                        {confirmConfig.cancelText || "انصراف"}
                      </button>
                      <button
                        onClick={confirmConfig.onConfirm}
                        disabled={confirmConfig.requireCountdown && confirmCountdown > 0}
                        className={`px-5 py-2.5 rounded-xl font-black cursor-pointer transition-all flex items-center gap-1.5 shadow-lg ${
                          confirmConfig.requireCountdown && confirmCountdown > 0
                            ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5 shadow-none"
                            : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10 hover:shadow-rose-500/20"
                        }`}
                      >
                        {confirmConfig.requireCountdown && confirmCountdown > 0 ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>قفل موقت ({toPersianDigits(confirmCountdown)})</span>
                          </>
                        ) : (
                          <span>{confirmConfig.confirmText}</span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* توست نوتیفیکیشن شناور بالا سمت راست برای بازخورد شیرین به کاربر */}
            <div className="fixed top-5 right-5 z-[110] pointer-events-none space-y-2 max-w-sm w-full">
              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, x: 50, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 50, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="p-4 rounded-2xl border shadow-2xl flex items-center gap-3 pointer-events-auto backdrop-blur-md"
                    style={{ backgroundColor: `${sidebarBg}dd`, borderColor: cardBorder }}
                  >
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 animate-bounce">
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-xs font-black text-gray-100" style={{ color: fg }}>عملیات موفقیت‌آمیز</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{toastMessage}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          /* تب گزارش‌های پیشرفته با تقویم دو کاره (تک روزه / بازه انتخابی) */
          <motion.div 
            key="stats-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <AnalyticsSection adherenceMap={adherenceMap} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* مدال اتصال به تسک و عادت */}
      <PlannerLinkModal
        isOpen={!!linkModalEntry}
        onClose={() => setLinkModalEntry(null)}
        entry={linkModalEntry}
        onSave={handleSaveLinks}
      />

      {/* مدال تنظیم درصد حد نصاب سراسری سیستم */}
      <AnimatePresence>
        {showThresholdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl bg-[#18181b] border border-zinc-800 shadow-2xl p-5 text-right space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">تنظیم حد نصاب قبولی سیستم</h3>
                    <p className="text-[10px] text-zinc-400">حداقل درصد کارکرد زمانی برای تایید خودکار تسک و عادت</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-semibold">درصد مورد نظر:</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {toPersianDigits(thresholdInput)}٪
                  </span>
                </div>

                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                {/* دکمه‌های سریع */}
                <div className="flex gap-1.5 justify-between pt-1">
                  {[50, 60, 70, 80, 90, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setThresholdInput(val.toString())}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        parseInt(thresholdInput, 10) === val
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {toPersianDigits(val)}٪
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                  اگر به عنوان مثال ۸۰٪ را انتخاب کنید، در یک پارت ۶۰ دقیقه‌ای اگر حداقل ۴۸ دقیقه کار ثبت شود، تسک و عادت متصل به طور خودکار کامل خواهند شد.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = parseInt(thresholdInput, 10);
                    if (!isNaN(num)) {
                      PlannerStore.setGlobalThreshold(num);
                      setGlobalThreshold(num);
                      setToastMessage(`حد نصاب قبولی سیستم به ${toPersianDigits(num)}٪ تغییر یافت.`);
                    }
                    setShowThresholdModal(false);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  ذخیره
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// فرمت‌کننده زمان بر حسب ساعت و دقیقه با ارقام فارسی
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

// کامپوننت اختصاصی برای آمار و راندمان پیشرفته ترکیبی پلنر و تسک‌های کانبان
function AnalyticsSection({ adherenceMap }: { adherenceMap: Record<string, number> }) {
  const { fg, fgMuted, cardBg, cardBorder, bg, isDark } = useThemeStyles();
  const today = getGregorianToday();
  const todayJalali = getTodayJalali();
  
  // بازه انتخابی پیش‌فرض: هفته اخیر
  const [rangeFrom, setRangeFrom] = useState<string | null>(() => addDays(getGregorianToday(), -6));
  const [rangeTo, setRangeTo] = useState<string | null>(() => getGregorianToday());
  const [pickingEnd, setPickingEnd] = useState(false);
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const [rangeConfirmed, setRangeConfirmed] = useState(true);

  // داده‌های تسک‌ها و فعالیت‌های کانبان
  const [tasks, setTasks] = useState<Task[]>(() => TaskStore.list());
  const [activities, setActivities] = useState<RecurringActivity[]>(() => RecurringActivityStore.list());
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedTagsByActivity, setSelectedTagsByActivity] = useState<Record<string, string[]>>({});

  // همگام‌سازی لحظه‌ای داده‌ها با تغییرات برنامه
  useEffect(() => {
    const refreshData = () => {
      setTasks(TaskStore.list());
      setActivities(RecurringActivityStore.list());
    };
    window.addEventListener("focusflow-data-changed", refreshData);
    window.addEventListener("focusflow-db-synced", refreshData);
    return () => {
      window.removeEventListener("focusflow-data-changed", refreshData);
      window.removeEventListener("focusflow-db-synced", refreshData);
    };
  }, []);

  // مدیریت انتخاب روزها در تقویم جلالی
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

  // فیلترهای اکتیویتی و تگ
  const toggleActivity = (id: string) => {
    setSelectedActivityIds((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTagForActivity = (activityId: string, tag: string) => {
    setSelectedTagsByActivity((prev) => {
      const current = prev[activityId] ?? [];
      const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [activityId]: updated };
    });
  };

  // استخراج تمام روزهای بازه انتخابی
  const allDatesInRange = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];
    const arr: string[] = [];
    let current = rangeFrom;
    while (current <= rangeTo) {
      arr.push(current);
      current = addDays(current, 1);
    }
    return arr;
  }, [rangeFrom, rangeTo]);

  // ۱. محاسبات آماری بخش پلنر
  const rangeStats = useMemo(() => {
    if (!rangeFrom || !rangeTo) return { totalStudy: 0, totalPlan: 0, totalRest: 0, totalActualRest: 0, count: 0, daysWithPlan: 0, averageAdherence: 0 };
    
    const allEntries = getAllPlannerEntriesRaw();
    const rangeEntries = allEntries.filter(e => e.date >= rangeFrom && e.date <= rangeTo);
    
    let totalPlan = 0;
    let totalStudy = 0;
    let totalPlanRest = 0;
    let totalActualRest = 0;

    const dailyMap: Record<string, { plan: number; actual: number }> = {};

    rangeEntries.forEach(e => {
      const pm = parseMinutesValue(e.plan_main);
      const pr = parseMinutesValue(e.plan_rest, true);
      const am = parseMinutesValue(e.actual_main);
      const ar = parseMinutesValue(e.actual_rest, true);

      totalPlan += pm;
      totalStudy += am;
      totalPlanRest += pr;
      totalActualRest += ar;

      if (!dailyMap[e.date]) dailyMap[e.date] = { plan: 0, actual: 0 };
      dailyMap[e.date].plan += pm;
      dailyMap[e.date].actual += am;
    });

    let daysWithPlan = 0;
    let sumAdherence = 0;
    Object.values(dailyMap).forEach(day => {
      if (day.plan > 0) {
        daysWithPlan++;
        sumAdherence += Math.min(100, (day.actual / day.plan) * 100);
      }
    });

    const averageAdherence = daysWithPlan > 0 ? Math.round(sumAdherence / daysWithPlan) : 0;

    return {
      totalStudy,
      totalPlan,
      totalPlanRest,
      totalActualRest,
      averageAdherence,
      daysWithPlan
    };
  }, [rangeFrom, rangeTo, rangeConfirmed]);

  // نمودار روند خطی مقایسه برنامه و مطالعه واقعی پلنر
  const plannerTrendData = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];
    const allEntries = getAllPlannerEntriesRaw();
    
    return allDatesInRange.map(date => {
      const dateEntries = allEntries.filter(e => e.date === date);
      let planSum = 0;
      let actualSum = 0;
      dateEntries.forEach(e => {
        planSum += parseMinutesValue(e.plan_main);
        actualSum += parseMinutesValue(e.actual_main);
      });

      return {
        date: toShamsiShort(date),
        "برنامه مطالعه": planSum,
        "مطالعه واقعی": actualSum,
        "درصد عمل به برنامه": planSum > 0 ? Math.round(Math.min(100, (actualSum / planSum) * 100)) : 0
      };
    });
  }, [allDatesInRange, rangeConfirmed]);

  // ۲. محاسبات آماری بخش تسک‌ها و فعالیت‌های کانبان
  const tasksInRange = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.scheduled_date) return false;
      if (!rangeFrom || !rangeTo) return false;
      return t.scheduled_date >= rangeFrom && t.scheduled_date <= rangeTo;
    });
  }, [tasks, rangeFrom, rangeTo]);

  const activityFilteredTasks = useMemo(() => {
    return tasksInRange.filter((t) => {
      if (!t.activity_id) return false;
      if (selectedActivityIds.length === 0) return true;
      return selectedActivityIds.includes(t.activity_id);
    });
  }, [tasksInRange, selectedActivityIds]);

  const filteredTasks = useMemo(() => {
    return activityFilteredTasks.filter((t) => {
      const actId = t.activity_id ?? "";
      const tagsForAct = selectedTagsByActivity[actId] ?? [];
      if (tagsForAct.length === 0) return true;
      const taskTags = t.tags ?? [];
      return tagsForAct.some((tag) => taskTags.includes(tag));
    });
  }, [activityFilteredTasks, selectedTagsByActivity]);

  const timelineEntriesInRange = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];
    return TimelineEntryStore.listByRange(rangeFrom, rangeTo).filter((e) => {
      if (!e.activity_id) return false;
      if (selectedActivityIds.length === 0) return true;
      return selectedActivityIds.includes(e.activity_id);
    });
  }, [rangeFrom, rangeTo, selectedActivityIds]);

  const tagsByActivityId = useMemo(() => {
    const res: Record<string, string[]> = {};
    activityFilteredTasks.forEach((t) => {
      const actId = t.activity_id ?? "";
      if (!res[actId]) res[actId] = [];
      (t.tags ?? []).forEach((tag) => {
        if (!res[actId].includes(tag)) res[actId].push(tag);
      });
    });
    return res;
  }, [activityFilteredTasks]);

  const activeActivities = useMemo(() => {
    return selectedActivityIds.length > 0
      ? activities.filter((a) => selectedActivityIds.includes(a.id))
      : activities.filter((a) => activityFilteredTasks.some((t) => t.activity_id === a.id));
  }, [activities, selectedActivityIds, activityFilteredTasks]);

  const secsByActivity = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      if (!t.activity_id) return;
      map[t.activity_id] = (map[t.activity_id] || 0) + (t.elapsed_seconds || 0);
    });
    timelineEntriesInRange.forEach((e) => {
      if (!e.activity_id) return;
      const secs = e.duration_seconds ?? 0;
      map[e.activity_id] = (map[e.activity_id] || 0) + secs;
    });
    return map;
  }, [filteredTasks, timelineEntriesInRange]);

  const totalTracked = useMemo(() => {
    return Object.values(secsByActivity).reduce((a, b) => a + b, 0);
  }, [secsByActivity]);

  const totalTimelineSeconds = useMemo(() => {
    return timelineEntriesInRange.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);
  }, [timelineEntriesInRange]);

  // داده‌های نمودار دوناتی (دایره‌ای)
  const pieData = useMemo(() => {
    const arr: { name: string; value: number; color: string }[] = [];
    Object.entries(secsByActivity).forEach(([actId, secs]) => {
      if (secs <= 0) return;
      const act = activities.find((a) => a.id === actId);
      if (act) arr.push({ name: act.name, value: secs, color: act.color });
    });
    return arr;
  }, [secsByActivity, activities]);

  // داده‌های نمودار خطی کانبان
  const activeActivitiesForChart = useMemo(() => {
    return activities.filter((a) => selectedActivityIds.length === 0 || selectedActivityIds.includes(a.id));
  }, [activities, selectedActivityIds]);

  const kanbanLineData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    filteredTasks.forEach((t) => {
      const d = t.scheduled_date;
      if (!d || !t.activity_id) return;
      if (!dateMap.has(d)) dateMap.set(d, {});
      const m = dateMap.get(d)!;
      m[t.activity_id] = (m[t.activity_id] || 0) + (t.elapsed_seconds || 0);
    });

    timelineEntriesInRange.forEach((e) => {
      const d = e.date;
      if (!d || !e.activity_id) return;
      if (!dateMap.has(d)) dateMap.set(d, {});
      const m = dateMap.get(d)!;
      m[e.activity_id] = (m[e.activity_id] || 0) + (e.duration_seconds || 0);
    });

    return allDatesInRange.map((date) => {
      const m = dateMap.get(date) || {};
      const entry: Record<string, string | number> = { date: toShamsiShort(date) };
      
      activities.forEach((act) => {
        if (selectedActivityIds.length === 0 || selectedActivityIds.includes(act.id)) {
          entry[act.name] = Math.round((m[act.id] || 0) / 60);
        }
      });
      
      entry.total = Math.round(Object.values(m).reduce((a, b) => a + b, 0) / 60);
      return entry;
    });
  }, [filteredTasks, timelineEntriesInRange, allDatesInRange, activities, selectedActivityIds]);

  // تفکیک زمان بر اساس هر تگ
  const tagBreakdown = useMemo(() => {
    const tagMap: Record<string, { seconds: number; count: number; color?: string }> = {};
    filteredTasks.forEach((t) => {
      const act = activities.find((a) => a.id === t.activity_id);
      const color = act?.color || "#818cf8";
      (t.tags ?? []).forEach((tag) => {
        if (!tagMap[tag]) {
          tagMap[tag] = { seconds: 0, count: 0, color };
        }
        tagMap[tag].seconds += (t.elapsed_seconds || 0);
        tagMap[tag].count += 1;
      });
    });
    return Object.entries(tagMap)
      .map(([tag, data]) => ({ tag, ...data }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [filteredTasks, activities]);

  // تولتیپ سفارشی نمودار خطی کانبان
  const KanbanChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const totalSeconds = (dataPoint.total || 0) * 60;

      const itemsWithData = activeActivitiesForChart.filter(
        (a) => dataPoint[a.name] !== undefined && dataPoint[a.name] > 0
      );

      return (
        <div className="rounded-2xl p-3 shadow-xl border text-right text-xs space-y-2 font-sans"
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

  const isSingleDaySelected = rangeFrom && rangeTo && rangeFrom === rangeTo;
  const numDays = allDatesInRange.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-right">
      {/* سایدبار سمت راست: تقویم جمع‌وجور پلنر + فیلترهای تسک و تگ کانبان */}
      <div className="lg:col-span-5 space-y-4">
        <div 
          className="p-4 rounded-3xl border space-y-3.5"
          style={{ borderColor: cardBorder, backgroundColor: cardBg }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: fg }}>انتخاب بازه گزارش‌گیری</span>
            <span className="text-[10px]" style={{ color: fgMuted }}>
              {rangeFrom && `از: ${toShamsiShort(rangeFrom)}`}
              {rangeTo && ` تا: ${toShamsiShort(rangeTo)}`}
            </span>
          </div>

          {pickingEnd && (
            <div className="p-2.5 rounded-xl text-center text-[10px] bg-indigo-500/10 text-indigo-400 font-bold animate-pulse">
              حالا مجدداً روی تقویم کلیک کنید تا روز پایانی انتخاب شود.
            </div>
          )}

          {/* تقویم جلالی جمع‌وجور با ردیاب درصدی درصد اتمام زیر هر روز */}
          <JalaliCalendar 
            jy={calJy} 
            jm={calJm}
            onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
            onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
            canNext={calJy < todayJalali[0] || (calJy === todayJalali[0] && calJm < todayJalali[1])}
            todayGreg={today} 
            onDayClick={handleDayClick}
            renderDay={(day, meta) => {
              const isFuture = meta.gregDate > today;
              const inRange = rangeFrom && rangeTo && meta.gregDate >= rangeFrom && meta.gregDate <= rangeTo;
              const isStart = meta.gregDate === rangeFrom;
              const isEnd = meta.gregDate === rangeTo;
              
              const pct = adherenceMap[meta.gregDate];
              
              let bgColor = "transparent";
              let textColor = isFuture ? `${fgMuted}33` : `${fgMuted}cc`;
              let borderStyle = `1px solid ${cardBorder}`;
              
              if (isStart || isEnd) {
                bgColor = "#6366f1";
                textColor = "#fff";
                borderStyle = "2px solid #6366f1";
              } else if (inRange) {
                bgColor = "rgba(99,102,241,0.15)";
                textColor = "#818cf8";
                borderStyle = "1px solid rgba(99,102,241,0.35)";
              } else if (meta.isToday) {
                bgColor = "rgba(16,185,129,0.12)";
                textColor = "#10b981";
                borderStyle = "2px solid #10b981";
              }

              let pctColor = "text-gray-500";
              if (pct !== undefined) {
                if (pct >= 80) pctColor = "text-emerald-400";
                else if (pct >= 50) pctColor = "text-amber-400";
                else if (pct > 0) pctColor = "text-rose-400";
              }

              return (
                <div 
                  className="flex flex-col items-center justify-center h-full w-full rounded-xl transition-all duration-300 p-1 relative"
                  style={{
                    backgroundColor: bgColor,
                    border: borderStyle,
                  }}
                >
                  {meta.isToday && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                  )}

                  <span className="font-extrabold text-[14px] select-none" style={{ color: isStart || isEnd ? "#fff" : textColor }}>
                    {toPersianDigits(day)}
                  </span>
                  {pct !== undefined && pct > 0 && !isFuture && (
                    <span className={`text-[11px] font-extrabold tracking-tight ${isStart || isEnd ? "text-indigo-100" : pctColor} mt-0.5`}>
                      ٪{toPersianDigits(pct)}
                    </span>
                  )}
                </div>
              );
            }}
          />

          {/* بازه‌های سریع */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[
              { label: "امروز", days: 1 },
              { label: "۷ روز اخیر", days: 7 }, 
              { label: "۳۰ روز اخیر", days: 30 }
            ].map(({ label, days }) => (
              <button 
                key={label} 
                onClick={() => { 
                  const from = addDays(today, -(days - 1)); 
                  setRangeFrom(from); 
                  setRangeTo(today); 
                  setPickingEnd(false); 
                  setRangeConfirmed(true); 
                  const jd = gregorianToJalali(...from.split("-").map(Number) as [number, number, number]); 
                  setCalJy(jd[0]); 
                  setCalJm(jd[1]); 
                }} 
                className="rounded-xl px-2 py-1.5 text-[10px] font-bold transition-all border text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer" 
                style={{ borderColor: cardBorder }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* فیلتر فعالیت‌ها و تسک‌ها (عیناً مانند کانبان در زیر تقویم) */}
          {activities.length > 0 && (
            <div className="space-y-2 pt-2.5 border-t" style={{ borderColor: `${cardBorder}60` }}>
              <span className="text-xs font-semibold block" style={{ color: fgMuted }}>فیلتر فعالیت‌ها:</span>
              <div className="flex flex-wrap gap-1.5">
                <button 
                  onClick={() => { setSelectedActivityIds([]); setSelectedTagsByActivity({}); }}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer"
                  style={{ 
                    border: `1px solid ${selectedActivityIds.length === 0 ? "#6366f1" : cardBorder}`, 
                    backgroundColor: selectedActivityIds.length === 0 ? "rgba(99,102,241,0.15)" : "transparent", 
                    color: selectedActivityIds.length === 0 ? "#818cf8" : fgMuted 
                  }}
                >
                  همه موارد
                </button>
                {activities.map((a) => (
                  <button 
                    key={a.id} 
                    onClick={() => toggleActivity(a.id)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer"
                    style={{ 
                      border: `1px solid ${selectedActivityIds.includes(a.id) ? a.color : cardBorder}`, 
                      backgroundColor: selectedActivityIds.includes(a.id) ? `${a.color}20` : "transparent", 
                      color: selectedActivityIds.includes(a.id) ? a.color : fgMuted 
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* فیلتر هشتگ‌ها و تگ‌های هر فعالیت (عیناً مانند کانبان) */}
          {activeActivities.map((act) => {
            const tagsForAct = tagsByActivityId[act.id] ?? [];
            if (tagsForAct.length === 0) return null;
            const selectedTags = selectedTagsByActivity[act.id] ?? [];
            return (
              <div 
                key={act.id} 
                className="space-y-1.5 rounded-xl p-2.5"
                style={{ border: `1px solid ${act.color}30`, backgroundColor: `${act.color}08` }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: act.color }} />
                  <span className="text-xs font-medium" style={{ color: act.color }}>هشتگ‌های {act.name}:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tagsForAct.map((tag) => (
                    <button 
                      key={tag} 
                      onClick={() => toggleTagForActivity(act.id, tag)}
                      className="rounded-lg px-2 py-0.5 text-xs transition-all cursor-pointer"
                      style={{
                        border: `1px solid ${selectedTags.includes(tag) ? act.color : `${act.color}40`}`,
                        backgroundColor: selectedTags.includes(tag) ? `${act.color}20` : "transparent",
                        color: selectedTags.includes(tag) ? act.color : fgMuted,
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* دکمه تایید و بروزرسانی آمارها */}
          <button 
            onClick={() => { if (rangeFrom && rangeTo) setRangeConfirmed(true); }} 
            disabled={!rangeFrom || !rangeTo} 
            className="w-full rounded-2xl bg-indigo-500 hover:bg-indigo-600 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-40 cursor-pointer shadow-md shadow-indigo-500/20"
          >
            تایید و بروزرسانی آمارها
          </button>
        </div>

        {/* کادر راهنمای رنگ‌های درصد تحقق */}
        <div className="p-3 rounded-2xl border text-[9px] text-gray-400 space-y-1.5" style={{ borderColor: cardBorder, backgroundColor: cardBg }}>
          <div className="font-bold text-gray-300">راهنمای رنگ درصدهای تقویم:</div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />بالای ۸۰٪ (عالی)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />۵۰٪ تا ۸۰٪ (متوسط)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />زیر ۵۰٪ (ضعیف)</span>
          </div>
        </div>
      </div>

      {/* بخش اصلی آمار و نمودارها در سمت چپ */}
      <div className="lg:col-span-7 space-y-8">
        {rangeConfirmed && rangeFrom && rangeTo ? (
          <div className="space-y-8">
            
            {/* ────────── بخش ۱: آمار و راندمان پلنر ────────── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b" style={{ borderColor: `${cardBorder}60` }}>
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-black" style={{ color: fg }}>آمار و راندمان برنامه‌ریزی روزانه</h2>
              </div>

              {/* کارت‌های تجمیع راندمان پلنر */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl p-4 text-center border" style={{ borderColor: cardBorder, backgroundColor: "rgba(99,102,241,0.06)" }}>
                  <div className="text-xl font-black text-indigo-400">
                    {toPersianDigits(
                      isSingleDaySelected 
                        ? Math.round(rangeStats.totalStudy)
                        : Math.round(rangeStats.totalStudy / numDays)
                    )}
                  </div>
                  <div className="text-[9px] mt-1 text-gray-400 font-bold">
                    {isSingleDaySelected ? "کل مطالعه (دقیقه)" : "میانگین روزانه (دقیقه)"}
                  </div>
                </div>

                <div className="rounded-2xl p-4 text-center border" style={{ borderColor: cardBorder, backgroundColor: "rgba(16,185,129,0.06)" }}>
                  <div className="text-xl font-black text-emerald-400">
                    {toPersianDigits(
                      isSingleDaySelected 
                        ? Math.round(rangeStats.totalActualRest)
                        : Math.round(rangeStats.totalActualRest / numDays)
                    )}
                  </div>
                  <div className="text-[9px] mt-1 text-gray-400 font-bold">
                    {isSingleDaySelected ? "کل استراحت (دقیقه)" : "میانگین استراحت (دقیقه)"}
                  </div>
                </div>

                <div className="rounded-2xl p-4 text-center border" style={{ borderColor: cardBorder, backgroundColor: "rgba(245,158,11,0.06)" }}>
                  <div className="text-xl font-black text-amber-400">
                    {toPersianDigits(rangeStats.averageAdherence)}٪
                  </div>
                  <div className="text-[9px] mt-1 text-gray-400 font-bold">میانگین عمل به برنامه</div>
                </div>
              </div>

              {/* بخش آمار عددی دقیق‌تر پلنر */}
              <div className="p-4 rounded-3xl border space-y-3" style={{ borderColor: cardBorder, backgroundColor: cardBg }}>
                <h3 className="text-xs font-black" style={{ color: fg }}>تحلیل کلی بازه پلنر ({toPersianDigits(numDays)} روز)</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">مجموع زمان برنامه‌ریزی مطالعه:</span>
                      <span className="font-bold text-indigo-300">{toPersianDigits(rangeStats.totalPlan)} دقیقه</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">مجموع مطالعه واقعی:</span>
                      <span className="font-bold text-indigo-400">{toPersianDigits(rangeStats.totalStudy)} دقیقه</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">مجموع استراحت واقعی:</span>
                      <span className="font-bold text-emerald-400">{toPersianDigits(rangeStats.totalActualRest)} دقیقه</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">تعداد روزهای برنامه‌ریزی شده:</span>
                      <span className="font-bold text-amber-400">{toPersianDigits(rangeStats.daysWithPlan)} روز</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* نمودار خطی پلنر: مقایسه برنامه در برابر عملکرد واقعی */}
              {plannerTrendData.length > 1 && (
                <div className="p-4 rounded-3xl border space-y-3" style={{ borderColor: cardBorder, backgroundColor: cardBg }}>
                  <h3 className="text-xs font-black" style={{ color: fg }}>مقایسه روند مطالعه واقعی در مقابل برنامه مصوب و درصد عملکرد</h3>
                  <div style={{ width: "100%", height: 250 }} dir="ltr">
                    <ResponsiveContainer>
                      <LineChart data={plannerTrendData} margin={{ top: 10, right: -5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: fgMuted }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: fgMuted }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: fgMuted }} />
                        <RechartTooltip 
                          formatter={(value, name) => {
                            if (name === "درصد عمل به برنامه") {
                              return [`${toPersianDigits(Number(value))}٪`, name];
                            }
                            return [`${toPersianDigits(Number(value))} دقیقه`, name];
                          }}
                          contentStyle={{ backgroundColor: bg, border: `1px solid ${cardBorder}`, borderRadius: 12, direction: "rtl", color: fg }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line yAxisId="left" type="monotone" dataKey="برنامه مطالعه" stroke="#818cf8" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="مطالعه واقعی" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="درصد عمل به برنامه" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* ────────── بخش ۲: آمار و عملکرد تسک‌ها و فعالیت‌های کانبان ────────── */}
            <div className="space-y-5 pt-4 border-t" style={{ borderColor: `${cardBorder}80` }}>
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-black" style={{ color: fg }}>آمار تفکیکی تسک‌ها و فعالیت‌ها</h2>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">
                  {toPersianDigits(filteredTasks.length)} تسک در این بازه
                </span>
              </div>

              {/* ۴ کارت تجمیع آماری کانبان */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(99,102,241,0.25)", backgroundColor: "rgba(99,102,241,0.08)" }}>
                  <div className="text-lg font-bold" style={{ color: "#818cf8" }}>{formatDuration(totalTracked)}</div>
                  <div className="text-xs mt-1" style={{ color: fgMuted }}>کل زمان ثبت‌شده</div>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.08)" }}>
                  <div className="text-lg font-bold" style={{ color: "#34d399" }}>{toPersianDigits(filteredTasks.length)}</div>
                  <div className="text-xs mt-1" style={{ color: fgMuted }}>تعداد کل تسک‌ها</div>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.08)" }}>
                  <div className="text-lg font-bold" style={{ color: "#fbbf24" }}>
                    {formatDuration(totalTracked - totalTimelineSeconds > 0 ? totalTracked - totalTimelineSeconds : 0)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: fgMuted }}>تایمر تسک‌ها</div>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(139,92,246,0.25)", backgroundColor: "rgba(139,92,246,0.08)" }}>
                  <div className="text-lg font-bold" style={{ color: "#a78bfa" }}>{formatDuration(totalTimelineSeconds)}</div>
                  <div className="text-xs mt-1" style={{ color: fgMuted }}>تایم‌لاین دستی</div>
                </div>
              </div>

              {/* نمودار دوناتی (دایره‌ای) توزیع زمان بر اساس فعالیت‌ها */}
              {pieData.length > 0 && (
                <div className="rounded-3xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                  <h3 className="text-xs font-bold" style={{ color: fg }}>نمودار دوناتی توزیع زمان بر اساس فعالیت‌ها</h3>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div style={{ width: "100%", maxWidth: 220, height: 220 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie 
                            data={pieData} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={55} 
                            outerRadius={85} 
                            paddingAngle={2} 
                            dataKey="value"
                          >
                            {pieData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <RechartTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const item = payload[0];
                                const color = item.payload?.color || "#818cf8";
                                return (
                                  <div 
                                    className="rounded-xl px-3 py-2 text-xs shadow-xl border flex items-center gap-2.5"
                                    style={{ backgroundColor: bg, borderColor: cardBorder, color: fg, direction: "rtl" }}
                                  >
                                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                    <span className="font-bold">{item.name}:</span>
                                    <span className="font-mono font-bold text-indigo-400">
                                      {formatDuration(Number(item.value))}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 w-full">
                      {pieData.map((d) => {
                        const pct = totalTracked > 0 ? Math.round((d.value / totalTracked) * 100) : 0;
                        return (
                          <div key={d.name} className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-white/5 transition-all">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-xs font-semibold" style={{ color: fg }}>{d.name}</span>
                            </div>
                            <span className="text-xs font-bold font-mono" style={{ color: d.color }}>
                              {formatDuration(d.value)} ({toPersianDigits(pct)}٪)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* لیست و زمان صرف‌شده برای تک‌تک تسک‌های انتخاب‌شده */}
              <div className="rounded-3xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold" style={{ color: fg }}>زمان صرف‌شده برای تک‌تک تسک‌ها</h3>
                  <span className="text-[10px] text-gray-400">
                    {filteredTasks.length === 0 ? "بدون تسک" : `${toPersianDigits(filteredTasks.length)} مورد`}
                  </span>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500 rounded-2xl border border-dashed" style={{ borderColor: `${cardBorder}80` }}>
                    هیچ تسکی با فیلترهای انتخابی در این بازه ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {filteredTasks.map((task) => {
                      const act = activities.find((a) => a.id === task.activity_id);
                      const isDone = task.status === "done";
                      return (
                        <div 
                          key={task.id} 
                          className="flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all"
                          style={{ 
                            borderColor: act ? `${act.color}35` : cardBorder,
                            backgroundColor: act ? `${act.color}08` : "rgba(255,255,255,0.02)"
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {act && (
                                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                              )}
                              <span className={`text-xs font-bold truncate ${isDone ? "line-through opacity-70" : ""}`} style={{ color: fg }}>
                                {task.title}
                              </span>
                            </div>
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {task.tags.map((tag) => (
                                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span 
                              className="text-[9px] font-bold px-2 py-0.5 rounded-lg"
                              style={{ 
                                backgroundColor: isDone ? "rgba(52,211,153,0.15)" : task.status === "in_progress" ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.15)",
                                color: isDone ? "#34d399" : task.status === "in_progress" ? "#fbbf24" : fgMuted
                              }}
                            >
                              {isDone ? "انجام‌شده" : task.status === "in_progress" ? "در حال انجام" : "در انتظار"}
                            </span>
                            <span className="text-xs font-bold font-mono" style={{ color: "#818cf8" }}>
                              {formatDuration(task.elapsed_seconds || 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* تفکیک زمان بر اساس تک‌تک تگ‌ها */}
              {tagBreakdown.length > 0 && (
                <div className="rounded-3xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                  <h3 className="text-xs font-bold" style={{ color: fg }}>زمان صرف‌شده به تفکیک هشتگ‌ها و تگ‌ها</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tagBreakdown.map((item) => (
                      <div 
                        key={item.tag} 
                        className="p-2.5 rounded-2xl border flex items-center justify-between gap-2"
                        style={{ borderColor: `${item.color}35`, backgroundColor: `${item.color}0a` }}
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate" style={{ color: item.color }}>
                            #{item.tag}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {toPersianDigits(item.count)} تسک
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono" style={{ color: fg }}>
                          {formatDuration(item.seconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* نمودار خطی روند فعالیت‌ها در زمان (عیناً مانند کانبان) */}
              {kanbanLineData.length > 1 && (
                <div className="rounded-3xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                  <h3 className="text-xs font-bold" style={{ color: fg }}>نمودار خطی روند فعالیت‌ها در طول زمان</h3>
                  <div style={{ width: "100%", height: 230 }} dir="ltr">
                    <ResponsiveContainer>
                      <LineChart data={kanbanLineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: fgMuted }} />
                        <YAxis tick={{ fontSize: 9, fill: fgMuted }} unit="m" />
                        <RechartTooltip content={<KanbanChartTooltip />} />
                        {activeActivitiesForChart.map((a) => (
                          <Line 
                            key={a.id} 
                            type="monotone" 
                            dataKey={a.name} 
                            stroke={a.color} 
                            strokeWidth={2} 
                            dot={{ r: 3, fill: a.color }} 
                          />
                        ))}
                        {(selectedActivityIds.length === 0 || selectedActivityIds.includes("__none__")) && (
                          <Line 
                            type="monotone" 
                            dataKey="بدون فعالیت" 
                            stroke="#94a3b8" 
                            strokeWidth={1.5} 
                            strokeDasharray="4 4" 
                            dot={false} 
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="p-12 text-center text-xs text-gray-500 rounded-3xl border border-dashed" style={{ borderColor: cardBorder }}>
            بازه گزارش را از تقویم سمت راست انتخاب کنید و روی دکمه تایید بزنید.
          </div>
        )}
      </div>
    </div>
  );
}
