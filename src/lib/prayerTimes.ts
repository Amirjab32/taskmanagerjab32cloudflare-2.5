/**
 * محاسبات دقیق نجومی اوقات شرعی بر اساس فرمول مؤسسه ژئوفیزیک دانشگاه تهران
 * ۱۰۰٪ آفلاین و محلی، بدون نیاز به اینترنت
 */

export interface PrayerTimesResult {
  fajr: string;         // اذان صبح
  sunrise: string;      // طلوع آفتاب
  dhuhr: string;        // اذان ظهر
  asr: string;          // اذان عصر
  sunset: string;       // غروب آفتاب
  maghrib: string;      // اذان مغرب
  isha: string;         // اذان عشاء
  midnight: string;     // نیمه‌شب شرعی
  
  // دقیقه‌ها از ابتدای بامداد (۰ تا ۱۴۴۰)
  fajrMin: number;
  sunriseMin: number;
  dhuhrMin: number;
  asrMin: number;
  sunsetMin: number;
  maghribMin: number;
  ishaMin: number;
  midnightMin: number;

  // بازه‌های اول وقت (فضیلت) به دقیقه (۲۵ دقیقه پس از اذان هر نماز)
  fajrFadhilahEndMin: number;
  dhuhrFadhilahEndMin: number;
  asrFadhilahEndMin: number;
  maghribFadhilahEndMin: number;
  ishaFadhilahEndMin: number;
}

export interface CityCoord {
  name: string;
  province: string;
  lat: number;
  lng: number;
}

export const IRAN_CITIES: CityCoord[] = [
  // تهران
  { name: "تهران", province: "تهران", lat: 35.6892, lng: 51.3890 },
  { name: "شهریار", province: "تهران", lat: 35.6597, lng: 51.0592 },
  { name: "اسلامشهر", province: "تهران", lat: 35.5414, lng: 51.2336 },
  { name: "ورامین", province: "تهران", lat: 35.3242, lng: 51.6467 },
  { name: "دماوند", province: "تهران", lat: 35.7194, lng: 52.0628 },
  { name: "پاکدشت", province: "تهران", lat: 35.5303, lng: 51.6792 },
  { name: "شهر قدس", province: "تهران", lat: 35.7208, lng: 51.1097 },
  { name: "رباط کریم", province: "تهران", lat: 35.4847, lng: 51.0828 },
  { name: "فیروزکوه", province: "تهران", lat: 35.7567, lng: 52.7711 },

  // خراسان رضوی
  { name: "مشهد", province: "خراسان رضوی", lat: 36.2972, lng: 59.6067 },
  { name: "نیشابور", province: "خراسان رضوی", lat: 36.2133, lng: 58.7958 },
  { name: "سبزوار", province: "خراسان رضوی", lat: 36.2125, lng: 57.6761 },
  { name: "تربت حیدریه", province: "خراسان رضوی", lat: 35.2742, lng: 59.2197 },
  { name: "قوچان", province: "خراسان رضوی", lat: 37.1064, lng: 58.5097 },
  { name: "کاشمر", province: "خراسان رضوی", lat: 35.2383, lng: 58.4656 },
  { name: "گناباد", province: "خراسان رضوی", lat: 34.3528, lng: 58.6839 },
  { name: "تربت جام", province: "خراسان رضوی", lat: 35.2444, lng: 60.6225 },

  // اصفهان
  { name: "اصفهان", province: "اصفهان", lat: 32.6546, lng: 51.6680 },
  { name: "کاشان", province: "اصفهان", lat: 33.9850, lng: 51.4100 },
  { name: "نجف‌آباد", province: "اصفهان", lat: 32.6342, lng: 51.3667 },
  { name: "خمینی‌شهر", province: "اصفهان", lat: 32.7003, lng: 51.5217 },
  { name: "شاهین‌شهر", province: "اصفهان", lat: 32.8644, lng: 51.5517 },
  { name: "شهرضا", province: "اصفهان", lat: 31.9950, lng: 51.8678 },
  { name: "زرین‌شهر", province: "اصفهان", lat: 32.3897, lng: 51.3764 },
  { name: "گلپایگان", province: "اصفهان", lat: 33.4539, lng: 50.2883 },
  { name: "نائین", province: "اصفهان", lat: 32.8600, lng: 53.0867 },

  // فارس
  { name: "شیراز", province: "فارس", lat: 29.5918, lng: 52.5837 },
  { name: "مرودشت", province: "فارس", lat: 29.8742, lng: 52.8028 },
  { name: "جهرم", province: "فارس", lat: 28.5000, lng: 53.5600 },
  { name: "فسا", province: "فارس", lat: 28.9383, lng: 53.6481 },
  { name: "کازرون", province: "فارس", lat: 29.6194, lng: 51.6542 },
  { name: "لار", province: "فارس", lat: 27.6833, lng: 54.3333 },
  { name: "آباده", province: "فارس", lat: 31.1608, lng: 52.6506 },
  { name: "داراب", province: "فارس", lat: 28.7519, lng: 54.5444 },

  // آذربایجان شرقی
  { name: "تبریز", province: "آذربایجان شرقی", lat: 38.0800, lng: 46.2919 },
  { name: "مراغه", province: "آذربایجان شرقی", lat: 37.3917, lng: 46.2392 },
  { name: "مرند", province: "آذربایجان شرقی", lat: 38.4331, lng: 45.7750 },
  { name: "میانه", province: "آذربایجان شرقی", lat: 37.4228, lng: 47.7153 },
  { name: "اهر", province: "آذربایجان شرقی", lat: 38.4775, lng: 47.0700 },
  { name: "بناب", province: "آذربایجان شرقی", lat: 37.3403, lng: 46.0561 },
  { name: "سراب", province: "آذربایجان شرقی", lat: 37.9408, lng: 47.5367 },

  // آذربایجان غربی
  { name: "ارومیه", province: "آذربایجان غربی", lat: 37.5527, lng: 45.0761 },
  { name: "خوی", province: "آذربایجان غربی", lat: 38.5503, lng: 44.9536 },
  { name: "بوکان", province: "آذربایجان غربی", lat: 36.5208, lng: 46.2089 },
  { name: "مهاباد", province: "آذربایجان غربی", lat: 36.7631, lng: 45.7222 },
  { name: "میاندوآب", province: "آذربایجان غربی", lat: 36.9681, lng: 46.1042 },
  { name: "سلماس", province: "آذربایجان غربی", lat: 38.1969, lng: 44.7644 },
  { name: "پیرانشهر", province: "آذربایجان غربی", lat: 36.7011, lng: 45.1417 },

  // البرز
  { name: "کرج", province: "البرز", lat: 35.8327, lng: 50.9915 },
  { name: "فردیس", province: "البرز", lat: 35.7236, lng: 50.9850 },
  { name: "ساوجبلاغ", province: "البرز", lat: 35.9556, lng: 50.7167 },
  { name: "نظرآباد", province: "البرز", lat: 35.9539, lng: 50.6061 },
  { name: "طالقان", province: "البرز", lat: 36.1775, lng: 50.7656 },
  { name: "اشتهارد", province: "البرز", lat: 35.7231, lng: 50.3683 },

  // خوزستان
  { name: "اهواز", province: "خوزستان", lat: 31.3183, lng: 48.6706 },
  { name: "دزفول", province: "خوزستان", lat: 32.3811, lng: 48.4058 },
  { name: "آبادان", province: "خوزستان", lat: 30.3392, lng: 48.3044 },
  { name: "خرمشهر", province: "خوزستان", lat: 30.4397, lng: 48.1814 },
  { name: "ماهشهر", province: "خوزستان", lat: 30.5589, lng: 49.1981 },
  { name: "بهبهان", province: "خوزستان", lat: 30.5958, lng: 50.2417 },
  { name: "شوشتر", province: "خوزستان", lat: 32.0456, lng: 48.8567 },
  { name: "ایذه", province: "خوزستان", lat: 31.8336, lng: 49.8661 },

  // مازندران
  { name: "ساری", province: "مازندران", lat: 36.5633, lng: 53.0601 },
  { name: "بابل", province: "مازندران", lat: 36.5500, lng: 52.6833 },
  { name: "آمل", province: "مازندران", lat: 36.4667, lng: 52.3500 },
  { name: "قائم‌شهر", province: "مازندران", lat: 36.4636, lng: 52.8600 },
  { name: "بهشهر", province: "مازندران", lat: 36.6961, lng: 53.5517 },
  { name: "چالوس", province: "مازندران", lat: 36.6550, lng: 51.4206 },
  { name: "تنکابن", province: "مازندران", lat: 36.8164, lng: 50.8739 },
  { name: "رامسر", province: "مازندران", lat: 36.9167, lng: 50.6667 },

  // گیلان
  { name: "رشت", province: "گیلان", lat: 37.2809, lng: 49.5924 },
  { name: "بندر انزلی", province: "گیلان", lat: 37.4681, lng: 49.4628 },
  { name: "لاهیجان", province: "گیلان", lat: 37.2072, lng: 50.0033 },
  { name: "لنگرود", province: "گیلان", lat: 37.1972, lng: 50.1536 },
  { name: "تالش", province: "گیلان", lat: 37.8017, lng: 48.9056 },
  { name: "آستارا", province: "گیلان", lat: 38.4292, lng: 48.8719 },
  { name: "فومن", province: "گیلان", lat: 37.2239, lng: 49.3125 },

  // قم
  { name: "قم", province: "قم", lat: 34.6401, lng: 50.8764 },

  // کرمانشاه
  { name: "کرمانشاه", province: "کرمانشاه", lat: 34.3142, lng: 47.0650 },
  { name: "اسلام‌آباد غرب", province: "کرمانشاه", lat: 34.1094, lng: 46.5275 },
  { name: "کنگاور", province: "کرمانشاه", lat: 34.5042, lng: 47.9653 },
  { name: "سنقر", province: "کرمانشاه", lat: 34.7836, lng: 47.6003 },
  { name: "پاوه", province: "کرمانشاه", lat: 35.0433, lng: 46.3564 },

  // همدان
  { name: "همدان", province: "همدان", lat: 34.7989, lng: 48.5150 },
  { name: "ملایر", province: "همدان", lat: 34.2969, lng: 48.8236 },
  { name: "نهاوند", province: "همدان", lat: 34.1886, lng: 48.3769 },
  { name: "تویسرکان", province: "همدان", lat: 34.5483, lng: 48.4467 },

  // مرکزی
  { name: "اراک", province: "مرکزی", lat: 34.0954, lng: 49.7013 },
  { name: "ساوه", province: "مرکزی", lat: 35.0211, lng: 50.3567 },
  { name: "خمین", province: "مرکزی", lat: 33.6422, lng: 50.0789 },
  { name: "محلات", province: "مرکزی", lat: 33.9114, lng: 50.4550 },

  // قزوین
  { name: "قزوین", province: "قزوین", lat: 36.2797, lng: 50.0049 },
  { name: "تاکستان", province: "قزوین", lat: 36.0694, lng: 49.6958 },
  { name: "الوند", province: "قزوین", lat: 36.1892, lng: 50.0642 },
  { name: "آبیک", province: "قزوین", lat: 36.0528, lng: 50.5361 },

  // زنجان
  { name: "زنجان", province: "زنجان", lat: 36.6765, lng: 48.4963 },
  { name: "ابهر", province: "زنجان", lat: 36.1467, lng: 49.2181 },
  { name: "خرمدره", province: "زنجان", lat: 36.2056, lng: 49.1889 },
  { name: "قیدار", province: "زنجان", lat: 35.8569, lng: 48.5914 },

  // کردستان
  { name: "سنندج", province: "کردستان", lat: 35.3144, lng: 46.9923 },
  { name: "سقز", province: "کردستان", lat: 36.2497, lng: 46.2733 },
  { name: "مریوان", province: "کردستان", lat: 35.5269, lng: 46.1761 },
  { name: "بانه", province: "کردستان", lat: 35.9975, lng: 45.8853 },
  { name: "قروه", province: "کردستان", lat: 35.1664, lng: 47.8044 },

  // لرستان
  { name: "خرم‌آباد", province: "لرستان", lat: 33.4878, lng: 48.3558 },
  { name: "بروجرد", province: "لرستان", lat: 33.8972, lng: 48.7517 },
  { name: "دورود", province: "لرستان", lat: 33.4939, lng: 49.0750 },
  { name: "کوهدشت", province: "لرستان", lat: 33.5350, lng: 47.6061 },
  { name: "الیگودرز", province: "لرستان", lat: 33.4006, lng: 49.6950 },

  // یزد
  { name: "یزد", province: "یزد", lat: 31.8974, lng: 54.3569 },
  { name: "میبد", province: "یزد", lat: 32.2500, lng: 54.0167 },
  { name: "اردکان", province: "یزد", lat: 32.3100, lng: 54.0175 },
  { name: "بافق", province: "یزد", lat: 31.6033, lng: 55.4028 },

  // کرمان
  { name: "کرمان", province: "کرمان", lat: 30.2839, lng: 57.0834 },
  { name: "سیرجان", province: "کرمان", lat: 29.4522, lng: 55.6811 },
  { name: "رفسنجان", province: "کرمان", lat: 30.4067, lng: 55.9939 },
  { name: "جیرفت", province: "کرمان", lat: 28.6781, lng: 57.7406 },
  { name: "بم", province: "کرمان", lat: 29.1061, lng: 58.3572 },

  // سمنان
  { name: "سمنان", province: "سمنان", lat: 35.5769, lng: 53.3970 },
  { name: "شاهرود", province: "سمنان", lat: 36.4181, lng: 54.9764 },
  { name: "دامغان", province: "سمنان", lat: 36.1683, lng: 54.3475 },
  { name: "گرمسار", province: "سمنان", lat: 35.2181, lng: 52.3403 },

  // گلستان
  { name: "گرگان", province: "گلستان", lat: 36.8427, lng: 54.4439 },
  { name: "گنبد کاووس", province: "گلستان", lat: 37.2500, lng: 55.1672 },
  { name: "علی‌آباد کتول", province: "گلستان", lat: 36.9083, lng: 54.8689 },
  { name: "بندر ترکمن", province: "گلستان", lat: 36.9000, lng: 54.0667 },

  // اردبیل
  { name: "اردبیل", province: "اردبیل", lat: 38.2498, lng: 48.2933 },
  { name: "پارس‌آباد", province: "اردبیل", lat: 39.6486, lng: 47.9172 },
  { name: "مشگین‌شهر", province: "اردبیل", lat: 38.3986, lng: 47.6822 },
  { name: "خلخال", province: "اردبیل", lat: 37.6189, lng: 48.5258 },

  // هرمزگان
  { name: "بندرعباس", province: "هرمزگان", lat: 27.1832, lng: 56.2666 },
  { name: "قشم", province: "هرمزگان", lat: 26.9581, lng: 56.2719 },
  { name: "کیش", province: "هرمزگان", lat: 26.5578, lng: 53.9806 },
  { name: "میناب", province: "هرمزگان", lat: 27.1467, lng: 57.0800 },
  { name: "بندرلنگه", province: "هرمزگان", lat: 26.5578, lng: 54.8806 },

  // بوشهر
  { name: "بوشهر", province: "بوشهر", lat: 28.9234, lng: 50.8203 },
  { name: "برازجان", province: "بوشهر", lat: 29.2667, lng: 51.2167 },
  { name: "کنگان", province: "بوشهر", lat: 27.8339, lng: 52.0656 },
  { name: "گناوه", province: "بوشهر", lat: 29.5792, lng: 50.5175 },
  { name: "عسلویه", province: "بوشهر", lat: 27.4761, lng: 52.6078 },

  // سیستان و بلوچستان
  { name: "زاهدان", province: "سیستان و بلوچستان", lat: 29.4963, lng: 60.8629 },
  { name: "زابل", province: "سیستان و بلوچستان", lat: 31.0294, lng: 61.4947 },
  { name: "چابهار", province: "سیستان و بلوچستان", lat: 25.2919, lng: 60.6431 },
  { name: "ایرانشهر", province: "سیستان و بلوچستان", lat: 27.2025, lng: 60.6847 },

  // خراسان جنوبی
  { name: "بیرجند", province: "خراسان جنوبی", lat: 32.8663, lng: 59.2211 },
  { name: "قائن", province: "خراسان جنوبی", lat: 33.7275, lng: 59.1844 },
  { name: "فردوس", province: "خراسان جنوبی", lat: 34.0186, lng: 58.1722 },
  { name: "طبس", province: "خراسان جنوبی", lat: 33.5958, lng: 56.9244 },

  // خراسان شمالی
  { name: "بجنورد", province: "خراسان شمالی", lat: 37.4747, lng: 57.3290 },
  { name: "شیروان", province: "خراسان شمالی", lat: 37.3967, lng: 57.9294 },
  { name: "اسفراین", province: "خراسان شمالی", lat: 37.0764, lng: 57.5100 },

  // ایلام
  { name: "ایلام", province: "ایلام", lat: 33.6374, lng: 46.4227 },
  { name: "دهلران", province: "ایلام", lat: 32.6942, lng: 47.2678 },
  { name: "ایوان", province: "ایلام", lat: 33.8267, lng: 46.3094 },

  // چهارمحال و بختیاری
  { name: "شهرکرد", province: "چهارمحال و بختیاری", lat: 32.3256, lng: 50.8644 },
  { name: "بروجن", province: "چهارمحال و بختیاری", lat: 31.9683, lng: 51.2900 },
  { name: "لردگان", province: "چهارمحال و بختیاری", lat: 31.5108, lng: 50.8286 },

  // کهگیلویه و بویراحمد
  { name: "یاسوج", province: "کهگیلویه و بویراحمد", lat: 30.6684, lng: 51.5876 },
  { name: "دوگنبدان", province: "کهگیلویه و بویراحمد", lat: 30.3586, lng: 50.7981 },
  { name: "دهدشت", province: "کهگیلویه و بویراحمد", lat: 30.7936, lng: 50.5647 }
];

export const IRAN_PROVINCES: string[] = Array.from(
  new Set(IRAN_CITIES.map((c) => c.province))
).sort((a, b) => a.localeCompare(b, "fa"));

function dtr(d: number): number {
  return (d * Math.PI) / 180.0;
}
function rtd(r: number): number {
  return (r * 180.0) / Math.PI;
}
function fixHour(a: number): number {
  a = a - 24.0 * Math.floor(a / 24.0);
  return a < 0 ? a + 24.0 : a;
}

// محاسبه زاویه میل خورشید و معادله زمان
function sunPosition(julianDate: number): { declination: number; equation: number } {
  const d = julianDate - 2451545.0;
  const g = 357.529 + 0.98560028 * d;
  const q = 280.459 + 0.98564736 * d;
  const l = q + 1.915 * Math.sin(dtr(g)) + 0.02 * Math.sin(dtr(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(l)), Math.cos(dtr(l)))) / 15.0;
  const declination = rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(l))));
  const equation = q / 15.0 - fixHour(ra);
  return { declination, equation };
}

// محاسبه زمان رسیدن خورشید به زاویه ارتفاعی مشخص
function computeSunHour(angle: number, lat: number, declination: number): number {
  const cosH =
    (Math.sin(dtr(-angle)) - Math.sin(dtr(lat)) * Math.sin(dtr(declination))) /
    (Math.cos(dtr(lat)) * Math.cos(dtr(declination)));
  if (cosH > 1 || cosH < -1) return 0;
  return rtd(Math.acos(cosH)) / 15.0;
}

function formatMinutes(totalMins: number): string {
  const mins = Math.floor(totalMins) % 1440;
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

export function calculatePrayerTimes(
  date: Date = new Date(),
  cityName: string = "تهران",
  offsetMins: number = 0
): PrayerTimesResult {
  const city = IRAN_CITIES.find((c) => c.name === cityName) || IRAN_CITIES[0];
  const { lat, lng } = city;

  // منطقه زمانی ایران (همیشه ۳.۵+ از سال ۱۴۰۲ به بعد)
  const timezone = 3.5;

  // محاسبه روز ژولینی
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jd =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  const { declination, equation } = sunPosition(jd);

  // ظهر شرعی
  const noonHour = 12.0 + timezone - lng / 15.0 - equation;

  // طلوع و غروب استاندارد (زاویه ۰.۸۳۳ درجه به دلیل شکست نور و قطر قرص خورشید)
  const sunHalfDay = computeSunHour(0.833, lat, declination);
  const sunriseHour = noonHour - sunHalfDay;
  const sunsetHour = noonHour + sunHalfDay;

  // اذان صبح (زاویه ۱۷.۷ درجه موسسه ژئوفیزیک دانشگاه تهران)
  const fajrDiff = computeSunHour(17.7, lat, declination);
  const fajrHour = noonHour - fajrDiff;

  // اذان عصر بر اساس طول سایه شاخص (موسسه ژئوفیزیک تهران / استاندارد نجومی)
  // زاویه ارتفاع خورشید وقتی سایه جسم برابر طول شاخص به اضافه سایه ظهر شود
  const asrAngle = rtd(
    Math.atan(1.0 / (1.0 + Math.tan(dtr(Math.abs(lat - declination)))))
  );
  const asrDiff = computeSunHour(-asrAngle, lat, declination);
  const asrHour = noonHour + asrDiff;

  // اذان مغرب (زاویه ۴.۵ درجه شیعه / ژئوفیزیک تهران)
  const maghribDiff = computeSunHour(4.5, lat, declination);
  const maghribHour = noonHour + maghribDiff;

  // اذان عشاء (زاویه انحطاط ۱۴ درجه موسسه ژئوفیزیک تهران)
  const ishaDiff = computeSunHour(14.0, lat, declination);
  const ishaHour = noonHour + ishaDiff;

  // نیمه‌شب شرعی: میانگین اذان مغرب و اذان صبح فردا
  const midnightHour = (maghribHour + (fajrHour + 24.0)) / 2.0;

  // تبدیل به دقیقه از ساعت ۰۰:۰۰
  const toMin = (h: number) => Math.round(fixHour(h) * 60) + offsetMins;

  const fajrMin = toMin(fajrHour);
  const sunriseMin = toMin(sunriseHour);
  const dhuhrMin = toMin(noonHour);
  const asrMin = toMin(asrHour);
  const sunsetMin = toMin(sunsetHour);
  const maghribMin = toMin(maghribHour);
  const ishaMin = toMin(ishaHour);
  const midnightMin = toMin(midnightHour);

  // بازه‌های اول وقت (فضیلت): دقیقاً ۲۵ دقیقه از زمان اذان هر نماز
  const fajrFadhilahEndMin = Math.min(sunriseMin, fajrMin + 25);
  const dhuhrFadhilahEndMin = Math.min(asrMin, dhuhrMin + 25);
  const asrFadhilahEndMin = Math.min(sunsetMin, asrMin + 25);
  const maghribFadhilahEndMin = Math.min(ishaMin, maghribMin + 25);
  const ishaFadhilahEndMin = Math.min(midnightMin, ishaMin + 25);

  return {
    fajr: formatMinutes(fajrMin),
    sunrise: formatMinutes(sunriseMin),
    dhuhr: formatMinutes(dhuhrMin),
    asr: formatMinutes(asrMin),
    sunset: formatMinutes(sunsetMin),
    maghrib: formatMinutes(maghribMin),
    isha: formatMinutes(ishaMin),
    midnight: formatMinutes(midnightMin),

    fajrMin,
    sunriseMin,
    dhuhrMin,
    asrMin,
    sunsetMin,
    maghribMin,
    ishaMin,
    midnightMin,

    fajrFadhilahEndMin,
    dhuhrFadhilahEndMin,
    asrFadhilahEndMin,
    maghribFadhilahEndMin,
    ishaFadhilahEndMin,
  };
}

export const PrayerSettingsService = {
  getProvince(): string {
    if (typeof window === "undefined") return "تهران";
    const saved = localStorage.getItem("focusflow_prayer_province");
    if (saved) return saved;
    const currentCity = this.getCity();
    const found = IRAN_CITIES.find((c) => c.name === currentCity);
    return found ? found.province : "تهران";
  },
  setProvince(province: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("focusflow_prayer_province", province);
    // اگر شهر فعلی در این استان نبود، اولین شهر استان را انتخاب می‌کنیم
    const currentCity = this.getCity();
    const cityInProvince = IRAN_CITIES.find(
      (c) => c.province === province && c.name === currentCity
    );
    if (!cityInProvince) {
      const firstCity = IRAN_CITIES.find((c) => c.province === province);
      if (firstCity) {
        this.setCity(firstCity.name);
      }
    }
    window.dispatchEvent(new CustomEvent("focusflow-prayer-settings-changed"));
  },
  getCity(): string {
    if (typeof window === "undefined") return "تهران";
    return localStorage.getItem("focusflow_prayer_city") || "تهران";
  },
  setCity(city: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("focusflow_prayer_city", city);
    const found = IRAN_CITIES.find((c) => c.name === city);
    if (found) {
      localStorage.setItem("focusflow_prayer_province", found.province);
    }
    window.dispatchEvent(new CustomEvent("focusflow-prayer-settings-changed"));
  },
  getCitiesByProvince(province: string): CityCoord[] {
    return IRAN_CITIES.filter((c) => c.province === province);
  },
  getOffset(): number {
    if (typeof window === "undefined") return 0;
    const val = localStorage.getItem("focusflow_prayer_offset");
    return val ? parseInt(val, 10) : 0;
  },
  setOffset(offset: number): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("focusflow_prayer_offset", offset.toString());
    window.dispatchEvent(new CustomEvent("focusflow-prayer-settings-changed"));
  }
};
