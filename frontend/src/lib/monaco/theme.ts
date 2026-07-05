import type * as Monaco from "monaco-editor";
import type { ThemeName } from "../store/theme";

// Monaco doesn't read CSS custom properties, so its theme has to be switched
// in lockstep with the app's data-theme attribute (see store/theme.ts).
const MONACO_THEME_NAME: Record<ThemeName, string> = {
  light: "tsql-light",
  dark: "tsql-dark",
  ssms: "tsql-ssms",
};

let defined = false;

export function ensureMonacoThemesDefined(monaco: typeof Monaco): void {
  if (defined) return;
  defined = true;

  monaco.editor.defineTheme("tsql-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "0000ff", fontStyle: "bold" },
      { token: "type", foreground: "267f99" },
      { token: "predefined", foreground: "795e26" },
      { token: "variable", foreground: "a31515" },
      { token: "identifier.quote", foreground: "001080" },
      { token: "comment", foreground: "008000" },
      { token: "string", foreground: "a31515" },
      { token: "number", foreground: "098658" },
    ],
    colors: {},
  });

  monaco.editor.defineTheme("tsql-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "569cd6", fontStyle: "bold" },
      { token: "type", foreground: "4ec9b0" },
      { token: "predefined", foreground: "dcdcaa" },
      { token: "variable", foreground: "9cdcfe" },
      { token: "identifier.quote", foreground: "9cdcfe" },
      { token: "comment", foreground: "6a9955" },
      { token: "string", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
    ],
    colors: {},
  });

  // SSMS-style: light editor surface with the classic SSMS blue keyword accent.
  monaco.editor.defineTheme("tsql-ssms", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "0e639c", fontStyle: "bold" },
      { token: "type", foreground: "2b6a80" },
      { token: "predefined", foreground: "7a4e2d" },
      { token: "variable", foreground: "aa0000" },
      { token: "identifier.quote", foreground: "14213d" },
      { token: "comment", foreground: "008000" },
      { token: "string", foreground: "aa0000" },
      { token: "number", foreground: "098658" },
    ],
    colors: {
      "editor.background": "#ffffff",
    },
  });
}

export function getMonacoThemeName(theme: ThemeName): string {
  return MONACO_THEME_NAME[theme];
}
