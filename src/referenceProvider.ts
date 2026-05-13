import * as vscode from 'vscode';
import { XcafIndex } from './xcafIndex';
import { extractWordAt } from './definitionProvider';

/**
 * A single reference match within a text: line number and character span.
 */
export interface TextReference {
  line: number;
  startChar: number;
  endChar: number;
}

/**
 * buildWordBoundaryPattern returns a RegExp that matches resourceName
 * as a whole word — not as a substring of a longer name.
 * Boundaries: start/end of string, whitespace, brackets, commas, colons, quotes.
 */
function buildWordBoundaryPattern(resourceName: string): RegExp {
  const escaped = resourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the name when surrounded by non-name characters or line edges.
  // Name chars are [a-zA-Z0-9_-], so the boundary is anything else.
  return new RegExp(`(?<![a-zA-Z0-9_-])${escaped}(?![a-zA-Z0-9_-])`, 'g');
}

/**
 * findReferencesInText scans text line by line for whole-word occurrences
 * of resourceName. Skips comment lines (lines whose first non-whitespace
 * character is #).
 */
export function findReferencesInText(
  text: string,
  resourceName: string,
): TextReference[] {
  const results: TextReference[] = [];
  if (!resourceName) {
    return results;
  }

  const pattern = buildWordBoundaryPattern(resourceName);
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('#')) {
      continue;
    }

    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      results.push({
        line: i,
        startChar: match.index,
        endChar: match.index + resourceName.length,
      });
    }
  }

  return results;
}

/**
 * XcafReferenceProvider implements "Find All References" for .xcaf files.
 * Right-click a resource name and select "Find All References" to see
 * every .xcaf file that references that resource.
 */
export class XcafReferenceProvider implements vscode.ReferenceProvider {
  constructor(private xcafIndex: XcafIndex) {}

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
  ): Promise<vscode.Location[]> {
    const line = document.lineAt(position.line).text;
    const word = extractWordAt(line, position.character);
    if (!word) {
      return [];
    }

    const files = await vscode.workspace.findFiles(
      '**/*.xcaf',
      '**/node_modules/**',
    );

    const locations: vscode.Location[] = [];

    for (const fileUri of files) {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const refs = findReferencesInText(doc.getText(), word);

      for (const ref of refs) {
        const isDeclaration = this.isNameDeclaration(doc, ref);
        if (!isDeclaration || context.includeDeclaration) {
          locations.push(
            new vscode.Location(
              fileUri,
              new vscode.Position(ref.line, ref.startChar),
            ),
          );
        }
      }
    }

    return locations;
  }

  /**
   * isNameDeclaration checks whether a reference match is on a `name:` line,
   * indicating it is the resource's own declaration rather than a usage.
   */
  private isNameDeclaration(
    doc: vscode.TextDocument,
    ref: TextReference,
  ): boolean {
    const lineText = doc.lineAt(ref.line).text.trimStart();
    return lineText.startsWith('name:');
  }
}
