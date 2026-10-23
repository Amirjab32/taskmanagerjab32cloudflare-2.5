import React, { createContext, useContext, useEffect, useState } from "react";
type Theme = "dark" | "light";
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const stored = localStorage.getItem("focusflow-theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (theme === "dark") {
      html.classList.add("dark");
      body.style.backgroundColor = "#0d0d0d";
      body.style.color = "#fafafa";
    } else {
      html.classList.remove("dark");
      body.style.backgroundColor = "#ffffff";
      body.style.color = "#0a0a0a";
    }
    localStorage.setItem("focusflow-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  return useContext(ThemeContext);
}
