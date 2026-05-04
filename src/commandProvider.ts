import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';
import { parseValidateOutput } from './diagnosticProvider';

export interface CommandDef {
  id: string;
  args: string[];
}

/**
 * Provider targets for the apply quick pick.
 * "All Providers" is the default first option (no --target flag).
 */
export const PROVIDER_TARGETS: string[] = [
  'All Providers',
  'claude',
  'cursor',
  'copilot',
  'gemini',
  'antigravity',
];

/**
 * buildApplyArgs constructs CLI arguments for apply.
 * Returns ['apply'] for "All Providers", or ['apply', '--target', provider] otherwise.
 */
export function buildApplyArgs(selection: string): string[] {
  if (selection === 'All Providers') {
    return ['apply'];
  }
  return ['apply', '--target', selection];
}

/**
 * Diagnostic type for test environments where vscode.Diagnostic may be mocked.
 */
export interface FileDiagnostic {
  line: number;
  col: number;
  message: string;
}

/**
 * filterDiagnosticsForFile runs parseValidateOutput and filters results
 * to only those matching the given file path's basename.
 */
export function filterDiagnosticsForFile(
  output: string,
  filePath: string
): FileDiagnostic[] {
  if (!output.trim()) {
    return [];
  }

  const fileName = path.basename(filePath);
  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`${escapedFileName}:(\\d+):(\\d+):\\s*(.+)`);

  const results: FileDiagnostic[] = [];
  let matched = false;

  for (const line of output.split('\n')) {
    const m = lineRe.exec(line);
    if (m) {
      results.push({
        line: Math.max(0, parseInt(m[1], 10) - 1),
        col: Math.max(0, parseInt(m[2], 10) - 1),
        message: m[3].trim(),
      });
      matched = true;
    }
  }

  // Fallback: if output mentions the filename but no line:col match
  if (!matched && output.includes(fileName)) {
    results.push({
      line: 0,
      col: 0,
      message: output.trim(),
    });
  }

  return results;
}

/**
 * Commands handled by the generic passthrough loop.
 * xcaffold.apply is excluded — it uses the target picker.
 */
export const XCAFFOLD_COMMANDS: CommandDef[] = [
  { id: 'xcaffold.apply', args: ['apply'] },
  { id: 'xcaffold.validate', args: ['validate'] },
  { id: 'xcaffold.status', args: ['status'] },
  { id: 'xcaffold.list', args: ['list'] },
  { id: 'xcaffold.import', args: ['import'] },
];

const GENERIC_COMMANDS: CommandDef[] = XCAFFOLD_COMMANDS.filter(
  (c) => c.id !== 'xcaffold.apply'
);

/**
 * registerCommandProvider registers all xcaffold commands to the VS Code
 * command palette. The apply command shows a target provider picker first.
 */
export function registerCommandProvider(cli: XcaffoldCli): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  // Apply with target picker
  const applyDisposable = vscode.commands.registerCommand(
    'xcaffold.apply',
    async () => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }

      const selection = await vscode.window.showQuickPick(PROVIDER_TARGETS, {
        placeHolder: 'Select target provider (or All Providers)',
        title: 'xcaffold: Apply to which provider?',
      });

      if (!selection) {
        return; // user cancelled
      }

      const args = buildApplyArgs(selection);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `xcaffold: Applying to ${selection}...`,
          cancellable: false,
        },
        async () => {
          try {
            await cli.run(args, workspaceFolder);
            vscode.window.showInformationMessage(
              `xcaffold: apply completed for ${selection}.`
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(`xcaffold error: ${err.message}`);
          }
        }
      );
    }
  );
  disposables.push(applyDisposable);

  // Generic passthrough commands
  for (const cmd of GENERIC_COMMANDS) {
    const d = vscode.commands.registerCommand(cmd.id, async () => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `xcaffold: Running '${cmd.args[0]}'...`,
          cancellable: false,
        },
        async () => {
          try {
            await cli.run(cmd.args, workspaceFolder);
            vscode.window.showInformationMessage(
              `xcaffold: ${cmd.args[0]} completed successfully.`
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(`xcaffold error: ${err.message}`);
          }
        }
      );
    });
    disposables.push(d);
  }

  // Validate active file
  const validateFileDisposable = vscode.commands.registerCommand(
    'xcaffold.validateFile',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          'xcaffold: No active editor.'
        );
        return;
      }

      const filePath = editor.document.fileName;
      if (!filePath.endsWith('.xcf')) {
        vscode.window.showErrorMessage(
          'xcaffold: Active file is not an .xcf manifest.'
        );
        return;
      }

      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
        path.dirname(filePath);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `xcaffold: Validating ${path.basename(filePath)}...`,
          cancellable: false,
        },
        async () => {
          try {
            await cli.run(['validate'], workspaceFolder);
            vscode.window.showInformationMessage(
              `xcaffold: ${path.basename(filePath)} is valid.`
            );
          } catch (err: any) {
            const output: string =
              err.stderr || err.stdout || err.message || '';
            const diags = filterDiagnosticsForFile(output, filePath);
            if (diags.length > 0) {
              const summary = diags
                .map((d) => `Line ${d.line + 1}: ${d.message}`)
                .join('\n');
              vscode.window.showErrorMessage(
                `xcaffold: ${path.basename(filePath)} has errors:\n${summary}`
              );
            } else {
              vscode.window.showErrorMessage(
                `xcaffold validate error: ${err.message}`
              );
            }
          }
        }
      );
    }
  );
  disposables.push(validateFileDisposable);

  return vscode.Disposable.from(...disposables);
}
