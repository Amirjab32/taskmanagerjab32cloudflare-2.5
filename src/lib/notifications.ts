import { HabitStore, TaskStore } from "./store";
import { getGregorianToday } from "./shamsi";
import { AudioStorageService } from "./audioStorage";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export interface SoundPreset {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const SOUND_PRESETS: SoundPreset[] = [
  { id: "hygiene", name: "مسواک و روتین بهداشتی", category: "بهداشت", description: "آبشار کریستالی شفاف و پرطراوت" },
  { id: "prayer", name: "نماز و معنویت", category: "معنوی", description: "هارمونیک کاسه آرامش‌بخش ۴۳۲ هرتز" },
  { id: "study", name: "درس و مطالعه", category: "آموزش", description: "زنگ برنجی میز مطالعه (دینگ شفاف با طنین)" },
  { id: "workout", name: "ورزش و فعالیت", category: "سلامت", description: "بیت و موزیک پرانرژی باشگاه و تمرین" },
  { id: "water", name: "آب، دارو و ویتامین", category: "سلامت", description: "شر شر و قل‌قل زلال جریان آب" },
  { id: "sleep", name: "خواب و آرامش شب", category: "استراحت", description: "آکورد ملایم پیانویی بدون شوک" },
  { id: "work", name: "کار و امور روزمره", category: "وظایف", description: "دینگ دیجیتال مدرن و دقیق" },
  { id: "urgent", name: "هشدار مهم و فوری", category: "فوری", description: "آژیر خطر اضطراری و استرس‌آور" },
];

export interface VibrationPreset {
  id: string;
  name: string;
  pattern: number[];
  description: string;
}

export const VIBRATION_PRESETS: VibrationPreset[] = [
  { id: "heartbeat", name: "دو ضرب سریع (انرژی)", pattern: [120, 80, 150], description: "ریتم تپش قلب" },
  { id: "standard", name: "تک‌ضرب استاندارد", pattern: [400], description: "یک لرزش متوسط" },
  { id: "urgent", name: "سه ضرب هشدار (فوری)", pattern: [200, 100, 200, 100, 400], description: "لرزش تاکیدی و قوی" },
  { id: "gentle", name: "ممتد و ملایم (آرامش)", pattern: [350, 200, 350], description: "لرزش آرام" },
  { id: "silent", name: "خاموش (بدون لرزش)", pattern: [], description: "فقط صدا" },
];

export function getVibrationPattern(vibeId?: string): number[] {
  const match = VIBRATION_PRESETS.find((v) => v.id === vibeId);
  return match ? match.pattern : [120, 80, 150];
}

interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  sound?: string;
  vibrate?: number[];
}

// کلید ثبت اعلان‌های ارسال شده برای جلوگیری از ارسال مکرر در یک روز
function getTodayNotifiedKey(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return `focusflow_notified_${dateStr}`;
}

export function getNotifiedList(): string[] {
  try {
    const raw = localStorage.getItem(getTodayNotifiedKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markAsNotified(id: string): void {
  try {
    const key = getTodayNotifiedKey();
    const list = getNotifiedList();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    console.error("Error saving notified state:", e);
  }
}

export function clearNotified(id: string): void {
  try {
    const key = getTodayNotifiedKey();
    const list = getNotifiedList().filter((k) => !k.startsWith(id));
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error("Error clearing notified state:", e);
  }
}

// بررسی وضعیت پشتیبانی و دسترسی اعلان در مرورگر یا اندروید بومی
export function checkNotificationSupport(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (Capacitor.isNativePlatform()) return "granted";
  if (!checkNotificationSupport()) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

// درخواست مجوز اعلان از کاربر
export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      return res.display === "granted";
    } catch {
      return false;
    }
  }
  if (!checkNotificationSupport()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return false;
  }
}

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }
  if (sharedAudioContext && sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

// باز کردن قفل سشن صوتی مرورگر موبایل با اولین لمس کاربر
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("click", unlockAudio, { once: true });
  window.addEventListener("touchstart", unlockAudio, { once: true });
}

// پخش صدای زنگ واقعی از فایل‌های صوتی استاندارد با قابلیت پخش فایل سفارشی کاربر
export async function playNotificationTone(soundId: string = "hygiene"): Promise<void> {
  try {
    let src = `/sounds/${soundId}.mp3`;
    if (soundId.startsWith("custom:")) {
      const stored = await AudioStorageService.getAudio(soundId);
      if (stored) {
        src = stored;
      }
    } else if (soundId.startsWith("data:") || soundId.startsWith("blob:") || soundId.startsWith("http")) {
      src = soundId;
    }

    const audio = new Audio(src);
    audio.volume = 1.0;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        playSynthesizedFallback(soundId);
      });
    }
  } catch {
    playSynthesizedFallback(soundId);
  }
}

function playSynthesizedFallback(soundId: string = "hygiene"): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      startTime: number,
      duration: number,
      type: OscillatorType = "sine",
      peakGain: number = 0.35
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const playWaterBubble = (startF: number, endF: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(startF, startTime);
      osc.frequency.exponentialRampToValueAtTime(endF, startTime + duration);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    switch (soundId) {
      case "prayer":
        playTone(432, now, 1.4, "sine", 0.4);
        playTone(864, now + 0.05, 1.2, "sine", 0.2);
        break;
      case "study":
        // زنگ برنجی میز مطالعه (دینگ شفاف با هارمونیک‌های غنی و طنین کشیده)
        playTone(523.25, now, 1.6, "sine", 0.25);
        playTone(1046.5, now, 1.8, "triangle", 0.5);
        playTone(1244.5, now, 0.9, "sine", 0.2);
        playTone(2093.0, now, 0.7, "sine", 0.25);
        break;
      case "workout":
        // بیت پرانرژی باشگاه و تمرین ورزشی (کیک + آکوردهای الکترونیک سینت‌سایزر)
        playTone(65, now, 0.22, "sine", 0.6);
        playTone(220, now, 0.2, "sawtooth", 0.35);
        playTone(330, now, 0.2, "sawtooth", 0.25);

        playTone(65, now + 0.3, 0.22, "sine", 0.6);
        playTone(261.63, now + 0.3, 0.18, "sawtooth", 0.35);

        playTone(65, now + 0.6, 0.25, "sine", 0.65);
        playTone(440, now + 0.6, 0.4, "sawtooth", 0.45);
        playTone(660, now + 0.6, 0.35, "triangle", 0.3);
        break;
      case "water":
        // صدای شر شر و قل‌قل پیوسته و زلال آب
        playWaterBubble(380, 680, now, 0.10);
        playWaterBubble(420, 750, now + 0.16, 0.10);
        playWaterBubble(350, 650, now + 0.32, 0.11);
        playWaterBubble(480, 850, now + 0.48, 0.09);
        playWaterBubble(400, 720, now + 0.64, 0.10);
        playWaterBubble(450, 800, now + 0.80, 0.10);
        break;
      case "urgent":
        // آژیر خطر اضطراری و استرس‌آور (پالس‌های دیزونانت سریع و هشداردهنده)
        for (let p = 0; p < 4; p++) {
          const tP = now + p * 0.24;
          playTone(950, tP, 0.16, "sawtooth", 0.45);
          playTone(1015, tP, 0.16, "sawtooth", 0.45);
          playTone(2800, tP, 0.16, "sine", 0.2);
        }
        break;
      case "hygiene":
      default:
        // آبشار کریستالی گلکن‌اشپیل شفاف صبحگاهی
        playTone(1318.51, now, 0.4, "sine", 0.3);
        playTone(1661.22, now + 0.11, 0.4, "sine", 0.32);
        playTone(1975.53, now + 0.22, 0.45, "sine", 0.35);
        playTone(2637.02, now + 0.33, 0.8, "triangle", 0.45);
        break;
    }
  } catch (e) {}
}

// متد ارسال اعلان (سازگار با حالت بومی اندروید، آفلاین ملی و آنلاین)
export async function dispatchNotification(payload: NotificationPayload): Promise<boolean> {
  // اگر در محیط بومی اندروید (APK) باشیم، مستقیماً از سیستم بومی سیستم‌عامل استفاده می‌شود
  if (Capacitor.isNativePlatform()) {
    try {
      await setupAndroidNotificationChannels();
      const soundId = (payload.sound || "hygiene").replace(/\.(wav|mp3)$/i, "");
      const channelId = getChannelIdForSound(soundId);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: payload.title,
            body: payload.body,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
            sound: `${soundId}.mp3`,
            channelId: channelId,
            extra: { url: payload.url || "/" }
          }
        ]
      });
      // پخش صدای کمکی همزمان
      playNotificationTone(payload.sound || "hygiene");
      return true;
    } catch (capErr) {
      console.warn("Capacitor LocalNotification failed, falling back to web:", capErr);
    }
  }

  if (!checkNotificationSupport() || Notification.permission !== "granted") {
    return false;
  }

  // پخش صدای زنگ متناسب با عادت
  playNotificationTone(payload.sound || "hygiene");

  const vibratePattern = payload.vibrate ?? [120, 80, 150];

  // لرزش گوشی اندروید با الگوی انتخابی
  if (typeof navigator !== "undefined" && navigator.vibrate && vibratePattern.length > 0) {
    try {
      navigator.vibrate(vibratePattern);
    } catch {}
  }

  // اولویت ۱: ارسال از طریق سرویس‌ورکر (حتی در پس‌زمینه و حالت استندبای آفلاین کار می‌کند)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          vibrate: vibratePattern,
          tag: payload.tag || "focusflow-reminder",
          renotify: true,
          requireInteraction: true,
          silent: false,
          data: { url: payload.url || "/" }
        } as any);
        return true;
      }
    } catch (swErr) {
      console.warn("ServiceWorker showNotification failed, trying fallback Notification API:", swErr);
    }
  }

  // اولویت ۲: استفاده از Notification API معمولی در کلاینت
  try {
    new Notification(payload.title, {
      body: payload.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.tag || "focusflow-reminder"
    });
    return true;
  } catch (err) {
    console.error("Direct Notification API failed:", err);
    return false;
  }
}

// ساختار داده برای بررسی زمان‌بندی یادآورها
export interface ReminderItem {
  id: string;
  type: "habit" | "task";
  title: string;
  time: string; // HH:mm format
  daysOfWeek?: number[]; // 0 for Sunday, 6 for Saturday
  sound?: string;
  vibration?: string;
}

// بررسی هوشمند آیتم‌های دارای یادآور با ساعت فعلی سیستم و مکانیزم جبرانی خواب عمیق گوشی
export function evaluateReminders(items: ReminderItem[]): void {
  if (getNotificationPermission() !== "granted") return;

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const currentDay = now.getDay(); // 0-6

  const notifiedList = getNotifiedList();

  for (const item of items) {
    if (!item.time) continue;

    // بررسی روز هفته در صورت مشخص بودن
    if (item.daysOfWeek && item.daysOfWeek.length > 0 && !item.daysOfWeek.includes(currentDay)) {
      continue;
    }

    const [itemHStr, itemMStr] = item.time.split(":");
    const itemH = parseInt(itemHStr, 10);
    const itemM = parseInt(itemMStr, 10);
    if (isNaN(itemH) || isNaN(itemM)) continue;
    const itemTotalMinutes = itemH * 60 + itemM;

    // اگر زمان یادآور هنوز فرا نرسیده است، صرف‌نظر شود
    if (currentTotalMinutes < itemTotalMinutes) {
      continue;
    }

    // پنجره مجاز جبرانی (برای زمان‌هایی که گوشی در خواب عمیق یا صفحه خاموش بوده است):
    // تا ۳ ساعت (۱۸۰ دقیقه) پس از زمان تعیین شده، در اولین فرصتی که گوشی بیدار می‌شود اعلان فعال می‌گردد
    const delayMinutes = currentTotalMinutes - itemTotalMinutes;
    if (delayMinutes > 180) {
      continue;
    }

    // کلید یکتا برای بررسی ارسال امروز: ID_TIME
    const itemKey = `${item.id}_${item.time}`;
    if (notifiedList.includes(itemKey)) {
      continue;
    }

    // الگوهای صوتی و لرزشی اختصاصی
    const vibratePattern = getVibrationPattern(item.vibration);
    const title = "یادآوری عادت روزانه";
    const body = delayMinutes > 1
      ? `زمان انجام: ${item.title} (با اندکی تاخیر به دلیل بهینه‌سازی باتری سیستم‌عامل)`
      : `زمان انجام: ${item.title}`;

    // dispatchNotification خود به صورت متمرکز صدا و ویبره را یک‌بار پخش می‌کند
    dispatchNotification({
      title,
      body,
      tag: `reminder_${item.id}`,
      url: "/",
      sound: item.sound,
      vibrate: vibratePattern,
    });

    markAsNotified(itemKey);
  }
}

// تابع دوره‌ای اجرای بررسی یادآورها با خواندن از دیتابیس کلاینت
export function runActiveRemindersCheck(): void {
  try {
    const today = getGregorianToday();
    // فقط عادت‌هایی که یادآور فعال دارند و امروز هنوز انجام نشده‌اند بررسی می‌شوند
    const habits = HabitStore.list().filter(
      (h) => h.reminder_enabled && h.reminder_time && (!h.completed_dates || !h.completed_dates.includes(today))
    );

    const items: ReminderItem[] = habits.map((h) => ({
      id: h.id,
      type: "habit" as const,
      title: h.name,
      time: h.reminder_time!,
      daysOfWeek: h.reminder_days,
      sound: h.reminder_custom_sound || h.reminder_sound || "hygiene",
      vibration: h.reminder_vibration,
    }));

    const activeTasks = TaskStore.list().filter(
      (t) => t.reminder_enabled && t.reminder_time && t.status !== "done" && (!t.scheduled_date || t.scheduled_date === today)
    );

    const taskItems: ReminderItem[] = activeTasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      time: t.reminder_time!,
      sound: "work",
      vibration: "urgent"
    }));

    const allItems = [...items, ...taskItems];
    if (allItems.length > 0) {
      evaluateReminders(allItems);
    }
  } catch (err) {
    // نادیده گرفتن خطاها در زمان بارگذاری اولیه استور
  }
}

export const SOUND_CHANNEL_IDS: Record<string, string> = {
  hygiene: "focusflow_sound_hygiene",
  prayer: "focusflow_sound_prayer",
  study: "focusflow_sound_study",
  workout: "focusflow_sound_workout",
  water: "focusflow_sound_water",
  sleep: "focusflow_sound_sleep",
  work: "focusflow_sound_work",
  urgent: "focusflow_sound_urgent",
};

export function getChannelIdForSound(soundId?: string): string {
  if (!soundId) return "focusflow_sound_hygiene";
  const clean = soundId.replace(/\.(wav|mp3)$/i, "");
  return SOUND_CHANNEL_IDS[clean] || "focusflow_sound_hygiene";
}

// ایجاد کانال‌های اعلان با بالاترین اولویت و متصل به فایل‌های صوتی بومی res/raw
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    for (const preset of SOUND_PRESETS) {
      const channelId = getChannelIdForSound(preset.id);
      await LocalNotifications.createChannel({
        id: channelId,
        name: `یادآور: ${preset.name}`,
        description: `کانال هشدار بیدارباش با صدای ${preset.name}`,
        importance: 5, // IMPORTANCE_HIGH (5)
        visibility: 1, // VISIBILITY_PUBLIC (1)
        sound: `${preset.id}.mp3`, // ارجاع به فایل android/app/src/main/res/raw/<preset.id>.mp3
        vibration: true,
        lights: true,
        lightColor: "#488AFF"
      });
    }
  } catch (err) {
    console.warn("Could not create Android notification channels:", err);
  }
}

// بررسی وضعیت مجوز آلارم‌های دقیق در اندروید ۱۲ به بالا
export async function checkExactAlarmPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await (LocalNotifications as any).checkExactNotificationSetting?.();
    return res?.exact_alarm === "granted";
  } catch {
    return true;
  }
}

// هدایت کاربر به صفحه تنظیمات مجوز آلارم دقیق در اندروید
export async function requestExactAlarmPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await (LocalNotifications as any).changeExactNotificationSetting?.();
  } catch (err) {
    console.warn("Could not open exact alarm setting:", err);
  }
}

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

let isSyncingAlarms = false;

// پیش‌زمان‌بندی تمام عادت‌ها در آلارم منیجر اندروید (مشابه اذان‌گوها)
// این متد باعث می‌شود حتی اگر برنامه کلاً از بخش برنامه‌های اخیر کشیده و بسته شود، سیستم‌عامل در ثانیه مقرر زنگ بزند
export async function syncScheduledHabitAlarms(): Promise<void> {
  if (!Capacitor.isNativePlatform() || isSyncingAlarms) return;
  isSyncingAlarms = true;

  try {
    await setupAndroidNotificationChannels();

    const habits = HabitStore.list().filter(
      (h) => h.reminder_enabled && h.reminder_time
    );

    const now = new Date();
    const notificationsToSchedule: any[] = [];

    // زمان‌بندی برای ۷ روز آینده در تقویم سیستم‌عامل اندروید
    for (const habit of habits) {
      const [hStr, mStr] = (habit.reminder_time || "").split(":");
      const hours = parseInt(hStr, 10);
      const minutes = parseInt(mStr, 10);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const baseId = (hashStringToInt(habit.id) % 100000) * 10;

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(now.getDate() + dayOffset);
        targetDate.setHours(hours, minutes, 0, 0);

        // اگر زمان امروز رد شده است، برای امروز زمان‌بندی نکنیم
        if (targetDate.getTime() <= now.getTime() + 45 * 1000) {
          continue;
        }

        const dayOfWeek = targetDate.getDay(); // 0 for Sunday ... 6 for Saturday
        if (habit.reminder_days && habit.reminder_days.length > 0 && !habit.reminder_days.includes(dayOfWeek)) {
          continue;
        }

        const soundBase = (habit.reminder_sound || "hygiene").replace(/\.(wav|mp3)$/i, "");
        const soundChannel = getChannelIdForSound(soundBase);

        notificationsToSchedule.push({
          id: baseId + dayOffset,
          title: `یادآوری عادت: ${habit.name}`,
          body: `زمان انجام عادت: ${habit.name}`,
          schedule: {
            at: targetDate,
            allowWhileIdle: true
          },
          channelId: soundChannel,
          sound: `${soundBase}.mp3`,
          extra: {
            habitId: habit.id,
            targetDate: targetDate.toISOString()
          }
        });
      }
    }

    // پیش‌زمان‌بندی تسک‌های فعال در آلارم منیجر اندروید
    const activeTasks = TaskStore.list().filter(
      (t) => t.reminder_enabled && t.reminder_time && t.status !== "done"
    );

    for (const task of activeTasks) {
      const [hStr, mStr] = (task.reminder_time || "").split(":");
      const hours = parseInt(hStr, 10);
      const minutes = parseInt(mStr, 10);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const baseId = 500000 + (hashStringToInt(task.id) % 400000);
      const targetDate = new Date();

      if (task.scheduled_date) {
        const [sy, sm, sd] = task.scheduled_date.split("-").map(Number);
        if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd)) {
          targetDate.setFullYear(sy, sm - 1, sd);
        }
      }
      targetDate.setHours(hours, minutes, 0, 0);

      // اگر زمان گذشته باشد، صرف نظر شود
      if (targetDate.getTime() <= now.getTime() + 45 * 1000) {
        continue;
      }

      const taskSoundBase = "work";
      const taskSoundChannel = getChannelIdForSound(taskSoundBase);

      notificationsToSchedule.push({
        id: baseId,
        title: `یادآوری تسک: ${task.title}`,
        body: `زمان انجام تسک: ${task.title}`,
        schedule: {
          at: targetDate,
          allowWhileIdle: true
        },
        channelId: taskSoundChannel,
        sound: `${taskSoundBase}.mp3`,
        extra: {
          taskId: task.id,
          targetDate: targetDate.toISOString()
        }
      });
    }

    if (notificationsToSchedule.length > 0) {
      // لغو هشدارهای قبلی برای جلوگیری از تکرار
      const existing = await LocalNotifications.getPending();
      if (existing && existing.notifications && existing.notifications.length > 0) {
        const idsToCancel = existing.notifications
          .map((n) => n.id)
          .filter((id) => id < 999000);
        if (idsToCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: idsToCancel.map((id) => ({ id })) });
        }
      }

      await LocalNotifications.schedule({
        notifications: notificationsToSchedule
      });
    }
  } catch (err) {
    console.error("Error scheduling habit alarms to Android AlarmManager:", err);
  } finally {
    isSyncingAlarms = false;
  }
}

// تست بیدارباش ۵ ثانیه‌ای برای اطمینان از عملکرد سیستم آلارم در حالت قفل صفحه
export async function testWakeupAlarm(seconds: number = 5): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    setTimeout(() => {
      dispatchNotification({
        title: "تست یادآور بیدارباش FocusFlow",
        body: "این یک اعلان آزمایشی بیدارباش است.",
        sound: "hygiene"
      });
    }, seconds * 1000);
    return true;
  }

  try {
    await setupAndroidNotificationChannels();
    const testId = 999999;
    const at = new Date(Date.now() + seconds * 1000);
    const testSoundBase = "hygiene";
    const testChannel = getChannelIdForSound(testSoundBase);

    await LocalNotifications.cancel({ notifications: [{ id: testId }] }).catch(() => {});
    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title: "تست زنگ و بیدارباش FocusFlow",
          body: "عالی! سیستم آلارم حتی در حالت صفحه خاموش و بسته بودن برنامه فعال است.",
          schedule: {
            at,
            allowWhileIdle: true
          },
          channelId: testChannel,
          sound: `${testSoundBase}.mp3`,
          extra: { test: true }
        }
      ]
    });
    return true;
  } catch (err) {
    console.error("Failed to schedule test wakeup alarm:", err);
    return false;
  }
}

// راه‌اندازی تایمر بررسی منظم در کلاینت با لیسنرهای چندگانه بیداری صفحه و فوکوس
export function startReminderScheduler(): () => void {
  // ۱. تنظیم کانال‌ها و همگام‌سازی اولیه آلارم‌های اندروید
  setupAndroidNotificationChannels();
  syncScheduledHabitAlarms();
  runActiveRemindersCheck();

  const intervalId = setInterval(() => {
    runActiveRemindersCheck();
  }, 15 * 1000);

  const handleWake = () => {
    runActiveRemindersCheck();
    syncScheduledHabitAlarms();
  };

  const handleDataChanged = () => {
    syncScheduledHabitAlarms();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("focus", handleWake);
    window.addEventListener("pageshow", handleWake);
    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focusflow-data-changed", handleDataChanged);
    window.addEventListener("focusflow-db-synced", handleDataChanged);
  }

  return () => {
    clearInterval(intervalId);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("pageshow", handleWake);
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focusflow-data-changed", handleDataChanged);
      window.removeEventListener("focusflow-db-synced", handleDataChanged);
    }
  };
}
