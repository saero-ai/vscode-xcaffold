// src/semanticTokenProvider.ts
//
// DocumentSemanticTokensProvider that emits kind-aware token types
// for .xcaf files. Enables theme authors to color required vs optional
// fields differently and highlight cross-resource references.

import * as vscode from 'vscode';
import { XcafSchemaCache, KNOWN_KINDS, SchemaField } from './xcafSchema';
import { XcafIndex } from './xcafIndex';

// ── Token legend ──────────────────────────────────────────────────

export const XCAF_TOKEN_TYPES = [
  'xcafKind',
  'xcafFieldRequired',
  'xcafFieldOptional',
  'xcafResourceRef',
] as const;

export const XCAF_TOKEN_MODIFIERS: string[] = [];

export const xcafSemanticLegend = new vscode.SemanticTokensLegend(
  [...XCAF_TOKEN_TYPES],
  XCAF_TOKEN_MODIFIERS,
);

// ── Pure data type for testability ────────────────────────────────

export interface SemanticToken {
  line: number;
  startChar: number;
  length: number;
  tokenType: number; // index into XCAF_TOKEN_TYPES
}

// ── Token type indices (matching XCAF_TOKEN_TYPES order) ──────────

const TOKEN_KIND = 0;
const TOKEN_FIELD_REQUIRED = 1;
const TOKEN_FIELD_OPTIONAL = 2;
const TOKEN_RESOURCE_REF = 3;

// ── Frontmatter boundary detection ───────────────────────────────

interface FrontmatterBounds {
  /** Line index of the opening `---` delimiter. */
  start: number;
  /** Line index of the closing `---` delimiter. */
  end: number;
}

function findFrontmatterBounds(
  lines: string[],
): FrontmatterBounds | null {
  if (lines[0]?.trim() !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { start: 0, end: i };
    }
  }
  return null;
}

// ── Pure computation ─────────────────────────────────────────────

/**
 * computeSemanticTokens analyses frontmatter text and produces an
 * array of semantic tokens without touching the VS Code API.
 *
 * @param text         Full document text.
 * @param schemaFields Map of field name to { required } for the
 *                     detected kind. When empty, all fields are
 *                     treated as unknown (no field tokens emitted).
 * @param resolveRef   Returns true when a value string matches a
 *                     known resource name in XcafIndex.
 */
export function computeSemanticTokens(
  text: string,
  schemaFields: Map<string, { required: boolean }>,
  resolveRef: (name: string) => boolean,
): SemanticToken[] {
  const lines = text.split('\n');
  const bounds = findFrontmatterBounds(lines);
  if (!bounds) {
    return [];
  }

  const tokens: SemanticToken[] = [];
  const kvRe = /^(\s*)([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;

  for (let i = bounds.start + 1; i < bounds.end; i++) {
    const raw = lines[i];
    const match = kvRe.exec(raw);
    if (!match) {
      continue;
    }

    const indent = match[1].length;
    const key = match[2];
    const valuePart = match[3].trim();

    // 1. Emit kind token on the value when key is "kind"
    if (key === 'kind') {
      const kindValue = stripQuotes(valuePart).toLowerCase();
      if (kindValue && KNOWN_KINDS.includes(kindValue)) {
        const valueStart = findValueStart(raw, valuePart);
        tokens.push({
          line: i,
          startChar: valueStart,
          length: valuePart.length,
          tokenType: TOKEN_KIND,
        });
      }
      continue; // "kind" key itself is not emitted as a field token
    }

    // 2. Emit field token on the key
    const fieldInfo = schemaFields.get(key);
    if (fieldInfo) {
      tokens.push({
        line: i,
        startChar: indent,
        length: key.length,
        tokenType: fieldInfo.required
          ? TOKEN_FIELD_REQUIRED
          : TOKEN_FIELD_OPTIONAL,
      });
    }

    // 3. Emit resource-ref token on the value when it resolves
    if (valuePart) {
      const cleanValue = stripQuotes(valuePart);
      if (cleanValue && resolveRef(cleanValue)) {
        const valueStart = findValueStart(raw, valuePart);
        tokens.push({
          line: i,
          startChar: valueStart,
          length: valuePart.length,
          tokenType: TOKEN_RESOURCE_REF,
        });
      }
    }
  }

  return tokens;
}

/** Remove surrounding single or double quotes from a value. */
function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Find the character offset where `valuePart` appears after `: `. */
function findValueStart(line: string, valuePart: string): number {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) {
    return 0;
  }
  // Search for valuePart starting from after the colon
  const searchStart = colonIdx + 1;
  const idx = line.indexOf(valuePart, searchStart);
  return idx !== -1 ? idx : searchStart;
}

// ── Build schema field map from cache ────────────────────────────

function buildSchemaFieldMap(
  schemaCache: XcafSchemaCache,
  kind: string,
): Map<string, { required: boolean }> {
  const map = new Map<string, { required: boolean }>();
  const schema = schemaCache.getSchema(kind);
  if (!schema) {
    return map;
  }
  for (const field of schema.fields) {
    map.set(field.name, { required: field.required });
  }
  return map;
}

/** Extract kind value from document text frontmatter. */
function extractKindFromText(text: string): string | null {
  const lines = text.split('\n');
  const bounds = findFrontmatterBounds(lines);
  if (!bounds) {
    return null;
  }
  const kindRe = /^kind:\s*(.+)$/;
  for (let i = bounds.start + 1; i < bounds.end; i++) {
    const match = kindRe.exec(lines[i].trim());
    if (match) {
      return stripQuotes(match[1].trim()).toLowerCase();
    }
  }
  return null;
}

// ── VS Code provider ─────────────────────────────────────────────

export class XcafSemanticTokenProvider
  implements vscode.DocumentSemanticTokensProvider
{
  constructor(
    private schemaCache: XcafSchemaCache,
    private xcafIndex: XcafIndex,
  ) {}

  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): vscode.SemanticTokens {
    const text = document.getText();
    const kind = extractKindFromText(text);

    const schemaFields = kind
      ? buildSchemaFieldMap(this.schemaCache, kind)
      : new Map<string, { required: boolean }>();

    const resolveRef = (name: string): boolean => {
      return this.xcafIndex.resolveByName(name) !== undefined;
    };

    const tokens = computeSemanticTokens(text, schemaFields, resolveRef);

    const builder = new vscode.SemanticTokensBuilder(xcafSemanticLegend);
    for (const token of tokens) {
      builder.push(
        token.line,
        token.startChar,
        token.length,
        token.tokenType,
        0,
      );
    }
    return builder.build();
  }
}
