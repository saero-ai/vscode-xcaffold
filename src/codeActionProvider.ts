// src/codeActionProvider.ts
//
// CodeActionProvider for .xcaf files. Offers quick fixes for common
// validation issues: missing required fields, unknown field names
// (with closest-match suggestions), and unquoted version numbers.

import * as vscode from 'vscode';
import { XcafSchemaCache, SchemaField } from './xcafSchema';

// -------------------------------------------------------------------
// Pure helpers
// -------------------------------------------------------------------

/**
 * levenshtein computes the edit distance between two strings using
 * the standard dynamic-programming algorithm.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Fast-path: one or both strings empty
  if (m === 0) return n;
  if (n === 0) return m;

  // Single-row DP — only the previous row is needed at any step.
  const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = i - 1; // value at [i-1][j-1]
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(
        row[j] + 1,      // deletion
        row[j - 1] + 1,  // insertion
        prev + cost,      // substitution
      );
      prev = row[j];
      row[j] = val;
    }
  }
  return row[n];
}

/**
 * findClosestField returns the valid field name closest to `fieldName`
 * within `maxDistance` (default 3). Returns undefined when no match is
 * close enough.
 */
export function findClosestField(
  fieldName: string,
  validFields: string[],
  maxDistance: number = 3,
): string | undefined {
  let best: string | undefined;
  let bestDist = maxDistance + 1;

  for (const candidate of validFields) {
    const d = levenshtein(fieldName, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

// -------------------------------------------------------------------
// Frontmatter parsing utilities
// -------------------------------------------------------------------

interface FrontmatterBounds {
  /** Line index of the opening `---`. */
  start: number;
  /** Line index of the closing `---`. */
  end: number;
}

/**
 * findFrontmatterBounds locates the --- delimited frontmatter block.
 * Returns null when no valid frontmatter is found.
 */
function findFrontmatterBounds(lines: string[]): FrontmatterBounds | null {
  if (lines.length === 0) return null;

  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        return { start: 0, end: i };
      }
    }
    return null;
  }

  // Pure YAML format — treat entire document as frontmatter when kind: is present
  const hasKind = lines.some((l) => /^kind:\s/.test(l.trim()));
  if (hasKind) {
    return { start: 0, end: lines.length - 1 };
  }

  return null;
}

/**
 * isInFrontmatter returns true when `line` falls strictly inside
 * frontmatter (between the delimiters, exclusive).
 */
function isInFrontmatter(
  line: number,
  bounds: FrontmatterBounds | null,
): boolean {
  if (!bounds) return false;
  // For --- delimited: line must be between start and end (exclusive)
  // For pure YAML: bounds.start === 0 and line 0 may contain kind:
  if (bounds.start === 0 && bounds.end === 0) return false;
  return line > bounds.start && line < bounds.end;
}

/**
 * isInFrontmatterInclusive returns true when `line` falls inside
 * frontmatter including delimiter lines for pure-YAML format.
 */
function isInFrontmatterInclusive(
  line: number,
  bounds: FrontmatterBounds | null,
  lines: string[],
): boolean {
  if (!bounds) return false;
  // For pure YAML (no --- delimiter): the entire range is content
  if (lines[0]?.trim() !== '---') {
    return line >= bounds.start && line <= bounds.end;
  }
  // For --- delimited: content lines are between delimiters
  return line > bounds.start && line < bounds.end;
}

/**
 * extractPresentFields collects all YAML field names found in the
 * frontmatter region of the document.
 */
function extractPresentFields(
  lines: string[],
  bounds: FrontmatterBounds,
): Set<string> {
  const fields = new Set<string>();
  const startLine = lines[0]?.trim() === '---' ? bounds.start + 1 : bounds.start;
  const endLine = lines[0]?.trim() === '---' ? bounds.end : bounds.end + 1;

  for (let i = startLine; i < endLine; i++) {
    const match = /^([a-zA-Z][\w-]*):\s*/.exec(lines[i] || '');
    if (match) {
      fields.add(match[1]);
    }
  }
  return fields;
}

/**
 * detectKindFromLines extracts the `kind:` value from frontmatter lines.
 */
function detectKindFromLines(
  lines: string[],
  bounds: FrontmatterBounds,
): string | null {
  const startLine = lines[0]?.trim() === '---' ? bounds.start + 1 : bounds.start;
  const endLine = lines[0]?.trim() === '---' ? bounds.end : bounds.end + 1;

  for (let i = startLine; i < endLine; i++) {
    const match = /^kind:\s*(.+)$/.exec(lines[i]?.trim() || '');
    if (match) {
      return match[1].replace(/^["']|["']$/g, '').trim().toLowerCase();
    }
  }
  return null;
}

// -------------------------------------------------------------------
// Quick fix computation
// -------------------------------------------------------------------

export interface QuickFixAction {
  title: string;
  kind: 'add-field' | 'fix-field' | 'quote-version';
  edit: {
    line: number;
    range?: { start: number; end: number };
    newText: string;
  };
}

/**
 * checkUnquotedVersion detects `version: 1.0` (unquoted) and returns
 * a quick-fix action to add quotes, or undefined.
 */
function checkUnquotedVersion(
  currentLine: string,
  line: number,
): QuickFixAction | undefined {
  const match = /^(\s*version:\s*)(\d+\.?\d*)(\s*)$/.exec(currentLine);
  if (!match) return undefined;
  const prefix = match[1];
  const number = match[2];
  return {
    title: 'Quote version number',
    kind: 'quote-version',
    edit: {
      line,
      range: { start: prefix.length, end: prefix.length + number.length },
      newText: `"${number}"`,
    },
  };
}

/**
 * checkUnknownField detects a field key not in the schema and suggests
 * the closest valid name, or returns undefined.
 */
function checkUnknownField(
  currentLine: string,
  line: number,
  schemaFields: SchemaField[],
): QuickFixAction | undefined {
  const match = /^([a-zA-Z][\w-]*):\s*/.exec(currentLine);
  if (!match) return undefined;
  const fieldName = match[1];
  const validNames = schemaFields.map((f) => f.name);
  if (validNames.includes(fieldName)) return undefined;
  const closest = findClosestField(fieldName, validNames);
  if (!closest) return undefined;
  return {
    title: `Fix field name: "${fieldName}" -> "${closest}"`,
    kind: 'fix-field',
    edit: {
      line,
      range: { start: 0, end: fieldName.length },
      newText: closest,
    },
  };
}

/**
 * checkMissingFields finds required schema fields that are absent from
 * the frontmatter and returns an add-field action for each.
 */
function checkMissingFields(
  lines: string[],
  bounds: FrontmatterBounds,
  schemaFields: SchemaField[],
): QuickFixAction[] {
  const presentFields = extractPresentFields(lines, bounds);
  const insertionLine = lines[0]?.trim() === '---' ? bounds.end : bounds.end + 1;

  return schemaFields
    .filter((f) => f.required && !presentFields.has(f.name))
    .map((field) => ({
      title: `Add missing required field: ${field.name}`,
      kind: 'add-field' as const,
      edit: {
        line: insertionLine,
        newText: `${field.name}: ${defaultPlaceholder(field)}\n`,
      },
    }));
}

/**
 * computeQuickFixes analyses the document text at the given line and
 * returns applicable quick-fix actions. This is a pure function that
 * does not depend on VS Code APIs.
 */
export function computeQuickFixes(
  text: string,
  line: number,
  schemaFields: SchemaField[],
): QuickFixAction[] {
  const lines = text.split('\n');
  const bounds = findFrontmatterBounds(lines);
  if (!bounds) return [];

  if (!isInFrontmatterInclusive(line, bounds, lines)) return [];

  const currentLine = lines[line] || '';
  const actions: QuickFixAction[] = [];

  const versionFix = checkUnquotedVersion(currentLine, line);
  if (versionFix) actions.push(versionFix);

  const fieldFix = checkUnknownField(currentLine, line, schemaFields);
  if (fieldFix) actions.push(fieldFix);

  actions.push(...checkMissingFields(lines, bounds, schemaFields));

  return actions;
}

/**
 * defaultPlaceholder returns a sensible placeholder value for a schema
 * field based on its type.
 */
function defaultPlaceholder(field: SchemaField): string {
  switch (field.type) {
    case 'string':
      return `"${field.name}"`;
    case 'bool':
      return 'false';
    case '[]string':
      return '[]';
    case 'map':
      return '{}';
    default:
      return '""';
  }
}

// -------------------------------------------------------------------
// VS Code CodeActionProvider
// -------------------------------------------------------------------

/**
 * XcafCodeActionProvider offers quick fixes for common .xcaf validation
 * issues. Registered for the xcaf document selector with QuickFix kind.
 */
export class XcafCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private schemaCache: XcafSchemaCache) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    const text = document.getText();
    const kind = this.detectKind(text);
    if (!kind) return [];

    const schema = this.schemaCache.getSchema(kind);
    if (!schema) return [];

    const fixes = computeQuickFixes(text, range.start.line, schema.fields);
    return fixes.map((fix) => this.toCodeAction(fix, document));
  }

  // ----------------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------------

  private detectKind(text: string): string | null {
    const lines = text.split('\n');
    const bounds = findFrontmatterBounds(lines);
    if (!bounds) return null;
    return detectKindFromLines(lines, bounds);
  }

  private toCodeAction(
    fix: QuickFixAction,
    document: vscode.TextDocument,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      fix.title,
      vscode.CodeActionKind.QuickFix,
    );
    action.isPreferred = fix.kind === 'quote-version';

    const edit = new vscode.WorkspaceEdit();

    if (fix.edit.range) {
      // Replace a specific range on the line
      const vscRange = new vscode.Range(
        fix.edit.line,
        fix.edit.range.start,
        fix.edit.line,
        fix.edit.range.end,
      );
      edit.replace(document.uri, vscRange, fix.edit.newText);
    } else {
      // Insert at the beginning of the line
      const pos = new vscode.Position(fix.edit.line, 0);
      edit.insert(document.uri, pos, fix.edit.newText);
    }

    action.edit = edit;
    return action;
  }
}
