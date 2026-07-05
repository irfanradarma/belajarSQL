import { useThemeStore, type ThemeName } from "../../lib/store/theme";

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "ssms", label: "SSMS" },
];

export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-0.5 rounded border border-border p-0.5">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          aria-pressed={theme === opt.value}
          className={`rounded px-2 py-0.5 text-xs ${
            theme === opt.value
              ? "bg-accent text-accent-fg"
              : "text-fg-muted hover:bg-accent/10"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
