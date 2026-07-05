import { useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import "../../lib/monaco/setup"; // self-hosts Monaco instead of the default jsdelivr CDN fetch
import { ensureTsqlLanguageRegistered, TSQL_LANGUAGE_ID } from "../../lib/monaco/tsqlLanguage";
import { ensureMonacoThemesDefined, getMonacoThemeName } from "../../lib/monaco/theme";
import { ensureSqlCompletionProviderRegistered } from "../../lib/monaco/completionProvider";
import { useThemeStore } from "../../lib/store/theme";
import { useSchemaStore } from "../../lib/store/schema";

interface MonacoQueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunRequest: () => void;
}

export function MonacoQueryEditor({ value, onChange, onRunRequest }: MonacoQueryEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  const onRunRequestRef = useRef(onRunRequest);
  onRunRequestRef.current = onRunRequest;

  const handleBeforeMount: BeforeMount = (monaco) => {
    ensureTsqlLanguageRegistered(monaco);
    ensureMonacoThemesDefined(monaco);
    ensureSqlCompletionProviderRegistered(monaco, () => useSchemaStore.getState().tree);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editor.updateOptions({ tabCompletion: "on" });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRequestRef.current();
    });
  };

  return (
    <Editor
      language={TSQL_LANGUAGE_ID}
      theme={getMonacoThemeName(theme)}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabCompletion: "on",
        wordWrap: "off",
      }}
    />
  );
}
