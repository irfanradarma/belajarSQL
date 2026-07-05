import type * as Monaco from "monaco-editor";
import type { SchemaTreeResponse, TableMeta } from "@belajarsql/shared";
import { KEYWORDS, TSQL_LANGUAGE_ID } from "./tsqlLanguage";

interface ParsedTableRef {
  schema?: string;
  table: string;
  alias?: string;
}

interface ResolvedTableRef extends ParsedTableRef {
  resolved: TableMeta;
  resolvedSchema: string;
}

// FROM/JOIN <schema.table|table> [[AS] alias] — deliberately simple regex
// scanning rather than a full SQL parser, scoped to the text of the current
// statement only. Good enough to drive completion; not intended to validate SQL.
const TABLE_REF_PATTERN =
  /\b(?:FROM|JOIN)\s+(\[?\w+\]?)(?:\.(\[?\w+\]?))?(?:\s+(?:AS\s+)?(\[?\w+\]?))?/gi;

const NON_ALIAS_KEYWORDS = new Set([
  "WHERE", "GROUP", "ORDER", "HAVING", "ON", "JOIN", "INNER", "LEFT", "RIGHT",
  "FULL", "OUTER", "CROSS", "UNION", "APPLY",
]);

function stripBrackets(s?: string): string | undefined {
  return s?.replace(/[[\]]/g, "");
}

function parseTableRefs(statementText: string): ParsedTableRef[] {
  const refs: ParsedTableRef[] = [];
  TABLE_REF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TABLE_REF_PATTERN.exec(statementText))) {
    const first = stripBrackets(match[1]);
    const second = stripBrackets(match[2]);
    const aliasRaw = stripBrackets(match[3]);
    if (!first) continue;

    const schema = second ? first : undefined;
    const table = second ?? first;
    const alias =
      aliasRaw && !NON_ALIAS_KEYWORDS.has(aliasRaw.toUpperCase()) ? aliasRaw : undefined;

    refs.push({ schema, table, alias });
  }
  return refs;
}

function resolveTableRef(
  tree: SchemaTreeResponse,
  ref: ParsedTableRef,
): ResolvedTableRef | undefined {
  for (const schema of tree.schemas) {
    if (ref.schema && schema.name.toLowerCase() !== ref.schema.toLowerCase()) continue;
    const table = schema.tables.find((t) => t.name.toLowerCase() === ref.table.toLowerCase());
    if (table) return { ...ref, resolved: table, resolvedSchema: schema.name };
  }
  return undefined;
}

function tableSuggestions(
  monaco: typeof Monaco,
  tree: SchemaTreeResponse,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  const items: Monaco.languages.CompletionItem[] = [];
  const multiSchema = tree.schemas.length > 1;
  for (const schema of tree.schemas) {
    for (const table of schema.tables) {
      items.push({
        label: table.name,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: table.name,
        detail: `${schema.name}.${table.name} (${table.type})`,
        range,
        sortText: `0_${table.name}`,
      });
      if (multiSchema) {
        items.push({
          label: `${schema.name}.${table.name}`,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: `${schema.name}.${table.name}`,
          detail: table.type,
          range,
          sortText: `0_${schema.name}.${table.name}`,
        });
      }
    }
  }
  return items;
}

function columnSuggestions(
  monaco: typeof Monaco,
  table: TableMeta,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  return table.columns.map((col) => ({
    label: col.name,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: col.name,
    detail: `${col.dataType}${col.isNullable ? " (nullable)" : ""}`,
    range,
    sortText: `0_${col.name}`,
  }));
}

function allColumnSuggestions(
  monaco: typeof Monaco,
  tree: SchemaTreeResponse,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  const items: Monaco.languages.CompletionItem[] = [];
  for (const schema of tree.schemas) {
    for (const table of schema.tables) {
      for (const col of table.columns) {
        items.push({
          label: col.name,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: col.name,
          detail: `${table.name}.${col.name}: ${col.dataType}`,
          range,
          sortText: `1_${col.name}`,
        });
      }
    }
  }
  return items;
}

function keywordSuggestions(
  monaco: typeof Monaco,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  return KEYWORDS.map((kw) => ({
    label: kw,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: kw,
    range,
    sortText: `9_${kw}`,
  }));
}

let registered = false;

export function ensureSqlCompletionProviderRegistered(
  monaco: typeof Monaco,
  getSchema: () => SchemaTreeResponse | null,
): void {
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider(TSQL_LANGUAGE_ID, {
    triggerCharacters: [".", " "],
    provideCompletionItems(model, position) {
      const tree = getSchema();
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      if (!tree) {
        return { suggestions: keywordSuggestions(monaco, range) };
      }

      const fullTextUntilCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      // Scope table/alias resolution to the current statement only.
      const statementText = fullTextUntilCursor.slice(fullTextUntilCursor.lastIndexOf(";") + 1);
      const lineUntilCursor = model
        .getLineContent(position.lineNumber)
        .slice(0, position.column - 1);

      const resolvedRefs = parseTableRefs(statementText)
        .map((ref) => resolveTableRef(tree, ref))
        .filter((ref): ref is ResolvedTableRef => ref !== undefined);

      // "alias." or "schema." — member access.
      const dotMatch = /([A-Za-z_]\w*)\.\s*$/.exec(lineUntilCursor);
      if (dotMatch) {
        const prefix = dotMatch[1].toLowerCase();
        const aliasHit = resolvedRefs.find(
          (ref) => (ref.alias ?? ref.resolved.name).toLowerCase() === prefix,
        );
        if (aliasHit) {
          return { suggestions: columnSuggestions(monaco, aliasHit.resolved, range) };
        }
        const schemaHit = tree.schemas.find((s) => s.name.toLowerCase() === prefix);
        if (schemaHit) {
          return {
            suggestions: schemaHit.tables.map((table) => ({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              detail: table.type,
              range,
              sortText: `0_${table.name}`,
            })),
          };
        }
        return { suggestions: [] };
      }

      // Right after FROM/JOIN with no dot yet — suggest table names.
      if (/\b(FROM|JOIN)\s+[\w[\]]*$/i.test(statementText)) {
        return { suggestions: tableSuggestions(monaco, tree, range) };
      }

      // Default: columns from tables already referenced in this statement
      // (alias-scoped), falling back to every known column when nothing has
      // been resolved yet (e.g. still typing the SELECT list before FROM),
      // plus table names and keywords as lower-priority fallbacks.
      const columnItems =
        resolvedRefs.length > 0
          ? resolvedRefs.flatMap((ref) => columnSuggestions(monaco, ref.resolved, range))
          : allColumnSuggestions(monaco, tree, range);

      return {
        suggestions: [
          ...columnItems,
          ...tableSuggestions(monaco, tree, range),
          ...keywordSuggestions(monaco, range),
        ],
      };
    },
  });
}
