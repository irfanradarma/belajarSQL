import { forwardRef, useImperativeHandle, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import "../../lib/monaco/setup"; // self-hosts Monaco instead of the default jsdelivr CDN fetch
import { ensureTsqlLanguageRegistered, TSQL_LANGUAGE_ID } from "../../lib/monaco/tsqlLanguage";
import { ensureMonacoThemesDefined, getMonacoThemeName } from "../../lib/monaco/theme";
import { ensureSqlCompletionProviderRegistered } from "../../lib/monaco/completionProvider";
import { statementAtOffset } from "../../lib/monaco/statementSplit";
import { useThemeStore } from "../../lib/store/theme";
import { useSchemaStore } from "../../lib/store/schema";

interface MonacoQueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunStatement: (sql: string) => void;
  onRunAll: () => void;
}

export interface MonacoQueryEditorHandle {
  /** The current selection if non-empty, otherwise the SQL statement under the cursor. */
  getRunTarget: () => string;
}

export const MonacoQueryEditor = forwardRef<MonacoQueryEditorHandle, MonacoQueryEditorProps>(
  function MonacoQueryEditor({ value, onChange, onRunStatement, onRunAll }, ref) {
    const theme = useThemeStore((s) => s.theme);
    const onRunStatementRef = useRef(onRunStatement);
    onRunStatementRef.current = onRunStatement;
    const onRunAllRef = useRef(onRunAll);
    onRunAllRef.current = onRunAll;
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

    const getRunTarget = () => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) return "";

      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        return model.getValueInRange(selection).trim();
      }

      const position = editor.getPosition();
      if (!position) return model.getValue().trim();

      return statementAtOffset(model.getValue(), model.getOffsetAt(position));
    };

    useImperativeHandle(ref, () => ({ getRunTarget }));

    const handleBeforeMount: BeforeMount = (monaco) => {
      ensureTsqlLanguageRegistered(monaco);
      ensureMonacoThemesDefined(monaco);
      ensureSqlCompletionProviderRegistered(monaco, () => useSchemaStore.getState().tree);
    };

    const handleMount: OnMount = (editor, monaco) => {
      editorRef.current = editor;
      editor.updateOptions({ tabCompletion: "on" });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunStatementRef.current(getRunTarget());
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        onRunAllRef.current();
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
  },
);
