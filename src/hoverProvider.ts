import * as vscode from 'vscode';
import { XcafSchemaCache, SchemaField, KNOWN_KINDS } from './xcafSchema';
import { parseFrontmatter } from './xcafIndex';

export interface HoverInfo {
  fieldName: string | null;
  kindValue: string | null;
  inFrontmatter: boolean;
}

/** Descriptions for each resource kind shown on kind: value hover. */
const KIND_DESCRIPTIONS: Record<string, string> = {
  agent: 'An autonomous agent with tools, model, and behavioral instructions.',
  skill: 'A reusable capability that can be invoked by agents or users.',
  rule: 'A behavioral constraint applied to conversations or workflows.',
  workflow: 'A multi-step orchestration of agents and skills.',
  mcp: 'A Model Context Protocol server configuration.',
  project: 'Top-level project configuration for an xcaffold workspace.',
  settings: 'Provider-specific settings and permissions.',
  hooks: 'Lifecycle hooks that run shell commands on events.',
  global: 'Global configuration applied across all projects.',
  policy: 'Enforcement policies for code quality and compliance.',
  blueprint: 'A composition of multiple resources into a reusable template.',
};

/**
 * detectHoverTarget determines what the user is hovering over within
 * an xcaf document. Returns whether the cursor is inside frontmatter,
 * and extracts the YAML key name or kind value under the cursor.
 */
export function detectHoverTarget(
  text: string,
  line: number,
  character: number,
): HoverInfo {
  const lines = text.split('\n');
  const result: HoverInfo = { fieldName: null, kindValue: null, inFrontmatter: false };

  if (line < 0 || line >= lines.length) return result;

  const fmBounds = findFrontmatterBounds(lines);
  if (!fmBounds || line < fmBounds.start || line > fmBounds.end) {
    return result;
  }
  result.inFrontmatter = true;

  const currentLine = lines[line];
  const colonIdx = currentLine.indexOf(':');
  if (colonIdx === -1) return result;

  const key = currentLine.slice(0, colonIdx).trim();

  // Hovering over the key portion (before the colon)?
  if (character <= colonIdx && key.length > 0) {
    result.fieldName = key;
    return result;
  }

  // Hovering over a kind: value?
  if (key === 'kind') {
    const rawValue = currentLine.slice(colonIdx + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '').trim().toLowerCase();
    if (value && character > colonIdx) {
      result.kindValue = value;
    }
  }

  return result;
}

/**
 * findFrontmatterBounds returns the start and end line indices of
 * the YAML frontmatter region. Supports --- delimited and pure YAML
 * (project kind) formats.
 */
function findFrontmatterBounds(
  lines: string[],
): { start: number; end: number } | null {
  if (lines.length === 0) return null;

  // Frontmatter-delimited format
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        return { start: 0, end: i };
      }
    }
    return null;
  }

  // Pure YAML format — check if any line has kind:
  const hasKind = lines.some((l) => /^kind:\s/.test(l.trim()));
  if (hasKind) {
    return { start: 0, end: lines.length - 1 };
  }

  return null;
}

/**
 * formatFieldHover produces a Markdown string describing a schema field.
 */
export function formatFieldHover(field: SchemaField): string {
  const badge = field.required ? '`required`' : '`optional`';
  const parts = [
    `**${field.name}** — \`${field.type}\` ${badge}`,
    '',
    field.description,
  ];
  if (field.group) {
    parts.push('', `*Group: ${field.group}*`);
  }
  return parts.join('\n');
}

/** Top-level field summary for each resource kind. */
const KIND_FIELD_SUMMARY: Record<string, string[]> = {
  agent: ['model', 'tools', 'references', 'targets'],
  skill: ['trigger', 'allowed-tools', 'references'],
  rule: ['always-apply', 'targets'],
  workflow: ['steps', 'triggers'],
  mcp: ['command', 'args', 'env', 'targets'],
  project: ['vars', 'providers', 'blueprints'],
  settings: ['permission-mode', 'allowed-tools'],
  hooks: ['pre-tool-use', 'post-tool-use', 'notification'],
  global: ['providers'],
  policy: ['rules', 'enforcement'],
  blueprint: ['include', 'exclude', 'depends-on'],
};

/** Format a kind description for hover display. */
function formatKindHover(kindValue: string): string | null {
  const desc = KIND_DESCRIPTIONS[kindValue];
  if (!desc) return null;
  const fields = KIND_FIELD_SUMMARY[kindValue];
  const fieldLine = fields?.length
    ? `\n\n**Common fields:** \`${fields.join('`, `')}\``
    : '';
  return `**kind: ${kindValue}**\n\n${desc}${fieldLine}`;
}

/**
 * XcafHoverProvider shows tooltip documentation when hovering over
 * YAML keys or kind values in .xcaf manifest files.
 */
export class XcafHoverProvider implements vscode.HoverProvider {
  constructor(private schemaCache: XcafSchemaCache) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | null {
    const text = document.getText();
    const info = detectHoverTarget(text, position.line, position.character);

    if (!info.inFrontmatter) return null;

    const fm = parseFrontmatter(text);
    const kind = fm?.kind ?? '';

    if (info.kindValue) {
      const md = formatKindHover(info.kindValue);
      if (md) return new vscode.Hover(new vscode.MarkdownString(md));
    }

    if (info.fieldName) {
      const field = this.schemaCache.getField(kind, info.fieldName);
      if (field) {
        const md = formatFieldHover(field);
        return new vscode.Hover(new vscode.MarkdownString(md));
      }
    }

    return null;
  }
}
