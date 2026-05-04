import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('xcaffold');

/**
 * parseValidateOutput converts xcaffold validate stderr into VS Code Diagnostic objects.
 */
export function parseValidateOutput(stderr: string, filePath: string): vscode.Diagnostic[] {
  if (!stderr.trim()) return [];

  const diags: vscode.Diagnostic[] = [];
  const fileName = path.basename(filePath);
  
  // Pattern: filename.xcf:LINE:COL: message
  // We use a regex that matches the filename followed by line and column numbers.
  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`${escapedFileName}:(\\d+):(\\d+):\\s*(.+)`);

  for (const line of stderr.split('\n')) {
    const m = lineRe.exec(line);
    if (!m) continue;
    
    const lineNo = Math.max(0, parseInt(m[1], 10) - 1);
    const colNo = Math.max(0, parseInt(m[2], 10) - 1);
    const msg = m[3].trim();
    
    // Create a range for the error (single character at the start of the error)
    const range = new vscode.Range(lineNo, colNo, lineNo, colNo + 1);
    diags.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error));
  }

  return diags;
}

/**
 * registerDiagnosticProvider sets up the validate-on-save behavior.
 */
export function registerDiagnosticProvider(cli: XcaffoldCli): vscode.Disposable {
  const listener = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (!doc.fileName.endsWith('.xcf')) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(doc.fileName);

    try {
      // Run 'xcaffold validate' on the saved file
      await cli.run(['validate', '--file', doc.fileName], workspaceFolder);
      // If success, clear previous diagnostics
      diagnosticCollection.set(doc.uri, []);
    } catch (err: any) {
      // If error, parse stderr and show diagnostics
      const diags = parseValidateOutput(err.stderr ?? '', doc.fileName);
      diagnosticCollection.set(doc.uri, diags);
    }
  });

  return vscode.Disposable.from(listener, diagnosticCollection);
}
