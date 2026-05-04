import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';

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

  return vscode.Disposable.from(...disposables);
}
