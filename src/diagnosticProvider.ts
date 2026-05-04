import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('xcaffold');

/**
 * parseValidateOutput converts xcaffold validate stderr into VS Code Diagnostic objects.
 */
export function parseValidateOutput(output: string, filePath: string): vscode.Diagnostic[] {
  if (!output.trim()) return [];

  const diags: vscode.Diagnostic[] = [];
  const fileName = path.basename(filePath);
  
  // Pattern: filename.xcf:LINE:COL: message
  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`${escapedFileName}:(\\d+):(\\d+):\\s*(.+)`);

  let matched = false;
  for (const line of output.split('\n')) {
    const m = lineRe.exec(line);
    if (m) {
      const lineNo = Math.max(0, parseInt(m[1], 10) - 1);
      const colNo = Math.max(0, parseInt(m[2], 10) - 1);
      const msg = m[3].trim();
      const range = new vscode.Range(lineNo, colNo, lineNo, colNo + 1);
      diags.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error));
      matched = true;
    }
  }

  // Fallback: if no specific line match but we have output, show it at the top of the file
  if (!matched && output.includes('Validation failed')) {
    const range = new vscode.Range(0, 0, 0, 1);
    diags.push(new vscode.Diagnostic(range, output.trim(), vscode.DiagnosticSeverity.Error));
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
      await cli.run(['validate'], workspaceFolder);
      diagnosticCollection.set(doc.uri, []);
    } catch (err: any) {
      const output = err.stdout ?? err.stderr ?? err.message ?? '';
      const fileName = path.basename(doc.fileName);
      if (output.includes(fileName)) {
        const diags = parseValidateOutput(output, doc.fileName);
        diagnosticCollection.set(doc.uri, diags);
      } else {
        diagnosticCollection.set(doc.uri, []);
      }
    }
  });

  return vscode.Disposable.from(listener, diagnosticCollection);
}
