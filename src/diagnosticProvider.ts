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
      // Run 'xcaffold validate' on the saved folder (validator resolves project.xcf)
      await cli.run(['validate'], workspaceFolder);
      // If success, clear previous diagnostics
      diagnosticCollection.set(doc.uri, []);
    } catch (err: any) {
      // The CLI validator currently doesn't provide stable line numbers in a parseable format
      // that matches filename:line:col. We report a workspace-level diagnostic on project.xcf
      // if available, or just clear if we can't map it.
      const diags = parseValidateOutput(err.stdout ?? err.message ?? '', doc.fileName);
      diagnosticCollection.set(doc.uri, diags);
    }
  });

  return vscode.Disposable.from(listener, diagnosticCollection);
}
