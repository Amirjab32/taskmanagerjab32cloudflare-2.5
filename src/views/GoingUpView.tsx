import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, BellRing, History, ShieldCheck, ShieldAlert, Square, Info, Flame, Trash2 } from "lucide-react";
import { HabitStore, calculateHabitStreak } from "@/lib/store";
import { getGregorianToday, toShamsiShort, toPersianDigits } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

// --- Types ---
export interface GoingUpSettings {
  ropeMaxTimeMinutes: number;         // default: 5
  ropeIgnoreThresholdMinutes: number; // default: 2
  ropeCooldownMinutes: number;        // default: 25
  noRopeAllowedChances: number;       // default: 3
  noRopeMaxTimeMinutes: number;       // default: 30
  autoTickTime: string;               // default: "23:30"
  ropeAllowedChances: number;         // default: 0 (unlimited)
}

export interface GoingUpHistory {
  violated: boolean;
  noRopeChancesUsed: number;
  ropeChancesUsed?: number;
}

export interface GoingUpSessionLog {
  id: string;
  date: string;         // "YYYY-MM-DD"
  time: string;         // "HH:MM" e.g. "14:25"
  mode: "rope" | "no_rope";
  durationSeconds: number; // duration in seconds
  isViolated: boolean;  // whether it breached rules
}

export interface GoingUpState {
  activeMode: "rope" | "no_rope" | null;
  startedAt: number | null;
  durationSeconds: number;
  cooldownUntil: number | null;
  noRopeChancesUsed: number;
  ropeChancesUsed: number;
  hasViolatedToday: boolean;
  lastDate: string; // "YYYY-MM-DD"
  history: Record<string, GoingUpHistory>;
  logs: GoingUpSessionLog[];
}

// --- Audio Synthesizer for Annoying Siren ---
class AnnoyingSiren {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private intervalId: any = null;

  warmUp() {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      // Play a quick 0.01s silent pulse to satisfy mobile browser autoplay permissions
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (err) {
      console.warn("AudioContext warmUp failed:", err);
    }
  }

  start() {
    if (this.osc1 || this.osc2) return; // already playing
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = "sawtooth";
      this.osc1.frequency.setValueAtTime(950, this.ctx.currentTime);
      this.osc1.connect(this.gainNode);

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = "square";
      this.osc2.frequency.setValueAtTime(480, this.ctx.currentTime);
      this.osc2.connect(this.gainNode);

      this.osc1.start();
      this.osc2.start();

      let high = false;
      this.intervalId = setInterval(() => {
        if (!this.ctx || !this.osc1 || !this.osc2) return;
        const now = this.ctx.currentTime;
        if (high) {
          this.osc1.frequency.setValueAtTime(1300, now);
          this.osc2.frequency.setValueAtTime(350, now);
        } else {
          this.osc1.frequency.setValueAtTime(700, now);
          this.osc2.frequency.setValueAtTime(800, now);
        }
        high = !high;
      }, 130);
    } catch (err) {
      console.error("Web Audio API failed", err);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    try {
      if (this.osc1) {
        this.osc1.stop();
        this.osc1.disconnect();
        this.osc1 = null;
      }
      if (this.osc2) {
        this.osc2.stop();
        this.osc2.disconnect();
        this.osc2 = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      // Suspend context instead of closing to save resources and keep it unlocked
      if (this.ctx && this.ctx.state === "running") {
        this.ctx.suspend();
      }
    } catch (err) {
      console.error("Stop sound error", err);
    }
  }
}

const alarm = new AnnoyingSiren();

// --- Default Consts ---
const DEFAULT_SETTINGS: GoingUpSettings = {
  ropeMaxTimeMinutes: 5,
  ropeIgnoreThresholdMinutes: 2,
  ropeCooldownMinutes: 25,
  noRopeAllowedChances: 3,
  noRopeMaxTimeMinutes: 30,
  autoTickTime: "23:30",
  ropeAllowedChances: 0,
};

const DEFAULT_STATE: GoingUpState = {
  activeMode: null,
  startedAt: null,
  durationSeconds: 0,
  cooldownUntil: null,
  noRopeChancesUsed: 0,
  ropeChancesUsed: 0,
  hasViolatedToday: false,
  lastDate: "",
  history: {},
  logs: [],
};

export default function GoingUpView() {
  const { fg, fgMuted, cardBg, cardBorder } = useThemeStyles();

  // Load Settings
  const [settings, setSettings] = useState<GoingUpSettings>(() => {
    const raw = localStorage.getItem("focusflow_going_up_settings");
    if (raw) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Load State
  const [state, setState] = useState<GoingUpState>(() => {
    const raw = localStorage.getItem("focusflow_going_up_state");
    const today = getGregorianToday();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Handle day change reset
        if (parsed.lastDate && parsed.lastDate !== today) {
          const history = parsed.history || {};
          history[parsed.lastDate] = {
            violated: parsed.hasViolatedToday,
            noRopeChancesUsed: parsed.noRopeChancesUsed,
            ropeChancesUsed: parsed.ropeChancesUsed || 0,
          };
          return {
            ...DEFAULT_STATE,
            history,
            lastDate: today,
            logs: parsed.logs || [],
          };
        }
        return { ...DEFAULT_STATE, ropeChancesUsed: 0, ...parsed, lastDate: today, logs: parsed.logs || [] };
      } catch {
        return { ...DEFAULT_STATE, lastDate: today, logs: [] };
      }
    }
    return { ...DEFAULT_STATE, lastDate: today, logs: [] };
  });

  // Local/UI states
  const [showSettings, setShowSettings] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [activeCooldownLeft, setActiveCooldownLeft] = useState(0);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(30);
  const [isTestingAlarm, setIsTestingAlarm] = useState(false);

  // Form states for settings
  const [formSettings, setFormSettings] = useState<GoingUpSettings>({ ...settings });

  // Persistent State Saver
  const saveState = (updated: GoingUpState) => {
    setState(updated);
    localStorage.setItem("focusflow_going_up_state", JSON.stringify(updated));
  };

  const saveSettings = (updated: GoingUpSettings) => {
    setSettings(updated);
    localStorage.setItem("focusflow_going_up_settings", JSON.stringify(updated));
    setShowSettings(false);
  };

  // Cooldown & Active Timer Ticker
  useEffect(() => {
    let lastCheckedMinuteStr = "";

    const interval = setInterval(() => {
      const now = Date.now();
      const today = getGregorianToday();

      // Day boundary check
      if (state.lastDate !== today) {
        const history = { ...state.history };
        history[state.lastDate] = {
          violated: state.hasViolatedToday,
          noRopeChancesUsed: state.noRopeChancesUsed,
          ropeChancesUsed: state.ropeChancesUsed || 0,
        };
        let updatedLogs = state.logs || [];
        if (state.activeMode && state.startedAt) {
          const elapsed = Math.floor((now - state.startedAt) / 1000);
          const timeStr = new Date(state.startedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
          const newLog: GoingUpSessionLog = {
            id: Math.random().toString(36).substr(2, 9),
            date: state.lastDate,
            time: timeStr,
            mode: state.activeMode,
            durationSeconds: elapsed,
            isViolated: state.hasViolatedToday,
          };
          updatedLogs = [newLog, ...updatedLogs];
        }
        const updated = {
          ...state,
          activeMode: null,
          startedAt: null,
          durationSeconds: 0,
          noRopeChancesUsed: 0,
          ropeChancesUsed: 0,
          hasViolatedToday: false,
          lastDate: today,
          history,
          logs: updatedLogs,
        };
        alarm.stop();
        setIsAlarmPlaying(false);
        saveState(updated);
        return;
      }

      // 1. Calculate active timer remaining
      if (state.activeMode && state.startedAt) {
        const elapsedSeconds = Math.floor((now - state.startedAt) / 1000);
        const rem = Math.max(0, state.durationSeconds - elapsedSeconds);
        setTimeRemaining(rem);

        // Sound alarm if hits 0
        if (rem === 0) {
          if (!isAlarmPlaying) {
            alarm.start();
            setIsAlarmPlaying(true);
          }
          
          // 30 seconds countdown grace period when alarm is playing
          const alarmSeconds = elapsedSeconds - state.durationSeconds;
          const graceLeft = Math.max(0, 30 - alarmSeconds);
          setGraceSecondsLeft(graceLeft);

          if (alarmSeconds > 30 && !state.hasViolatedToday) {
            saveState({
              ...state,
              hasViolatedToday: true,
            });
          }
        } else {
          setGraceSecondsLeft(30);
        }
      } else {
        setTimeRemaining(0);
        setGraceSecondsLeft(30);
      }

      // 2. Calculate remaining rope cooldown
      if (state.cooldownUntil && state.cooldownUntil > now) {
        setActiveCooldownLeft(Math.ceil((state.cooldownUntil - now) / 1000));
      } else {
        setActiveCooldownLeft(0);
      }

      // 3. Automatically evaluate auto-tick criteria (Optimized to run once per minute)
      const nowObj = new Date();
      const currentMinuteStr = `${nowObj.getFullYear()}-${nowObj.getMonth()}-${nowObj.getDate()}-${nowObj.getHours()}:${nowObj.getMinutes()}`;
      if (currentMinuteStr !== lastCheckedMinuteStr) {
        evaluateTickJob();
        lastCheckedMinuteStr = currentMinuteStr;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [state, isAlarmPlaying, settings]);

  // Handle manual alarm triggers & sync sound
  useEffect(() => {
    return () => {
      alarm.stop();
    };
  }, []);

  // Evaluation criteria
  const evaluateTickJob = () => {
    const today = getGregorianToday();
    const history = state.history || {};

    const [targetH, targetM] = settings.autoTickTime.split(":").map(Number);
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const todayPassedTickTime = currentH > targetH || (currentH === targetH && currentM >= targetM);

    const habits = HabitStore.list();
    const targetHabit = habits.find((h) => h.id === "system-habit-stay-in-study");
    if (!targetHabit) return;

    const completedDates = [...(targetHabit.completed_dates || [])];
    let changed = false;

    const evaluatedDaysRaw = localStorage.getItem("focusflow_going_up_evaluated_days");
    const evaluatedDays: string[] = evaluatedDaysRaw ? JSON.parse(evaluatedDaysRaw) : [];

    // Evaluate old archive history
    Object.keys(history).forEach((dateStr) => {
      if (dateStr < today && !evaluatedDays.includes(dateStr)) {
        const dayData = history[dateStr];
        if (!dayData.violated) {
          if (!completedDates.includes(dateStr)) {
            completedDates.push(dateStr);
            changed = true;
          }
        } else {
          if (completedDates.includes(dateStr)) {
            const idx = completedDates.indexOf(dateStr);
            completedDates.splice(idx, 1);
            changed = true;
          }
        }
        evaluatedDays.push(dateStr);
      }
    });

    // Evaluate today if it crossed 11:30 PM (or configured time)
    if (todayPassedTickTime && !evaluatedDays.includes(today)) {
      const violated = state.hasViolatedToday;
      if (!violated) {
        if (!completedDates.includes(today)) {
          completedDates.push(today);
          changed = true;
        }
      } else {
        if (completedDates.includes(today)) {
          const idx = completedDates.indexOf(today);
          completedDates.splice(idx, 1);
          changed = true;
        }
      }
      evaluatedDays.push(today);
    } else if (!todayPassedTickTime && evaluatedDays.includes(today)) {
      // Re-enable evaluation if time is adjusted backwards or day resets
      const idx = evaluatedDays.indexOf(today);
      if (idx !== -1) {
        evaluatedDays.splice(idx, 1);
      }
    }

    // CRITICAL late-night violation check: if they violated today, untick target habit immediately!
    if (state.hasViolatedToday && completedDates.includes(today)) {
      const idx = completedDates.indexOf(today);
      completedDates.splice(idx, 1);
      changed = true;
      if (!evaluatedDays.includes(today)) {
        evaluatedDays.push(today);
      }
    }

    if (changed) {
      const { streakCount, lastCompletedDate } = calculateHabitStreak(completedDates);
      HabitStore.update(targetHabit.id, {
        completed_dates: completedDates,
        streakCount,
        lastCompletedDate: lastCompletedDate || undefined,
      });
      window.dispatchEvent(new CustomEvent("focusflow-db-synced"));
    }

    localStorage.setItem("focusflow_going_up_evaluated_days", JSON.stringify(evaluatedDays));
  };

  // --- Handlers ---

  const handleStartRope = (forceBreak = false) => {
    const now = Date.now();
    let hasViolated = state.hasViolatedToday;

    // Check if cooldown is active
    if (state.cooldownUntil && state.cooldownUntil > now && !forceBreak) {
      return; // should not be accessible if button is locked, but just in case
    }

    if (state.cooldownUntil && state.cooldownUntil > now && forceBreak) {
      hasViolated = true; // explicitly violated wait limit!
    }

    const nextRopeChancesUsed = (state.ropeChancesUsed || 0) + 1;
    if (settings.ropeAllowedChances > 0 && nextRopeChancesUsed > settings.ropeAllowedChances) {
      hasViolated = true; // exceeded allowed rope chances limit!
    }

    const updated: GoingUpState = {
      ...state,
      activeMode: "rope",
      startedAt: now,
      durationSeconds: settings.ropeMaxTimeMinutes * 60,
      ropeChancesUsed: nextRopeChancesUsed,
      hasViolatedToday: hasViolated,
    };
    saveState(updated);
  };

  const handleStartNoRope = () => {
    const nextChancesUsed = state.noRopeChancesUsed + 1;
    const hasViolated = state.hasViolatedToday || nextChancesUsed > settings.noRopeAllowedChances;

    const updated: GoingUpState = {
      ...state,
      activeMode: "no_rope",
      startedAt: Date.now(),
      durationSeconds: settings.noRopeMaxTimeMinutes * 60,
      noRopeChancesUsed: nextChancesUsed,
      hasViolatedToday: hasViolated,
    };
    saveState(updated);
  };

  const handleStopAndReturn = () => {
    // Stop sound
    alarm.stop();
    setIsAlarmPlaying(false);

    const now = Date.now();
    let cooldownUntil = state.cooldownUntil;
    let isViolatedSession = false;

    // Check if they exceeded the 30-second alarm grace period
    if (state.startedAt && state.durationSeconds > 0) {
      const totalElapsed = Math.floor((now - state.startedAt) / 1000);
      if (totalElapsed > state.durationSeconds) {
        const alarmSeconds = totalElapsed - state.durationSeconds;
        if (alarmSeconds > 30) {
          isViolatedSession = true;
        }
      }
    }

    if (state.activeMode === "rope" && state.startedAt) {
      const elapsedSeconds = Math.floor((now - state.startedAt) / 1000);
      const thresholdSeconds = settings.ropeIgnoreThresholdMinutes * 60;

      // If they stayed up longer or equal to threshold limit, apply 25-minute wait
      if (elapsedSeconds >= thresholdSeconds) {
        cooldownUntil = now + settings.ropeCooldownMinutes * 60 * 1000;
      }

      // If they started during cooldown, it's a violation
      if (state.cooldownUntil && state.cooldownUntil > state.startedAt) {
        isViolatedSession = true;
      }

      // If they exceeded allowed rope chances, it's a violation
      if (settings.ropeAllowedChances > 0 && (state.ropeChancesUsed || 0) > settings.ropeAllowedChances) {
        isViolatedSession = true;
      }

      // If they stayed out longer than maximum allowed time + 30s grace, it's a violation
      if (elapsedSeconds > settings.ropeMaxTimeMinutes * 60 + 30) {
        isViolatedSession = true;
      }
    } else if (state.activeMode === "no_rope" && state.startedAt) {
      const elapsedSeconds = Math.floor((now - state.startedAt) / 1000);

      // If they stayed out longer than maximum allowed time + 30s grace, it's a violation
      if (elapsedSeconds > settings.noRopeMaxTimeMinutes * 60 + 30) {
        isViolatedSession = true;
      }

      if (state.noRopeChancesUsed > settings.noRopeAllowedChances) {
        isViolatedSession = true;
      }
    }

    const today = getGregorianToday();
    const timeStr = new Date(state.startedAt || now).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const elapsed = state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0;

    const newLog: GoingUpSessionLog = {
      id: Math.random().toString(36).substr(2, 9),
      date: today,
      time: timeStr,
      mode: state.activeMode || "rope",
      durationSeconds: elapsed,
      isViolated: isViolatedSession,
    };

    const updated: GoingUpState = {
      ...state,
      activeMode: null,
      startedAt: null,
      durationSeconds: 0,
      cooldownUntil,
      hasViolatedToday: state.hasViolatedToday || isViolatedSession,
      logs: [newLog, ...(state.logs || [])],
    };
    saveState(updated);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // UI styling helpers
  const isTimerRunning = state.activeMode !== null;
  const noRopeChancesRemaining = Math.max(0, settings.noRopeAllowedChances - state.noRopeChancesUsed);

  return (
    <div className="mx-auto max-w-2xl space-y-5" onClick={() => alarm.warmUp()} onTouchStart={() => alarm.warmUp()}>
      {/* Top Header Card */}
      <div className="relative rounded-3xl p-6 overflow-hidden border transition-all"
        style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        
        {/* Settings Gear & Alarm Tester */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              alarm.warmUp();
              if (isTestingAlarm) {
                alarm.stop();
                setIsTestingAlarm(false);
              } else {
                alarm.start();
                setIsTestingAlarm(true);
                // Stop after 3 seconds automatically to prevent annoyance
                setTimeout(() => {
                  alarm.stop();
                  setIsTestingAlarm(false);
                }, 3000);
              }
            }}
            className={`rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isTestingAlarm 
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse" 
                : "bg-white/5 text-gray-400 hover:bg-indigo-500/10 hover:text-indigo-400 border border-transparent"
            }`}
            title="تست صدای آلارم">
            <BellRing className={`h-3.5 w-3.5 ${isTestingAlarm ? "animate-bounce" : ""}`} />
            {isTestingAlarm ? "قطع تست" : "تست صدای آلارم"}
          </button>

          <button onClick={(e) => { e.stopPropagation(); alarm.warmUp(); setFormSettings({ ...settings }); setShowSettings(true); }}
            className="rounded-xl p-2.5 transition-all hover:bg-white/5 text-gray-400 hover:text-indigo-400 cursor-pointer">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center space-y-3 mt-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Flame className="h-6 w-6 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: fg }}>بخش بالا رفتن</h1>
          <p className="text-sm max-w-md" style={{ color: fgMuted }}>
            مدیریت هوشمند خروج از محیط درس و ردیابی پایبندی به قوانین تمرکز.
          </p>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-dashed" style={{ borderColor: cardBorder }}>
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 py-3 px-2">
            {state.hasViolatedToday ? (
              <>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  <div className="text-right">
                    <div className="text-[10px]" style={{ color: fgMuted }}>پایبندی امروز</div>
                    <div className="text-xs font-bold text-rose-500">نقض شده 🔴</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alarm.warmUp();
                    const updated = {
                      ...state,
                      hasViolatedToday: false,
                    };
                    saveState(updated);
                    // Reset evaluated days to trigger re-evaluation
                    localStorage.removeItem("focusflow_going_up_evaluated_days");
                    // Force refresh target habit state
                    setTimeout(() => {
                      evaluateTickJob();
                    }, 100);
                  }}
                  className="text-[9px] px-2 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold border border-rose-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                  title="پاک کردن خطا و بازنشانی وضعیت امروز به حالت معتبر">
                  حذف جریمه امروز (جهت تست)
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <div className="text-right">
                  <div className="text-[10px]" style={{ color: fgMuted }}>پایبندی امروز</div>
                  <div className="text-xs font-bold text-emerald-500">معتبر 🟢</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-center rounded-2xl bg-white/5 py-3">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <div className="text-right">
              <div className="text-[10px]" style={{ color: fgMuted }}>ثبت خودکار عادت</div>
              <div className="text-xs font-bold" style={{ color: fg }}>ساعت {toPersianDigits(settings.autoTickTime)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Interaction Board */}
      <AnimatePresence mode="wait">
        {!isTimerRunning ? (
          <motion.div key="choice-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-3xl p-8 border space-y-6 text-center"
            style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            
            <div className="space-y-2">
              <h3 className="text-base font-semibold" style={{ color: fg }}>آیا طناب به پایت بسته است؟</h3>
              <p className="text-xs" style={{ color: fgMuted }}>
                یکی از گزینه‌ها را برای شروع خودکار تایمر بالا رفتن انتخاب کنید.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option Yes (Rope Tied) */}
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => handleStartRope(false)}
                  disabled={activeCooldownLeft > 0}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all text-center group cursor-pointer ${
                    activeCooldownLeft > 0 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover:border-indigo-500 hover:bg-indigo-500/5"
                  }`}
                  style={{ border: `1px solid ${cardBorder}` }}>
                  <span className="text-sm font-bold text-indigo-400 group-hover:scale-105 transition-transform">بله، طناب بسته‌ام 🔗</span>
                  <span className="text-[10px] mt-1" style={{ color: fgMuted }}>
                    {settings.ropeAllowedChances > 0 
                      ? `شانس باقیمانده امروز: ${toPersianDigits(Math.max(0, settings.ropeAllowedChances - (state.ropeChancesUsed || 0)))} از ${toPersianDigits(settings.ropeAllowedChances)}`
                      : `خروج موقت و کوتاه (حداکثر ${toPersianDigits(settings.ropeMaxTimeMinutes)} دقیقه)`}
                  </span>
                </button>

                {/* Rope chances exhausted warning */}
                {settings.ropeAllowedChances > 0 && (state.ropeChancesUsed || 0) >= settings.ropeAllowedChances && (
                  <div className="rounded-xl p-2 bg-amber-500/5 border border-amber-500/10 text-center">
                    <p className="text-[10px] text-amber-500 font-medium">
                      ⚠️ شانس‌های طناب شما تمام شده! خروج بعدی با طناب باعث جریمه و نقض قانون خواهد شد.
                    </p>
                  </div>
                )}

                {/* Cooldown Block and Override Force Button */}
                {activeCooldownLeft > 0 && (
                  <div className="rounded-xl p-3 bg-rose-500/5 border border-rose-500/10 text-center space-y-2">
                    <p className="text-[10px] text-rose-400 font-medium">
                      دوره انتظار فعال: {toPersianDigits(formatTime(activeCooldownLeft))} مانده
                    </p>
                    <button 
                      onClick={() => handleStartRope(true)}
                      className="w-full py-1.5 rounded-lg bg-rose-500 text-white text-[10px] font-bold hover:bg-rose-600 transition-all cursor-pointer">
                      شکستن محدودیت و خروج اضطراری (نقض قانون)
                    </button>
                  </div>
                )}
              </div>

              {/* Option No (Rope Untied) */}
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleStartNoRope}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border transition-all text-center group cursor-pointer hover:border-amber-500 hover:bg-amber-500/5"
                  style={{ border: `1px solid ${cardBorder}` }}>
                  <span className="text-sm font-bold text-amber-500 group-hover:scale-105 transition-transform">خیر، طناب باز است 🔓</span>
                  <span className="text-[10px] mt-1" style={{ color: fgMuted }}>شانس باقیمانده امروز: {toPersianDigits(noRopeChancesRemaining)} از {toPersianDigits(settings.noRopeAllowedChances)}</span>
                </button>

                {state.noRopeChancesUsed >= settings.noRopeAllowedChances && (
                  <div className="rounded-xl p-2 bg-amber-500/5 border border-amber-500/10 text-center">
                    <p className="text-[10px] text-amber-500 font-medium">
                      ⚠️ شانس‌های شما تمام شده! خروج بعدی باعث جریمه و نقض قانون خواهد شد.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="timer-panel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className={`rounded-3xl p-8 border text-center space-y-6 transition-colors duration-500 ${
              isAlarmPlaying ? "bg-rose-950/20 border-rose-500/30 animate-pulse" : ""
            }`}
            style={isAlarmPlaying ? {} : { border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            
            {/* Alarm Ringing Title */}
            {isAlarmPlaying ? (
              <div className="flex flex-col items-center space-y-3 text-rose-400">
                <BellRing className="h-12 w-12 text-rose-500 animate-bounce" />
                <h2 className="text-lg font-black animate-pulse">زنگ هشدار! زمان مجاز پایان یافت</h2>
                
                {graceSecondsLeft > 0 ? (
                  <div className="rounded-2xl px-5 py-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-bold animate-pulse max-w-md">
                    ⚠️ {toPersianDigits(graceSecondsLeft)} ثانیه فرصت دارید تا به محیط درس بازگردید و دکمه اعلام بازگشت را فشار دهید! در غیر این صورت تعهد امروز نقض خواهد شد.
                  </div>
                ) : (
                  <div className="rounded-2xl px-5 py-3 bg-red-500/20 border border-red-500/40 text-xs text-red-200 font-bold animate-bounce max-w-md">
                    🚨 مهلت ۳۰ ثانیه‌ای به پایان رسید! قانون امروز نقض شد و عادت «ماندن در محیط درس» امروز تیک نخواهد خورد.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/5 inline-block">
                  حالت: {state.activeMode === "rope" ? "طناب بسته 🔗" : "بدون طناب 🔓"}
                </span>
                <p className="text-xs pt-1" style={{ color: fgMuted }}>
                  تایمر شمارش معکوس به صورت بلادرنگ فعال است
                </p>
              </div>
            )}

            {/* Glowing Digital Clock */}
            <div className="py-6 flex justify-center">
              <div className={`text-6xl font-mono tracking-widest font-black transition-all duration-300 ${
                isAlarmPlaying ? "text-rose-500 scale-105 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "text-indigo-400"
              }`}>
                {toPersianDigits(formatTime(timeRemaining))}
              </div>
            </div>

            {/* Main Action Return Trigger */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleStopAndReturn}
                className={`w-full max-w-sm py-4 rounded-2xl text-sm font-bold text-white transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${
                  isAlarmPlaying 
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20" 
                    : "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20"
                }`}>
                <Square className="h-4 w-4 fill-current" />
                <span>اعلام بازگشت به محیط درس {isAlarmPlaying ? "و قطع آلارم" : ""}</span>
              </button>

              {state.activeMode === "rope" && (
                <p className="text-[10px]" style={{ color: fgMuted }}>
                  * بازگشت سریع‌تر از {toPersianDigits(settings.ropeIgnoreThresholdMinutes)} دقیقه، دوره انتظار ۲۵ دقیقه‌ای را فعال نمی‌کند.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Info & Guidelines panel */}
      <div className="rounded-2xl p-5 border space-y-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <div className="flex items-center gap-2 text-indigo-400 border-b border-dashed pb-2.5" style={{ borderColor: cardBorder }}>
          <Info className="h-4 w-4" />
          <h4 className="text-xs font-bold">راهنمای قوانین تعهد بالا رفتن</h4>
        </div>
        
        <ul className="space-y-2 text-xs" style={{ color: fgMuted }}>
          <li className="flex items-start gap-1.5">
            <span className="text-indigo-500">▪</span>
            <span>
              <strong>طناب بسته (بله):</strong>{" "}
              {settings.ropeAllowedChances > 0 
                ? `حداکثر ${toPersianDigits(settings.ropeAllowedChances)} بار خروج در روز (هر بار تا ${toPersianDigits(settings.ropeMaxTimeMinutes)} دقیقه). خروج‌های بعدی خارج از این شانس باعث نقض قانون تعهد خواهد شد.`
                : `برای خروج‌های اضطراری خیلی کوتاه (زیر ${toPersianDigits(settings.ropeIgnoreThresholdMinutes)} دقیقه جریمه ندارد. بیشتر از آن، ${toPersianDigits(settings.ropeCooldownMinutes)} دقیقه انتظار اجباری فعال می‌شود).`}
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-amber-500">▪</span>
            <span><strong>طناب باز (خیر):</strong> حداکثر ۳ بار خروج در روز (هر بار تا ۳۰ دقیقه). زدن دکمه بازگشت زودتر از ۳۰ دقیقه همچنان یک شانس کامل را می‌سوزاند.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-rose-500">▪</span>
            <span><strong>ساعت ارزیابی نهایی:</strong> راس ساعت {toPersianDigits(settings.autoTickTime)} شب، در صورت عدم ارتکاب تخلف، عادت «ماندن در محیط درس» تیک موفقیت خواهد خورد.</span>
          </li>
        </ul>
      </div>

      {/* History log block */}
      <div className="rounded-2xl border overflow-hidden" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: cardBorder }}>
          <div className="flex items-center gap-2" style={{ color: fg }}>
            <History className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold">تاریخچه روزهای اخیر بالا رفتن</span>
          </div>
        </div>

        {!state.logs || state.logs.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: fgMuted }}>
            هنوز هیچ بالا رفتنی در تاریخچه ثبت نشده است. خروج‌های شما با جزئیات کامل در اینجا ردیاب خواهند شد.
          </div>
        ) : (
          <div className="divide-y text-xs" style={{ borderColor: cardBorder }}>
            {state.logs.slice(0, 20).map((log) => {
              const formattedDuration = (() => {
                const totalSeconds = log.durationSeconds || 0;
                if (totalSeconds < 1) return "کمتر از ۱ ثانیه";
                const m = Math.floor(totalSeconds / 60);
                const s = totalSeconds % 60;
                let res = "";
                if (m > 0) res += `${toPersianDigits(m)} دقیقه`;
                if (s > 0) {
                  if (res) res += " و ";
                  res += `${toPersianDigits(s)} ثانیه`;
                }
                return res;
              })();

              return (
                <div key={log.id} className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-all">
                  <div className="flex flex-col gap-1.5 text-right">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: fg }}>
                        {log.mode === "rope" ? "طناب بسته 🔗" : "طناب آزاد 🔓"}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5" style={{ color: fgMuted }}>
                        {toShamsiShort(log.date)} - ساعت {toPersianDigits(log.time)}
                      </span>
                    </div>
                    <div className="text-[11px]" style={{ color: fgMuted }}>
                      مدت بالا بودن: <span className="font-semibold" style={{ color: fg }}>{formattedDuration}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {log.isViolated ? (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-400 font-bold text-[10px] tracking-tight">
                        نقض قانون 🔴
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 font-bold text-[10px] tracking-tight">
                        پایبندی معتبر 🟢
                      </span>
                    )}

                    <button
                      onClick={() => {
                        const filtered = (state.logs || []).filter((l) => l.id !== log.id);
                        saveState({ ...state, logs: filtered });
                      }}
                      className="text-gray-500 hover:text-rose-400 p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                      title="حذف این مورد">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings Modal (Dynamic Parameters) */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal Body */}
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border text-right space-y-6 z-10 max-h-[90vh] overflow-y-auto"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }}>
              
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: cardBorder }}>
                <h3 className="text-base font-bold">تنظیمات ماژول بالا رفتن</h3>
                <button onClick={() => setShowSettings(false)} className="text-xs px-3 py-1.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10">لغو</button>
              </div>

              <div className="space-y-4">
                {/* Rope tied limit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">حداکثر زمان مجاز خروج با طناب (دقیقه)</label>
                  <input type="number" min="1" max="60"
                    value={formSettings.ropeMaxTimeMinutes}
                    onChange={(e) => setFormSettings({ ...formSettings, ropeMaxTimeMinutes: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>

                {/* Rope threshold */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">مرز زمانی بی‌اثر بودن خروج با طناب (دقیقه)</label>
                  <input type="number" min="1" max="15"
                    value={formSettings.ropeIgnoreThresholdMinutes}
                    onChange={(e) => setFormSettings({ ...formSettings, ropeIgnoreThresholdMinutes: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>

                {/* Rope wait cooldown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">مدت زمان انتظار برای خروج مجدد با طناب (دقیقه)</label>
                  <input type="number" min="1" max="120"
                    value={formSettings.ropeCooldownMinutes}
                    onChange={(e) => setFormSettings({ ...formSettings, ropeCooldownMinutes: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>

                {/* Rope max chances */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">تعداد دفعات مجاز رفتن به بالا با طناب (۰ برای بدون محدودیت)</label>
                  <input type="number" min="0" max="50"
                    value={formSettings.ropeAllowedChances !== undefined ? formSettings.ropeAllowedChances : 0}
                    onChange={(e) => setFormSettings({ ...formSettings, ropeAllowedChances: Math.max(0, Number(e.target.value)) })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>

                {/* No rope max chances */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">تعداد شانس‌های مجاز خروج بدون طناب (بار)</label>
                  <input type="number" min="1" max="10"
                    value={formSettings.noRopeAllowedChances}
                    onChange={(e) => setFormSettings({ ...formSettings, noRopeAllowedChances: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>

                {/* No rope limit duration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">حداکثر زمان مجاز خروج بدون طناب (دقیقه)</label>
                  <input type="number" min="1" max="180"
                    value={formSettings.noRopeMaxTimeMinutes}
                    onChange={(e) => setFormSettings({ ...formSettings, noRopeMaxTimeMinutes: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>

                {/* Auto evaluate time */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">ساعت ثبت اتوماتیک تیک عادت در شب (HH:MM)</label>
                  <input type="time"
                    value={formSettings.autoTickTime}
                    onChange={(e) => setFormSettings({ ...formSettings, autoTickTime: e.target.value || "23:30" })}
                    className="w-full rounded-xl p-2.5 text-xs outline-none border"
                    style={{ border: `1px solid ${cardBorder}`, backgroundColor: "rgba(0,0,0,0.15)", color: fg }} />
                </div>
              </div>

              {/* Reset to defaults and save buttons */}
              <div className="flex gap-2.5 pt-4 border-t" style={{ borderColor: cardBorder }}>
                <button
                  onClick={() => setFormSettings({ ...DEFAULT_SETTINGS })}
                  className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium cursor-pointer">
                  بازنشانی پیش‌فرض‌ها
                </button>
                <button
                  onClick={() => saveSettings(formSettings)}
                  className="mr-auto px-5 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 text-xs font-bold cursor-pointer">
                  ذخیره تغییرات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
