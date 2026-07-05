// Defense-in-depth statement validation. The SQL Server login itself is
// provisioned read-only, but we still reject obviously-mutating statements
// server-side before they ever reach the shared connection pool.

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|EXEC(UTE)?|GRANT|REVOKE|CREATE|BACKUP|RESTORE|DENY)\b|(\bsp_\w+)|(\bxp_\w+)/i;

const GO_BATCH_SEPARATOR = /^\s*GO\s*$/im;

function stripComments(sqlText: string): string {
  // Strip /* block */ and -- line comments so keyword scanning can't be
  // evaded by hiding a mutating statement inside a comment-adjacent token.
  return sqlText
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
}

export interface SqlGuardResult {
  allowed: boolean;
  reason?: string;
}

export function checkQueryAllowed(rawSql: string): SqlGuardResult {
  const sqlText = stripComments(rawSql).trim();

  if (!sqlText) {
    return { allowed: false, reason: "Query text is empty." };
  }

  if (!/^(SELECT|WITH)\b/i.test(sqlText)) {
    return {
      allowed: false,
      reason: "Only SELECT statements (optionally starting with WITH) are allowed.",
    };
  }

  if (GO_BATCH_SEPARATOR.test(sqlText)) {
    return {
      allowed: false,
      reason: "Multi-batch scripts using GO separators are not supported here.",
    };
  }

  if (FORBIDDEN_KEYWORDS.test(sqlText)) {
    return {
      allowed: false,
      reason: "Query contains a statement type that is not permitted (read-only access only).",
    };
  }

  return { allowed: true };
}
