import * as vscode from 'vscode';
import { XcafSchemaCache, KNOWN_KINDS } from './xcafSchema';

export interface CompletionContext {
  inFrontmatter: boolean;
  currentKind: string | null;
  linePrefix: string;
  contextType:
    | 'kind-value'
    | 'field-name'
    | 'version-value'
    | 'boolean-value'
    | 'tool-value'
    | 'unknown';
}

const COMMON_TOOLS = ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'];

/**
 * findFrontmatterBounds returns the start and end line indices of the
 * frontmatter region. Returns null if no frontmatter delimiters exist.
 */
function findFrontmatterBounds(
  lines: string[],
): { start: number; end: number } | null {
  if (lines[0]?.trim() !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { start: 0, end: i };
    }
  }
  return null;
}

/**
 * extractKind scans frontmatter lines for a `kind:` declaration and
 * returns its value, or null if not found.
 */
function extractKind(lines: string[], bounds: { start: number; end: number }): string | null {
  const kindRe = /^kind:\s*(.+)$/;
  for (let i = bounds.start + 1; i < bounds.end; i++) {
    const match = kindRe.exec(lines[i].trim());
    if (match) {
      return match[1].replace(/^["']|["']$/g, '').trim().toLowerCase();
    }
  }
  return null;
}

/**
 * detectFieldType returns the schema type for a YAML key on the current
 * line, given the kind schema fields. Returns null if unrecognized.
 */
function detectFieldType(
  linePrefix: string,
  schemaCache: XcafSchemaCache,
  kind: string | null,
): string | null {
  if (!kind) return null;
  const keyMatch = /^(\S+):\s*/.exec(linePrefix);
  if (!keyMatch) return null;
  const field = schemaCache.getField(kind, keyMatch[1]);
  return field?.type ?? null;
}

/**
 * detectCompletionContext analyzes document text and cursor position to
 * determine what type of completion to offer. Pure function for testing.
 */
export function detectCompletionContext(
  text: string,
  line: number,
  character: number,
): CompletionContext {
  const lines = text.split('\n');
  const lineText = lines[line] ?? '';
  const linePrefix = lineText.slice(0, character);
  const bounds = findFrontmatterBounds(lines);

  if (!bounds || line <= bounds.start || line >= bounds.end) {
    return { inFrontmatter: false, currentKind: null, linePrefix, contextType: 'unknown' };
  }

  const currentKind = extractKind(lines, bounds);
  const base = { inFrontmatter: true, currentKind, linePrefix };

  if (/^kind:\s+/.test(linePrefix)) {
    return { ...base, contextType: 'kind-value' };
  }

  if (/^version:\s+/.test(linePrefix)) {
    return { ...base, contextType: 'version-value' };
  }

  if (/(?:tools|allowed-tools):\s*\[/.test(linePrefix)) {
    return { ...base, contextType: 'tool-value' };
  }

  const trimmed = linePrefix.trim();
  if (trimmed === '' || /^[a-zA-Z][a-zA-Z0-9-]*$/.test(trimmed)) {
    return { ...base, contextType: 'field-name' };
  }

  return { ...base, contextType: 'unknown' };
}

/**
 * buildKindCompletions returns CompletionItems for all known xcaf kinds.
 */
function buildKindCompletions(): vscode.CompletionItem[] {
  return KNOWN_KINDS.map((kind) => {
    const item = new vscode.CompletionItem(kind, vscode.CompletionItemKind.EnumMember);
    item.detail = `xcaf resource kind`;
    return item;
  });
}

/**
 * buildFieldCompletions returns CompletionItems for valid fields of the
 * given resource kind.
 */
function buildFieldCompletions(
  schemaCache: XcafSchemaCache,
  kind: string,
): vscode.CompletionItem[] {
  const schema = schemaCache.getSchema(kind);
  if (!schema) return [];
  return schema.fields.map((field) => {
    const item = new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Field);
    item.detail = field.description;
    item.insertText = `${field.name}: `;
    return item;
  });
}

/**
 * buildToolCompletions returns CompletionItems for common tool names.
 */
function buildToolCompletions(): vscode.CompletionItem[] {
  return COMMON_TOOLS.map((tool) => {
    const item = new vscode.CompletionItem(tool, vscode.CompletionItemKind.Constant);
    item.detail = 'Tool name';
    return item;
  });
}

/**
 * buildBooleanCompletions returns CompletionItems for true/false.
 */
function buildBooleanCompletions(): vscode.CompletionItem[] {
  return ['true', 'false'].map((val) => {
    return new vscode.CompletionItem(val, vscode.CompletionItemKind.Value);
  });
}

/**
 * buildVersionCompletions returns a CompletionItem for the default version.
 */
function buildVersionCompletions(): vscode.CompletionItem[] {
  const item = new vscode.CompletionItem('"1.0"', vscode.CompletionItemKind.Value);
  item.detail = 'Schema version';
  return [item];
}

/**
 * XcafCompletionProvider provides autocomplete suggestions for .xcaf files.
 * Suggests kind values, field names, version, boolean values, and tool names
 * based on cursor context within frontmatter.
 */
export class XcafCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private schemaCache: XcafSchemaCache) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    const text = document.getText();
    const ctx = detectCompletionContext(text, position.line, position.character);

    if (!ctx.inFrontmatter) return [];

    switch (ctx.contextType) {
      case 'kind-value':
        return buildKindCompletions();
      case 'field-name':
        return ctx.currentKind
          ? buildFieldCompletions(this.schemaCache, ctx.currentKind)
          : [];
      case 'version-value':
        return buildVersionCompletions();
      case 'boolean-value':
        return buildBooleanCompletions();
      case 'tool-value':
        return buildToolCompletions();
      default:
        return [];
    }
  }
}
