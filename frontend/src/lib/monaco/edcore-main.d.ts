// monaco-editor ships type declarations only for editor.api.d.ts, but
// edcore.main.js re-exports that exact same API surface at runtime (plus
// side-effect-importing editor.all's contributions) — see setup.ts for why
// we import edcore.main instead of editor.api directly.
declare module "monaco-editor/esm/vs/editor/edcore.main" {
  export * from "monaco-editor/esm/vs/editor/editor.api";
}
