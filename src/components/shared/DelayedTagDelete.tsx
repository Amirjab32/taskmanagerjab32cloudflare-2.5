import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface DelayedTagDeleteProps {
  onDelete: () => void;
}

export default function DelayedTagDelete({ onDelete }: DelayedTagDeleteProps) {
  const [state, setState] = useState<"idle" | "waiting" | "confirm">("idle");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (state === "waiting") {
      setCountdown(3);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setState("confirm");
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (state === "confirm") {
      setCountdown(3);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setState("idle");
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state]);

  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState("waiting");
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
    setState("idle");
  };

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={handleStart}
        className="mr-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-rose-500 hover:bg-rose-500/10 transition-colors"
        title="حذف هشتگ (قانون ۳+۳)"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    );
  }

  if (state === "waiting") {
    return (
      <span
        className="mr-1 inline-flex items-center justify-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-medium leading-none text-amber-500 select-none animate-pulse"
        style={{ direction: "rtl" }}
      >
        صبر {countdown}ثانیه
      </span>
    );
  }

  // state === "confirm"
  return (
    <button
      type="button"
      onClick={handleConfirm}
      className="mr-1 inline-flex items-center justify-center rounded bg-rose-600 px-1.5 py-0.5 text-[8.5px] font-bold leading-none text-white hover:bg-rose-700 transition-colors cursor-pointer select-none"
      style={{ direction: "rtl" }}
    >
      تایید نهایی {countdown}ثانیه
    </button>
  );
}
