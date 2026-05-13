import * as vscode from 'vscode';

export interface KindLine {
  line: number;
  kind: string;
}

const KIND_RE = /^kind:\s*(\w+)\s*$/;

/**
 * detectKindLines scans document lines for top-level `kind:` declarations.
 * Only matches lines within frontmatter (before second `---`) or in pure YAML
 * (no frontmatter delimiters). Ignores commented, indented, and body lines.
 */
export function detectKindLines(lines: string[]): KindLine[] {
  const result: KindLine[] = [];
  let inFrontmatter = false;
  let frontmatterClosed = false;
  let hasFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Track frontmatter boundaries
    if (raw.trim() === '---') {
      if (!hasFrontmatter) {
        hasFrontmatter = true;
        inFrontmatter = true;
        continue;
      } else if (inFrontmatter) {
        frontmatterClosed = true;
        break;
      }
    }

    // Skip lines after frontmatter body starts
    if (frontmatterClosed) {
      break;
    }

    // Skip commented lines
    if (raw.trimStart().startsWith('#')) {
      continue;
    }

    // Skip indented lines (nested YAML keys)
    if (raw.length > 0 && (raw[0] === ' ' || raw[0] === '\t')) {
      continue;
    }

    const match = KIND_RE.exec(raw.trim());
    if (match) {
      result.push({ line: i, kind: match[1] });
    }
  }

  return result;
}

/**
 * buildCodeLenses creates Apply and Validate CodeLens items for each kind: line.
 */
export function buildCodeLenses(kindLines: KindLine[]): vscode.CodeLens[] {
  const lenses: vscode.CodeLens[] = [];

  for (const kl of kindLines) {
    const range = new vscode.Range(
      new vscode.Position(kl.line, 0),
      new vscode.Position(kl.line, 0),
    );

    lenses.push(
      new vscode.CodeLens(range, {
        title: 'Apply',
        command: 'xcaffold.apply',
        arguments: [],
      }),
    );

    lenses.push(
      new vscode.CodeLens(range, {
        title: 'Validate',
        command: 'xcaffold.validate',
        arguments: [],
      }),
    );
  }

  return lenses;
}

/**
 * XcafCodeLensProvider shows Apply and Validate actions above kind: lines
 * in .xcaf files.
 */
export class XcafCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.CodeLens[] {
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push(document.lineAt(i).text);
    }
    const kindLines = detectKindLines(lines);
    return buildCodeLenses(kindLines);
  }
}
