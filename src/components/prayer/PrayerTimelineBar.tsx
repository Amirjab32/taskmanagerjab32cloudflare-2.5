import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  calculatePrayerTimes, 
  PrayerSettingsService, 
  IRAN_PROVINCES,
  PrayerTimesResult 
} from "@/lib/prayerTimes";
import { toPersianDigits } from "@/lib/shamsi";
import { MapPin, Sliders, CheckCircle2, Clock, X } from "lucide-react";

export default function PrayerTimelineBar() {
  const [province, setProvince] = useState<string>(() => PrayerSettingsService.getProvince());
  const [city, setCity] = useState<string>(() => PrayerSettingsService.getCity());
  const [offset, setOffset] = useState<number>(() => PrayerSettingsService.getOffset());
  const [now, setNow] = useState<Date>(() => new Date());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // بروزرسانی زمان و شنود تغییرات تنظیمات
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000); // هر ۱۰ ثانیه برای به‌روزرسانی زنده ساعت و نشانگر

    const handleSettingsChanged = () => {
      setProvince(PrayerSettingsService.getProvince());
      setCity(PrayerSettingsService.getCity());
      setOffset(PrayerSettingsService.getOffset());
    };

    window.addEventListener("focusflow-prayer-settings-changed", handleSettingsChanged);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focusflow-prayer-settings-changed", handleSettingsChanged);
    };
  }, []);

  // لیست شهرهای استان انتخاب شده
  const availableCities = useMemo(() => {
    return PrayerSettingsService.getCitiesByProvince(province);
  }, [province]);

  // محاسبه اوقات شرعی روز جاری
  const times: PrayerTimesResult = useMemo(() => {
    return calculatePrayerTimes(now, city, offset);
  }, [now, city, offset]);

  // زمان فعلی بر حسب دقیقه از بامداد
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const currentFormattedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // محدوده نوار: از ۵:۰۰ صبح (۳۰۰ دقیقه) تا ۲۴:۰۰ شب (۱۴۴۰ دقیقه)
  const START_MIN = 300;
  const END_MIN = 1440;
  const TOTAL_MIN = END_MIN - START_MIN;

  // تبدیل دقیقه به درصد موقعیت در تایم‌لاین
  const minToPercent = (m: number): number => {
    const clamped = Math.max(START_MIN, Math.min(END_MIN, m));
    return ((clamped - START_MIN) / TOTAL_MIN) * 100;
  };

  // درصد موقعیت نشانگر زمان فعلی
  const isWithinTimeline = currentMinutes >= START_MIN && currentMinutes <= END_MIN;
  const currentPercent = minToPercent(currentMinutes);

  // لیست ساعات جهت نمایش اعداد و خط‌کش تقویم زمانی (از ۵ تا ۲۴)
  const allHours = useMemo(() => {
    const list = [];
    for (let h = 5; h <= 24; h++) {
      list.push(h);
    }
    return list;
  }, []);

  // وضعیت لحظه‌ای نماز برای پنجره پاپ‌آپ
  const currentStatus = useMemo(() => {
    const m = currentMinutes;
    // صبح
    if (m >= times.fajrMin && m < times.sunriseMin) {
      const isFadhilah = m <= times.fajrFadhilahEndMin;
      const leftMins = Math.round(times.sunriseMin - m);
      return {
        prayerName: "نماز صبح",
        isFadhilah,
        title: isFadhilah ? "وقت نماز صبح (اول وقت - فضیلت)" : "وقت ادای نماز صبح",
        remainingText: `${toPersianDigits(leftMins)} دقیقه تا طلوع آفتاب (قضا)`,
        badgeColor: isFadhilah ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-teal-300 bg-teal-500/10 border-teal-500/30",
        active: true
      };
    }
    // ظهر و عصر
    if (m >= times.dhuhrMin && m < times.maghribMin) {
      const isAsr = m >= times.asrMin;
      const isFadhilah = isAsr 
        ? m <= times.asrFadhilahEndMin 
        : m <= times.dhuhrFadhilahEndMin;
      const leftMins = isAsr 
        ? Math.round(times.maghribMin - m) 
        : Math.round(times.asrMin - m);
      return {
        prayerName: isAsr ? "نماز عصر" : "نماز ظهر",
        isFadhilah,
        title: isAsr 
          ? (isFadhilah ? "وقت نماز عصر (اول وقت - فضیلت)" : "وقت ادای نماز عصر") 
          : (isFadhilah ? "وقت نماز ظهر (اول وقت - فضیلت)" : "وقت ادای نماز ظهر"),
        remainingText: isAsr
          ? `${toPersianDigits(leftMins)} دقیقه تا اذان مغرب`
          : `${toPersianDigits(leftMins)} دقیقه تا اذان عصر (${toPersianDigits(times.asr)})`,
        badgeColor: isFadhilah ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-teal-300 bg-teal-500/10 border-teal-500/30",
        active: true
      };
    }
    // مغرب و عشاء
    if (m >= times.maghribMin && m <= times.midnightMin) {
      const isIsha = m >= times.ishaMin;
      const isFadhilah = isIsha 
        ? m <= times.ishaFadhilahEndMin 
        : m <= times.maghribFadhilahEndMin;
      const leftMins = Math.round(times.midnightMin - m);
      return {
        prayerName: isIsha ? "نماز عشاء" : "نماز مغرب",
        isFadhilah,
        title: isIsha 
          ? (isFadhilah ? "وقت نماز عشاء (اول وقت - فضیلت)" : "وقت ادای نماز عشاء") 
          : (isFadhilah ? "وقت نماز مغرب (اول وقت - فضیلت)" : "وقت ادای نماز مغرب"),
        remainingText: !isIsha
          ? `${toPersianDigits(Math.round(times.ishaMin - m))} دقیقه تا اذان عشاء (${toPersianDigits(times.isha)})`
          : `${toPersianDigits(leftMins)} دقیقه تا نیمه‌شب شرعی (قضا)`,
        badgeColor: isFadhilah ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-teal-300 bg-teal-500/10 border-teal-500/30",
        active: true
      };
    }

    // خارج از وقت نماز
    let nextName = "اذان ظهر";
    let nextMin = times.dhuhrMin;
    if (m < times.fajrMin) {
      nextName = "اذان صبح";
      nextMin = times.fajrMin;
    } else if (m < times.dhuhrMin) {
      nextName = "اذان ظهر";
      nextMin = times.dhuhrMin;
    } else if (m < times.maghribMin) {
      nextName = "اذان مغرب";
      nextMin = times.maghribMin;
    } else {
      nextName = "اذان صبح فردا";
      nextMin = times.fajrMin + 1440;
    }

    const diff = Math.max(0, Math.round(nextMin - m));
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    const timeStr = hours > 0 
      ? `${toPersianDigits(hours)} ساعت و ${toPersianDigits(mins)} دقیقه` 
      : `${toPersianDigits(mins)} دقیقه`;

    return {
      prayerName: nextName,
      isFadhilah: false,
      title: `در انتظار ${nextName}`,
      remainingText: `${timeStr} تا ${nextName}`,
      badgeColor: "text-zinc-400 bg-white/5 border-white/10",
      active: false
    };
  }, [currentMinutes, times]);

  // بستن پنجره با کلیک در فضای بیرون
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full select-none z-20 border-b border-white/[0.06] bg-[#0c0c0e]/95 backdrop-blur-md transition-all"
      onClick={() => setIsOpen((prev) => !prev)}
      title="تایم‌لاین ساعت و اوقات نماز (۵:۰۰ تا ۲۴:۰۰) - کلیک برای مشاهده جزئیات و تنظیم شهر"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-1.5 pb-1 cursor-pointer">
        
        {/* ۱. اعداد ساعت بالای خط‌کش تایم‌لاین */}
        <div className="relative w-full h-3.5 mb-0.5 text-[9px] font-mono select-none" dir="ltr">
          {allHours.map((h) => {
            const pos = ((h * 60 - START_MIN) / TOTAL_MIN) * 100;
            // در موبایل برای جلوگیری از شلوغی اعداد زوج یا فرد را نمایش می‌دهیم، در دسکتاپ تمام ساعات
            const isVisibleOnMobile = h % 2 === 1 || h === 24;
            return (
              <span
                key={h}
                className={`absolute -translate-x-1/2 font-bold transition-colors ${
                  isVisibleOnMobile ? "inline-block" : "hidden sm:inline-block"
                } ${
                  Math.floor(currentMinutes / 60) === h
                    ? "text-[#e2e8f0] font-black"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                style={{ left: `${pos}%` }}
              >
                {toPersianDigits(h === 24 ? "۲۴" : `${h}`)}
              </span>
            );
          })}
        </div>

        {/* ۲. ردیف خط‌کش تقسیم‌بندی ساعت و نیم‌ساعت */}
        <div className="relative w-full h-1.5 mb-0.5 select-none" dir="ltr">
          {/* خطوط هر ساعت کامل */}
          {allHours.map((h) => {
            const pos = ((h * 60 - START_MIN) / TOTAL_MIN) * 100;
            return (
              <div
                key={`tick-${h}`}
                className="absolute top-0 w-[1px] h-full bg-white/20 -translate-x-1/2"
                style={{ left: `${pos}%` }}
              />
            );
          })}
          {/* خطوط نیم ساعت (کوتاه‌تر) */}
          {allHours.slice(0, -1).map((h) => {
            const pos = (((h * 60 + 30) - START_MIN) / TOTAL_MIN) * 100;
            return (
              <div
                key={`subtick-${h}`}
                className="absolute top-0.5 w-[1px] h-1 bg-white/10 -translate-x-1/2"
                style={{ left: `${pos}%` }}
              />
            );
          })}
        </div>

        {/* ۳. نوار اصلی تایم‌لاین و بازه‌های نماز (چپ به راست از ۵ تا ۲۴) */}
        <div className="relative w-full h-3.5 rounded-full overflow-hidden bg-white/[0.04] border border-white/[0.08]" dir="ltr">
          
          {/* بازه نماز صبح (اذان صبح تا طلوع) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/25"
            style={{
              left: `${minToPercent(times.fajrMin)}%`,
              width: `${Math.max(0, minToPercent(times.sunriseMin) - minToPercent(times.fajrMin))}%`
            }}
          />
          {/* بخش اول وقت (فضیلت صبح) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-400/70 border-r border-emerald-300/50"
            style={{
              left: `${minToPercent(times.fajrMin)}%`,
              width: `${Math.max(0, minToPercent(times.fajrFadhilahEndMin) - minToPercent(times.fajrMin))}%`
            }}
          />

          {/* بازه نماز ظهر و عصر (اذان ظهر تا مغرب) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/25"
            style={{
              left: `${minToPercent(times.dhuhrMin)}%`,
              width: `${Math.max(0, minToPercent(times.maghribMin) - minToPercent(times.dhuhrMin))}%`
            }}
          />
          {/* بخش اول وقت (فضیلت ظهر) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-400/70 border-r border-emerald-300/50"
            style={{
              left: `${minToPercent(times.dhuhrMin)}%`,
              width: `${Math.max(0, minToPercent(times.dhuhrFadhilahEndMin) - minToPercent(times.dhuhrMin))}%`
            }}
          />

          {/* خط نشان مشخص و واضح اذان عصر */}
          <div
            className="absolute top-0 bottom-0 w-[2.5px] bg-amber-300/90 z-[5] -translate-x-1/2"
            style={{
              left: `${minToPercent(times.asrMin)}%`
            }}
            title={`اذان عصر: ${times.asr}`}
          />
          {/* بخش اول وقت (فضیلت عصر - ۲۵ دقیقه) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-400/70 border-r border-emerald-300/50"
            style={{
              left: `${minToPercent(times.asrMin)}%`,
              width: `${Math.max(0, minToPercent(times.asrFadhilahEndMin) - minToPercent(times.asrMin))}%`
            }}
          />

          {/* بازه نماز مغرب و عشاء (اذان مغرب تا نیمه‌شب شرعی) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/25"
            style={{
              left: `${minToPercent(times.maghribMin)}%`,
              width: `${Math.max(0, minToPercent(times.midnightMin) - minToPercent(times.maghribMin))}%`
            }}
          />
          {/* بخش اول وقت (فضیلت مغرب) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-400/70 border-r border-emerald-300/50"
            style={{
              left: `${minToPercent(times.maghribMin)}%`,
              width: `${Math.max(0, minToPercent(times.maghribFadhilahEndMin) - minToPercent(times.maghribMin))}%`
            }}
          />

          {/* خط نشان مشخص و واضح اذان عشاء */}
          <div
            className="absolute top-0 bottom-0 w-[2.5px] bg-sky-300/90 z-[5] -translate-x-1/2"
            style={{
              left: `${minToPercent(times.ishaMin)}%`
            }}
            title={`اذان عشاء: ${times.isha}`}
          />
          {/* بخش اول وقت (فضیلت عشاء - ۲۵ دقیقه) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-400/70 border-r border-emerald-300/50"
            style={{
              left: `${minToPercent(times.ishaMin)}%`,
              width: `${Math.max(0, minToPercent(times.ishaFadhilahEndMin) - minToPercent(times.ishaMin))}%`
            }}
          />

          {/* ۴. نشانگر ساعت واقعی - پاستلی، مات و حرکت دقیق چپ به راست */}
          {isWithinTimeline && (
            <div
              className="absolute top-0 bottom-0 w-[2.5px] bg-[#cbd5e1] z-10 transition-all duration-300 -translate-x-1/2"
              style={{
                left: `${currentPercent}%`
              }}
            >
              {/* نقطه فوقانی پاستلی بدون درخشش تند */}
              <div className="w-2.5 h-2.5 rounded-full bg-[#f1f5f9] border border-[#94a3b8] absolute -top-[3px] left-1/2 -translate-x-1/2 shadow-sm" />
            </div>
          )}
        </div>
      </div>

      {/* ۵. پنجره جزئیات تعاملی (تنها با کلیک یا لمس باز می‌شود، بدون باز شدن با حرکت موس) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full right-4 left-4 sm:left-auto sm:w-[520px] mt-1 p-3.5 rounded-2xl bg-[#141416]/98 border border-white/10 shadow-2xl backdrop-blur-xl z-30 max-h-[calc(100vh-120px)] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* هدر پنجره */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg border text-xs font-bold ${currentStatus.badgeColor}`}>
                  {currentStatus.active ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-white leading-tight">
                      {currentStatus.title}
                    </h5>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-zinc-300 font-mono">
                      ساعت فعلی: {toPersianDigits(currentFormattedTime)}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {currentStatus.remainingText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowSettings((prev) => !prev)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showSettings ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                  title="انتخاب استان و شهر و تنظیم احتیاط"
                >
                  <Sliders className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowSettings(false);
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="بستن"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* بخش تنظیمات دو مرحله‌ای (استان سپس شهر) */}
            {showSettings && (
              <div className="py-2.5 px-3 my-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {/* مرحله ۱: انتخاب استان */}
                  <div>
                    <label className="text-zinc-400 block mb-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-400" />
                      انتخاب استان:
                    </label>
                    <select
                      value={province}
                      onChange={(e) => {
                        const newProv = e.target.value;
                        setProvince(newProv);
                        PrayerSettingsService.setProvince(newProv);
                        const firstCity = PrayerSettingsService.getCitiesByProvince(newProv)[0];
                        if (firstCity) {
                          setCity(firstCity.name);
                        }
                      }}
                      className="w-full bg-[#1c1c20] text-zinc-200 border border-white/10 text-[11px] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                    >
                      {IRAN_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* مرحله ۲: انتخاب شهر بر اساس استان */}
                  <div>
                    <label className="text-zinc-400 block mb-1">
                      انتخاب شهر ({province}):
                    </label>
                    <select
                      value={city}
                      onChange={(e) => {
                        const newCity = e.target.value;
                        setCity(newCity);
                        PrayerSettingsService.setCity(newCity);
                      }}
                      className="w-full bg-[#1c1c20] text-zinc-200 border border-white/10 text-[11px] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                    >
                      {availableCities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* تنظیم دقایق احتیاط */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                  <span className="text-zinc-400">دقایق احتیاط شخصی شرعی:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        const newO = offset - 1;
                        setOffset(newO);
                        PrayerSettingsService.setOffset(newO);
                      }}
                      className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-emerald-400 font-bold px-1 text-xs">
                      {toPersianDigits(offset > 0 ? `+${offset}` : `${offset}`)} دقیقه
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newO = offset + 1;
                        setOffset(newO);
                        PrayerSettingsService.setOffset(newO);
                      }}
                      className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* جدول ۸ پارامتر دقیق اوقات شرعی امروز */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 text-center">
              {/* ۱. اذان صبح */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-400 block">اذان صبح</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block mt-0.5">
                  {toPersianDigits(times.fajr)}
                </span>
                <span className="text-[8px] text-emerald-400/80 block mt-0.5">اول وقت</span>
              </div>

              {/* ۲. طلوع آفتاب */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-400 block">طلوع آفتاب</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block mt-0.5">
                  {toPersianDigits(times.sunrise)}
                </span>
                <span className="text-[8px] text-zinc-500 block mt-0.5">پایان صبح</span>
              </div>

              {/* ۳. اذان ظهر */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-400 block">اذان ظهر</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block mt-0.5">
                  {toPersianDigits(times.dhuhr)}
                </span>
                <span className="text-[8px] text-emerald-400/80 block mt-0.5">اول وقت</span>
              </div>

              {/* ۴. اذان عصر */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-amber-400/20 bg-amber-400/[0.02]">
                <span className="text-[10px] text-amber-300/90 block">اذان عصر</span>
                <span className="text-xs font-mono font-bold text-amber-200 block mt-0.5">
                  {toPersianDigits(times.asr)}
                </span>
                <span className="text-[8px] text-emerald-400/80 block mt-0.5">اول وقت (۲۵د)</span>
              </div>

              {/* ۵. غروب آفتاب */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-400 block">غروب آفتاب</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block mt-0.5">
                  {toPersianDigits(times.sunset)}
                </span>
                <span className="text-[8px] text-zinc-500 block mt-0.5">غروب خورشید</span>
              </div>

              {/* ۶. اذان مغرب */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-400 block">اذان مغرب</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block mt-0.5">
                  {toPersianDigits(times.maghrib)}
                </span>
                <span className="text-[8px] text-emerald-400/80 block mt-0.5">اول وقت</span>
              </div>

              {/* ۷. اذان عشاء */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-sky-400/20 bg-sky-400/[0.02]">
                <span className="text-[10px] text-sky-300/90 block">اذان عشاء</span>
                <span className="text-xs font-mono font-bold text-sky-200 block mt-0.5">
                  {toPersianDigits(times.isha)}
                </span>
                <span className="text-[8px] text-emerald-400/80 block mt-0.5">اول وقت (۲۵د)</span>
              </div>

              {/* ۸. نیمه‌شب شرعی */}
              <div className="p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-400 block">نیمه‌شب</span>
                <span className="text-xs font-mono font-bold text-zinc-200 block mt-0.5">
                  {toPersianDigits(times.midnight)}
                </span>
                <span className="text-[8px] text-rose-400/70 block mt-0.5">پایان عشاء</span>
              </div>
            </div>

            {/* راهنمای رنگ‌های تایم‌لاین */}
            <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-y-1.5 text-[9px] text-zinc-400 px-1">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-400/70 border border-emerald-300/40 inline-block" />
                <span>اول وقت (۲۵ دقیقه)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-500/25 inline-block" />
                <span>فرصت ادا</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-amber-400 inline-block" />
                <span>اذان عصر ({toPersianDigits(times.asr)})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-sky-400 inline-block" />
                <span>اذان عشاء ({toPersianDigits(times.isha)})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#cbd5e1] inline-block" />
                <span>ساعت فعلی</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
