export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  let jy: number;
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): string {
  const jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gd2 = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  let gm = 0;
  let day = gd2;
  for (gm = 1; gm <= 12 && day > sal_a[gm]; gm++) {
    day -= sal_a[gm];
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${gy}-${pad(gm)}-${pad(day)}`;
}

export function toPersianDigits(input: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[parseInt(d)]);
}

export const MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند",
];

export const GREGORIAN_MONTH_NAMES = [
  "January", "February", "March",
  "April", "May", "June",
  "July", "August", "September",
  "October", "November", "December",
];

export const DAY_NAMES = [
  "یکشنبه", "دوشنبه", "سه‌شنبه",
  "چهارشنبه", "پنجشنبه", "جمعه", "شنبه",
];

function parseDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  const parts = String(input).split("T")[0].split("-");
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(input);
}

export function toShamsi(input: string | Date): string {
  const d = parseDate(input);
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const dayName = DAY_NAMES[d.getDay()];
  return `${dayName}، ${toPersianDigits(jd)} ${MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}`;
}

export function toShamsiShort(input: string | Date): string {
  const d = parseDate(input);
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const pad = (n: number) => String(n).padStart(2, "0");
  return toPersianDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

export function todayShamsi(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const dayName = DAY_NAMES[now.getDay()];
  return `${dayName}، ${toPersianDigits(jd)} ${MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}`;
}

export function todayShamsiShort(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const pad = (n: number) => String(n).padStart(2, "0");
  return toPersianDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

export function todayGregorianFormatted(): string {
  const now = new Date();
  const day = now.getDate();
  const month = GREGORIAN_MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getGregorianToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayDiff(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const r = ((jy % 33) + 33) % 33;
  const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(r);
  return isLeap ? 30 : 29;
}

export function firstDayWeekday(jy: number, jm: number): number {
  const gregFirst = jalaliToGregorian(jy, jm, 1);
  const parts = gregFirst.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return (d.getDay() + 1) % 7;
}

export function getTodayJalali(): [number, number, number] {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getTaskDateRanges(): {
  todayGreg: string;
  weekEndGreg: string;
  monthEndGreg: string;
  currentJalaliMonth: number;
  currentJalaliYear: number;
} {
  const today = getGregorianToday();
  const [jy, jm, jd] = getTodayJalali();
  let weekEndDay: number;
  if (jd <= 7) {
    weekEndDay = 7;
  } else if (jd <= 14) {
    weekEndDay = 14;
  } else if (jd <= 21) {
    weekEndDay = 21;
  } else {
    weekEndDay = daysInJalaliMonth(jy, jm);
  }
  const weekEndGreg = jalaliToGregorian(jy, jm, weekEndDay);
  const monthTotalDays = daysInJalaliMonth(jy, jm);
  const monthEndGreg = jalaliToGregorian(jy, jm, monthTotalDays);
  return {
    todayGreg: today,
    weekEndGreg,
    monthEndGreg,
    currentJalaliMonth: jm,
    currentJalaliYear: jy,
  };
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export const TIME_SLOT_DEFS = [
  { id: "00-03", startH: 0, endH: 3 },
  { id: "03-06", startH: 3, endH: 6 },
  { id: "06-09", startH: 6, endH: 9 },
  { id: "09-12", startH: 9, endH: 12 },
  { id: "12-15", startH: 12, endH: 15 },
  { id: "15-18", startH: 15, endH: 18 },
  { id: "18-21", startH: 18, endH: 21 },
  { id: "21-24", startH: 21, endH: 24 },
];

export function getSlotsForTimeRange(fromTime: string, toTime: string): string[] {
  const fromMin = timeToMinutes(fromTime);
  const toMin = timeToMinutes(toTime);
  const covered: string[] = [];
  for (const slot of TIME_SLOT_DEFS) {
    const slotStart = slot.startH * 60;
    const slotEnd = slot.endH * 60;
    if (fromMin < slotEnd && toMin > slotStart) {
      covered.push(slot.id);
    }
  }
  return covered;
}
