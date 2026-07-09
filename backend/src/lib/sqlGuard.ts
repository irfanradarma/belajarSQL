// Defense-in-depth statement validation. The SQL Server login itself is
// provisioned read-only, but we still reject obviously-mutating statements
// server-side before they ever reach the shared connection pool.
//
// One carve-out: statements that create, populate, modify, or drop a local
// temp table (name starting with a single #) are allowed. SQL Server scopes
// #tables to the single physical connection that created them — and every
// session now gets exactly one dedicated connection (see sessionManager.ts)
// — so this can't leak into or touch another student's session or any real
// table. Global temp tables (##name), which SQL Server shares across every
// connection, are deliberately NOT included in that carve-out.

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|EXEC(UTE)?|GRANT|REVOKE|CREATE|BACKUP|RESTORE|DENY)\b|(\bsp_\w+)|(\bxp_\w+)/i;

const GO_BATCH_SEPARATOR = /^\s*GO\s*$/im;

// A local temp table reference: optionally bracket-quoted, a single #
// (negative lookahead excludes ## global temp tables) then identifier chars.
const TEMP_TABLE_NAME = "\\[?#(?!#)\\w+\\]?";

const READONLY_START = /^(SELECT|WITH)\b/i;
const SELECT_INTO_TARGET = new RegExp(`\\bINTO\\s+${TEMP_TABLE_NAME}`, "i");
const HAS_INTO = /\bINTO\s+/i;

// Statement-leading forms that are allowed only because their target is a
// local temp table — checked in order, first match wins.
const TEMP_TABLE_STATEMENT_LEADS = [
  new RegExp(`^CREATE\\s+TABLE\\s+${TEMP_TABLE_NAME}`, "i"),
  new RegExp(`^DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${TEMP_TABLE_NAME}`, "i"),
  new RegExp(`^TRUNCATE\\s+TABLE\\s+${TEMP_TABLE_NAME}`, "i"),
  new RegExp(`^INSERT\\s+(?:INTO\\s+)?${TEMP_TABLE_NAME}`, "i"),
  new RegExp(`^UPDATE\\s+${TEMP_TABLE_NAME}`, "i"),
  new RegExp(`^DELETE\\s+(?:FROM\\s+)?${TEMP_TABLE_NAME}`, "i"),
];

function stripComments(sqlText: string): string {
  // Strip /* block */ and -- line comments so keyword scanning can't be
  // evaded by hiding a mutating statement inside a comment-adjacent token.
  return sqlText
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
}

// Splits on ';' while respecting quoted string literals (comments are
// already stripped by the time this runs, so no need to handle those here).
function splitStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  const n = sqlText.length;

  while (i < n) {
    const ch = sqlText[i];
    if (ch === "'") {
      i++;
      while (i < n) {
        if (sqlText[i] === "'") {
          if (sqlText[i + 1] === "'") {
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
    if (ch === ";") {
      const stmt = sqlText.slice(start, i).trim();
      if (stmt) statements.push(stmt);
      start = i + 1;
      i++;
      continue;
    }
    i++;
  }

  const last = sqlText.slice(start).trim();
  if (last) statements.push(last);

  return statements;
}

export interface SqlGuardResult {
  allowed: boolean;
  reason?: string;
}

const NOT_PERMITTED: SqlGuardResult = {
  allowed: false,
  reason: "Query contains a statement type that is not permitted (read-only access only).",
};

function checkStatement(statementText: string): SqlGuardResult {
  if (READONLY_START.test(statementText)) {
    // SELECT ... INTO is the one read-looking form that creates a table as
    // a side effect, so its target needs the same # check as everything else.
    if (HAS_INTO.test(statementText) && !SELECT_INTO_TARGET.test(statementText)) {
      return {
        allowed: false,
        reason: "SELECT INTO is only allowed when the target is a local temp table (name starting with #).",
      };
    }
    if (FORBIDDEN_KEYWORDS.test(statementText)) return NOT_PERMITTED;
    return { allowed: true };
  }

  const tempLead = TEMP_TABLE_STATEMENT_LEADS.find((re) => re.test(statementText));
  if (tempLead) {
    // Still scan whatever follows the matched lead clause for smuggled
    // mutations against real objects, e.g. "INSERT INTO #t EXEC sp_evil".
    const rest = statementText.slice(tempLead.exec(statementText)![0].length);
    if (FORBIDDEN_KEYWORDS.test(rest)) return NOT_PERMITTED;
    return { allowed: true };
  }

  if (FORBIDDEN_KEYWORDS.test(statementText)) {
    return {
      allowed: false,
      reason:
        "Only SELECT statements and local temp table (#table) management " +
        "(CREATE/INSERT/UPDATE/DELETE/DROP/TRUNCATE) are allowed.",
    };
  }

  return {
    allowed: false,
    reason: "Only SELECT statements (optionally starting with WITH) are allowed.",
  };
}

export function checkQueryAllowed(rawSql: string): SqlGuardResult {
  const sqlText = stripComments(rawSql).trim();

  if (!sqlText) {
    return { allowed: false, reason: "Query text is empty." };
  }

  if (GO_BATCH_SEPARATOR.test(sqlText)) {
    return {
      allowed: false,
      reason: "Multi-batch scripts using GO separators are not supported here.",
    };
  }

  const statements = splitStatements(sqlText);
  if (statements.length === 0) {
    return { allowed: false, reason: "Query text is empty." };
  }

  for (const statement of statements) {
    const result = checkStatement(statement);
    if (!result.allowed) return result;
  }

  return { allowed: true };
}
