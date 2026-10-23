import { useTheme } from "./ThemeContext";
export function useThemeStyles() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    isDark,
    bg: isDark ? "#0d0d0d" : "#ffffff",
    fg: isDark ? "#fafafa" : "#0a0a0a",
    fgMuted: isDark ? "#a3a3a3" : "#737373",
    cardBg: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    cardBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    inputBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    headerBg: isDark ? "rgba(13,13,13,0.8)" : "rgba(255,255,255,0.8)",
    sidebarBg: isDark ? "#111111" : "#ffffff",
  };
}
