import { create } from "zustand";

export type ThemeName = "light" | "dark" | "ssms";

const STORAGE_KEY = "belajarsql.theme";

function applyThemeToDom(theme: ThemeName): void {
  document.documentElement.setAttribute("data-theme", theme);
}

function getInitialTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "ssms") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = getInitialTheme();
  applyThemeToDom(initial);
  return {
    theme: initial,
    setTheme: (theme) => {
      applyThemeToDom(theme);
      localStorage.setItem(STORAGE_KEY, theme);
      set({ theme });
    },
  };
});
