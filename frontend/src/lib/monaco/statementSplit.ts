// Splits a SQL script into semicolon-delimited statements so "Run Statement"
// can execute just the chunk under the cursor instead of the whole editor.
// Deliberately a light scanner (string/comment aware, not a full T-SQL
// parser) — good enough to find statement boundaries, not to validate SQL.

export interface StatementRange {
  text: string;
  start: number;
  end: number;
}

function trimmedRange(source: string, start: number, end: number): StatementRange {
  const raw = source.slice(start, end);
  const leading = raw.length - raw.trimStart().length;
  const trimmed = raw.trim();
  return { text: trimmed, start: start + leading, end: start + leading + trimmed.length };
}

export function splitStatements(source: string): StatementRange[] {
  const statements: StatementRange[] = [];
  let segmentStart = 0;
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    if (ch === "'") {
      i++;
      while (i < n) {
        if (source[i] === "'") {
          if (source[i + 1] === "'") {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (ch === "-" && source[i + 1] === "-") {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i = Math.min(i + 2, n);
      continue;
    }

    if (ch === ";") {
      const range = trimmedRange(source, segmentStart, i);
      if (range.text) statements.push(range);
      segmentStart = i + 1;
      i++;
      continue;
    }

    i++;
  }

  const last = trimmedRange(source, segmentStart, n);
  if (last.text) statements.push(last);

  return statements;
}

// Returns the statement whose range contains `offset`; if the offset falls
// in a gap between statements (blank lines, trailing comments), falls back
// to the next statement, then the previous one.
export function statementAtOffset(source: string, offset: number): string {
  const statements = splitStatements(source);
  if (statements.length === 0) return "";

  for (const s of statements) {
    if (offset >= s.start && offset <= s.end) return s.text;
  }

  const following = statements.find((s) => s.start > offset);
  if (following) return following.text;

  return statements[statements.length - 1].text;
}
