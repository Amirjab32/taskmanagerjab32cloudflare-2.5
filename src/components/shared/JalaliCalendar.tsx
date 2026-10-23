import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MONTH_NAMES,
  daysInJalaliMonth,
  firstDayWeekday,
  jalaliToGregorian,
  toPersianDigits,
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

export interface DayMeta {
  gregDate: string;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
}

interface Props {
  jy: number;
  jm: number;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  todayGreg: string;
  selectedGreg?: string;
  renderDay: (day: number, meta: DayMeta) => React.ReactNode;
  onDayClick?: (day: number, meta: DayMeta) => void;
  onDragOver?: (e: React.DragEvent, day: number, meta: DayMeta) => void;
  onDragLeave?: (e: React.DragEvent, day: number, meta: DayMeta) => void;
  onDrop?: (e: React.DragEvent, day: number, meta: DayMeta) => void;
}

const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export default function JalaliCalendar({
  jy,
  jm,
  onPrev,
  onNext,
  canNext,
  todayGreg,
  selectedGreg,
  renderDay,
  onDayClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const { fg, fgMuted, cardBorder } = useThemeStyles();
  const totalDays = daysInJalaliMonth(jy, jm);
  const firstWeekday = firstDayWeekday(jy, jm);
  const cells: (number | null)[] = Array(42).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    cells[firstWeekday + d - 1] = d;
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
          title="ماه قبل"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="flex-1 select-none text-center text-sm font-semibold" style={{ color: fg }}>
          {MONTH_NAMES[jm - 1]} {toPersianDigits(jy)}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg disabled:opacity-30"
          style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
          title="ماه بعد"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium" style={{ color: fgMuted }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const gregDate = jalaliToGregorian(jy, jm, day);
          const meta: DayMeta = {
            gregDate,
            isToday: gregDate === todayGreg,
            isFuture: gregDate > todayGreg,
            isSelected: gregDate === selectedGreg,
          };
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick?.(day, meta)}
              onDragOver={(e) => onDragOver?.(e, day, meta)}
              onDragLeave={(e) => onDragLeave?.(e, day, meta)}
              onDrop={(e) => onDrop?.(e, day, meta)}
              className="aspect-square relative flex items-center justify-center rounded-lg text-xs font-medium transition-all"
              disabled={!onDayClick}
              style={{ cursor: onDayClick ? "pointer" : "default" }}
            >
              {renderDay(day, meta)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
