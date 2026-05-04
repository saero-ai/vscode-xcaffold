import * as vscode from 'vscode';
import { XcfIndex } from './xcfIndex';

export interface ReferenceContext {
  refKind: string; // singular: "skill", "rule", "agent"
}

export interface DefinitionResult {
  uri: string;
  line: number;
}

// Characters that are valid inside an xcf resource name
const NAME_CHARS = /[a-zA-Z0-9_-]/;

/**
 * extractWordAt extracts the word (resource name) at a given character
 * position within a line. Handles unquoted, double-quoted, and
 * single-quoted names.
 */
export function extractWordAt(line: string, character: number): string {
  if (character < 0 || character >= line.length) {
    return '';
  }

  const ch = line[character];

  // If cursor is on a quote, bracket, comma, colon, or space, no word
  if (!NAME_CHARS.test(ch)) {
    return '';
  }

  // Expand left
  let start = character;
  while (start > 0 && NAME_CHARS.test(line[start - 1])) {
    start--;
  }

  // Expand right
  let end = character;
  while (end < line.length - 1 && NAME_CHARS.test(line[end + 1])) {
    end++;
  }

  const word = line.slice(start, end + 1);

  // Strip surrounding quotes if the word was inside them
  if (start > 0 && start - 1 >= 0) {
    const leftChar = line[start - 1];
    if ((leftChar === '"' || leftChar === "'") && end + 1 < line.length && line[end + 1] === leftChar) {
      // Word is properly quoted, already stripped -- return as-is
    }
  }

  return word;
}

/**
 * Mapping from YAML array key to the singular kind name for index lookup.
 */
const REF_KEY_TO_KIND: Record<string, string> = {
  skills: 'skill',
  rules: 'rule',
  agents: 'agent',
};

/**
 * detectReferenceContext determines whether a given line is within a
 * reference array (skills:, rules:, agents:) and returns the referenced
 * kind. Handles both inline arrays and multi-line dash syntax.
 */
export function detectReferenceContext(
  lines: string[],
  lineNumber: number,
): ReferenceContext | null {
  const line = lines[lineNumber];
  if (!line) {
    return null;
  }

  const trimmed = line.trimStart();

  // Check inline array: "skills: [tdd, code-review]"
  for (const [key, kind] of Object.entries(REF_KEY_TO_KIND)) {
    const inlineRe = new RegExp(`^${key}:\\s*\\[`);
    if (inlineRe.test(trimmed)) {
      return { refKind: kind };
    }
  }

  // Check multi-line dash syntax: "  - tdd" under a "skills:" parent
  if (trimmed.startsWith('- ') || trimmed === '-') {
    // Walk backward to find the parent key
    for (let i = lineNumber - 1; i >= 0; i--) {
      const prevLine = lines[i];
      const prevTrimmed = prevLine.trimStart();

      // If we hit another top-level key, that is the parent
      for (const [key, kind] of Object.entries(REF_KEY_TO_KIND)) {
        if (prevTrimmed.startsWith(`${key}:`)) {
          return { refKind: kind };
        }
      }

      // If the line is not a dash item and not empty, stop searching
      if (prevTrimmed.length > 0 && !prevTrimmed.startsWith('- ') && prevTrimmed !== '-') {
        break;
      }
    }
  }

  return null;
}

/**
 * resolveDefinition attempts to find the definition file and line for
 * a word at a given position. Uses kind-aware context when available,
 * falls back to name-only lookup.
 */
export function resolveDefinition(
  index: XcfIndex,
  lines: string[],
  lineNumber: number,
  character: number,
): DefinitionResult | null {
  const line = lines[lineNumber];
  if (!line) {
    return null;
  }

  const word = extractWordAt(line, character);
  if (!word) {
    return null;
  }

  // Try kind-aware lookup first (refKind is singular lowercase: skill, rule, agent)
  const refCtx = detectReferenceContext(lines, lineNumber);
  if (refCtx) {
    const entry = index.resolve(refCtx.refKind, word);
    if (entry) {
      return { uri: entry.fileUri, line: entry.nameLine };
    }
  }

  // Fallback: name-only lookup across all kinds
  const entry = index.resolveByName(word);
  if (entry) {
    return { uri: entry.fileUri, line: entry.nameLine };
  }

  return null;
}

/**
 * XcfDefinitionProvider implements go-to-definition for .xcf files.
 * Ctrl+click / F12 on a resource name (inside skills:, rules:, agents:
 * arrays) jumps to the corresponding .xcf file.
 */
export class XcfDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private xcfIndex: XcfIndex) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition | null {
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push(document.lineAt(i).text);
    }

    const result = resolveDefinition(
      this.xcfIndex,
      lines,
      position.line,
      position.character,
    );

    if (!result) {
      return null;
    }

    return new vscode.Location(
      vscode.Uri.file(result.uri),
      new vscode.Position(result.line, 0),
    );
  }
}
