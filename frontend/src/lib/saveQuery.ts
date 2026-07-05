// Deliberately has no dependency on SheetJS (lib/export.ts) — saving plain
// text is cheap enough to keep as a synchronous import rather than needing
// its own dynamically-imported chunk.
export function saveQueryAsSql(sql: string, filename = "query.sql"): void {
  const blob = new Blob([sql], { type: "application/sql;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
