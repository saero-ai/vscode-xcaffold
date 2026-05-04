import * as vscode from 'vscode';

export interface FrontmatterResult {
  kind: string;
  name: string;
  nameLine: number; // 0-indexed line number of the name field
}

export interface XcfEntry {
  kind: string;
  name: string;
  fileUri: string;
  nameLine: number;
}

/**
 * parseFrontmatter extracts kind and name from .xcf file content.
 * Handles both frontmatter-delimited (---) and pure YAML formats (project kind only).
 * Returns null if kind or name cannot be determined.
 */
export function parseFrontmatter(content: string): FrontmatterResult | null {
  const lines = content.split('\n');

  let startLine = 0;
  let endLine = lines.length;
  let hasFrontmatterDelimiter = false;

  // Check for frontmatter delimiters
  if (lines[0]?.trim() === '---') {
    hasFrontmatterDelimiter = true;
    startLine = 1;
    const closingIdx = lines.indexOf('---', 1);
    if (closingIdx === -1) {
      return null;
    }
    endLine = closingIdx;
  }

  let kind: string | null = null;
  let name: string | null = null;
  let nameLine = -1;

  const kindRe = /^kind:\s*(.+)$/;
  const nameRe = /^name:\s*(.+)$/;

  for (let i = startLine; i < endLine; i++) {
    const line = lines[i].trim();

    const kindMatch = kindRe.exec(line);
    if (kindMatch) {
      kind = kindMatch[1].replace(/^["']|["']$/g, '').trim().toLowerCase();
      continue;
    }

    const nameMatch = nameRe.exec(line);
    if (nameMatch) {
      name = nameMatch[1].replace(/^["']|["']$/g, '').trim();
      nameLine = i;
    }
  }

  if (!kind || !name || nameLine === -1) {
    return null;
  }

  // Pure YAML format (without ---) is only valid for project kind
  if (!hasFrontmatterDelimiter && kind !== 'project') {
    return null;
  }

  return { kind, name, nameLine };
}

/**
 * XcfIndex maps {kind, name} pairs to file locations.
 * Used by tree view (click-to-open) and definition provider (go-to-def).
 */
export class XcfIndex {
  // key: "kind:name" -> entry
  private entries = new Map<string, XcfEntry>();
  // reverse index: fileUri -> list of keys
  private fileToKeys = new Map<string, string[]>();

  private makeKey(kind: string, name: string): string {
    return `${kind}:${name}`;
  }

  setEntry(entry: XcfEntry): void {
    const key = this.makeKey(entry.kind, entry.name);
    this.entries.set(key, entry);

    const keys = this.fileToKeys.get(entry.fileUri) || [];
    if (!keys.includes(key)) {
      keys.push(key);
    }
    this.fileToKeys.set(entry.fileUri, keys);
  }

  resolve(kind: string, name: string): XcfEntry | undefined {
    return this.entries.get(this.makeKey(kind, name));
  }

  resolveByName(name: string): XcfEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.name === name) {
        return entry;
      }
    }
    return undefined;
  }

  removeByUri(fileUri: string): void {
    const keys = this.fileToKeys.get(fileUri);
    if (keys) {
      for (const key of keys) {
        this.entries.delete(key);
      }
      this.fileToKeys.delete(fileUri);
    }
  }

  clear(): void {
    this.entries.clear();
    this.fileToKeys.clear();
  }

  allEntries(): XcfEntry[] {
    return Array.from(this.entries.values());
  }
}
