// Self-hosts Monaco: points @monaco-editor/react at the npm-bundled
// monaco-editor package instead of its default jsdelivr CDN fetch, and wires
// the one worker our usage actually needs. This file is only ever reached
// via the lazy-loaded editor chunk (see components/Editor/MonacoQueryEditor.tsx)
// so none of this weight sits on the initial page load.
// Import edcore.main (core editor + every built-in *editor* contribution —
// suggest, hover, bracket matching, find, folding, etc.) rather than the
// "monaco-editor" package's default entry point (editor.main), which on top
// of edcore.main also eagerly bundles the basic-languages/CSS/HTML/JSON/
// TypeScript *language service* contributions — dead weight here since
// T-SQL is our own Monarch-based language. editor.api alone is NOT enough:
// it excludes editor.all's contributions entirely, which silently breaks
// the suggest widget (registerCompletionItemProvider succeeds but nothing
// ever invokes it, since editor.action.triggerSuggest isn't registered).
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main";
import { loader } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

// T-SQL highlighting/indentation runs through our Monarch tokenizer on the
// main thread — no json/css/html/typescript language services are used, so
// only the generic editor worker (bracket matching, etc.) is needed.
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });
