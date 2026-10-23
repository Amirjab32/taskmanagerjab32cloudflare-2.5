import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useThemeStyles } from "@/lib/useThemeStyles";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { cardBorder } = useThemeStyles();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-9 w-16 flex-shrink-0 items-center rounded-full px-1 transition-colors"
      style={{
        border: `1px solid ${cardBorder}`,
        backgroundColor: "rgba(128,128,128,0.08)",
        direction: "ltr",
      }}
      aria-label="تغییر تم"
    >
      {/* Moon icon on left side (dark mode indicator) */}
      <span
        className="absolute left-2 flex items-center justify-center"
        style={{ color: isDark ? "rgba(255,255,255,0.3)" : "transparent" }}
      >
        <Moon className="h-3 w-3" />
      </span>
      {/* Sun icon on right side (light mode indicator) */}
      <span
        className="absolute right-2 flex items-center justify-center"
        style={{ color: !isDark ? "rgba(0,0,0,0.3)" : "transparent" }}
      >
        <Sun className="h-3 w-3" />
      </span>
      {/* Thumb */}
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 shadow-md"
        style={{
          transform: isDark ? "translateX(0px)" : "translateX(28px)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          flexShrink: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        {isDark ? <Moon className="h-4 w-4 text-white" /> : <Sun className="h-4 w-4 text-white" />}
      </span>
    </button>
  );
}
