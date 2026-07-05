import type * as Monaco from "monaco-editor";

export const TSQL_LANGUAGE_ID = "tsql";

export const KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER",
  "APPLY", "CROSS", "ON", "GROUP", "BY", "ORDER", "HAVING", "UNION", "ALL",
  "DISTINCT", "TOP", "AS", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END",
  "AND", "OR", "NOT", "NULL", "IS", "IN", "EXISTS", "BETWEEN", "LIKE", "ASC",
  "DESC", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE",
  "ALTER", "DROP", "TABLE", "VIEW", "INDEX", "PROCEDURE", "FUNCTION",
  "TRIGGER", "DECLARE", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "EXEC",
  "EXECUTE", "RETURN", "IF", "WHILE", "CAST", "CONVERT", "OVER", "PARTITION",
  "MERGE", "USING", "MATCHED", "OUTPUT", "IDENTITY", "PRIMARY", "KEY",
  "FOREIGN", "REFERENCES", "DEFAULT", "CHECK", "UNIQUE", "OFFSET", "FETCH",
  "NEXT", "ROWS", "ONLY", "GRANT", "REVOKE", "DENY", "SCHEMA", "GO",
];

const TYPES = [
  "INT", "BIGINT", "SMALLINT", "TINYINT", "BIT", "DECIMAL", "NUMERIC",
  "FLOAT", "REAL", "MONEY", "SMALLMONEY", "CHAR", "VARCHAR", "NCHAR",
  "NVARCHAR", "TEXT", "NTEXT", "DATE", "DATETIME", "DATETIME2",
  "SMALLDATETIME", "TIME", "DATETIMEOFFSET", "BINARY", "VARBINARY", "IMAGE",
  "UNIQUEIDENTIFIER", "XML", "CURSOR", "SQL_VARIANT",
];

const BUILTIN_FUNCTIONS = [
  "COUNT", "SUM", "AVG", "MIN", "MAX", "GETDATE", "ISNULL", "COALESCE",
  "NULLIF", "LEN", "SUBSTRING", "CHARINDEX", "REPLACE", "UPPER", "LOWER",
  "LTRIM", "RTRIM", "DATEADD", "DATEDIFF", "DATEPART", "YEAR", "MONTH",
  "DAY", "ROW_NUMBER", "RANK", "DENSE_RANK",
];

export const tsqlLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: { lineComment: "--", blockComment: ["/*", "*/"] },
  brackets: [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ],
  autoClosingPairs: [
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "{", close: "}" },
    { open: "'", close: "'", notIn: ["string"] },
    { open: '"', close: '"', notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
  // T-SQL doesn't nest on brace-style blocks, so indentation follows
  // BEGIN/CASE ... END pairing instead of the bracket matcher.
  onEnterRules: [
    {
      beforeText: /^\s*(BEGIN|CASE)\s*$/i,
      action: { indentAction: 1 satisfies Monaco.languages.IndentAction }, // Indent
    },
    {
      beforeText: /^\s*END\s*;?\s*$/i,
      action: { indentAction: 2 satisfies Monaco.languages.IndentAction }, // Outdent
    },
  ],
};

export const tsqlMonarchLanguage: Monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  ignoreCase: true,
  keywords: KEYWORDS,
  types: TYPES,
  builtinFunctions: BUILTIN_FUNCTIONS,
  operators: ["=", ">", "<", ">=", "<=", "<>", "!=", "+", "-", "*", "/", "%"],
  symbols: /[=><!~?:&|+\-*/%]+/,

  tokenizer: {
    root: [
      // #temp and ##global temp table identifiers
      [/##?[A-Za-z_][\w$#@]*/, "type.identifier"],
      // @variable / @@system-variable
      [/@@?[A-Za-z_][\w$@]*/, "variable"],
      // bracketed [identifier] — T-SQL's way of quoting reserved words/spaces
      [/\[[^\]]*\]/, "identifier.quote"],

      [/[A-Za-z_][\w$]*/, {
        cases: {
          "@keywords": "keyword",
          "@types": "type",
          "@builtinFunctions": "predefined",
          "@default": "identifier",
        },
      }],

      { include: "@whitespace" },

      [/\d+\.\d+([eE][-+]?\d+)?/, "number.float"],
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/\d+/, "number"],

      [/'/, { token: "string.quote", bracket: "@open", next: "@string" }],
      [/"/, { token: "string.quote", bracket: "@open", next: "@dqstring" }],

      [/[()]/, "@brackets"],
      [/[;,.]/, "delimiter"],
      [/@symbols/, "operator"],
    ],

    whitespace: [
      [/[ \t\r\n]+/, "white"],
      [/--.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
    ],

    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],

    string: [
      [/[^']+/, "string"],
      [/''/, "string"], // T-SQL escapes a quote by doubling it
      [/'/, { token: "string.quote", bracket: "@close", next: "@pop" }],
    ],

    dqstring: [
      [/[^"]+/, "string"],
      [/""/, "string"],
      [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
    ],
  },
};

let registered = false;

export function ensureTsqlLanguageRegistered(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: TSQL_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(TSQL_LANGUAGE_ID, tsqlLanguageConfiguration);
  monaco.languages.setMonarchTokensProvider(TSQL_LANGUAGE_ID, tsqlMonarchLanguage);
}
