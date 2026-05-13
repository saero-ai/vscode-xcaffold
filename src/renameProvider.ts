import * as vscode from 'vscode';
import { XcafIndex } from './xcafIndex';
import { extractWordAt } from './definitionProvider';
import { findReferencesInText } from './referenceProvider';

/** Pattern for valid xcaf resource names: lowercase alphanumeric with hyphens. */
const RESOURCE_NAME_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * validateResourceName checks whether a string is a valid xcaf resource name.
 * Valid: lowercase letters, digits, hyphens; must not start or end with hyphen.
 */
export function validateResourceName(
  name: string,
): { valid: boolean; reason?: string } {
  if (!name) {
    return { valid: false, reason: 'Name must not be empty' };
  }
  if (name.startsWith('-') || name.endsWith('-')) {
    return { valid: false, reason: 'Name must not start or end with a hyphen' };
  }
  if (!RESOURCE_NAME_RE.test(name)) {
    return {
      valid: false,
      reason: 'Name must match [a-z0-9-] (lowercase, digits, hyphens only)',
    };
  }
  return { valid: true };
}

/**
 * XcafRenameProvider enables F2 rename of resource names across .xcaf files.
 * Validates that the cursor is on a known resource name, checks the new name
 * against xcaf naming conventions, and builds a WorkspaceEdit covering all
 * occurrences in the workspace.
 */
export class XcafRenameProvider implements vscode.RenameProvider {
  constructor(private xcafIndex: XcafIndex) {}

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Range | null {
    const line = document.lineAt(position.line).text;
    const word = extractWordAt(line, position.character);
    if (!word) {
      return null;
    }

    const entry = this.xcafIndex.resolveByName(word);
    if (!entry) {
      return null;
    }

    const start = line.indexOf(word, position.character - word.length);
    if (start === -1) {
      return null;
    }

    return new vscode.Range(
      position.line, start,
      position.line, start + word.length,
    );
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
  ): Promise<vscode.WorkspaceEdit> {
    const edit = new vscode.WorkspaceEdit();

    const line = document.lineAt(position.line).text;
    const oldName = extractWordAt(line, position.character);
    if (!oldName) {
      return edit;
    }

    const validation = validateResourceName(newName);
    if (!validation.valid) {
      return edit;
    }

    const files = await vscode.workspace.findFiles(
      '**/*.xcaf',
      '**/node_modules/**',
    );

    for (const fileUri of files) {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const refs = findReferencesInText(doc.getText(), oldName);
      for (const ref of refs) {
        const range = new vscode.Range(
          ref.line, ref.startChar,
          ref.line, ref.endChar,
        );
        edit.replace(fileUri, range, newName);
      }
    }

    return edit;
  }
}
