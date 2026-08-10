import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ColorTheme = "orange" | "blue" | "emerald" | "purple" | "teal";

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (color: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("hr_theme") as "light" | "dark") || "light"
  );

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(
    () => (localStorage.getItem("hr_color_theme") as ColorTheme) || "orange"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("hr_theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-color-theme", colorTheme);
    localStorage.setItem("hr_color_theme", colorTheme);
  }, [colorTheme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const setColorTheme = (color: ColorTheme) => setColorThemeState(color);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
