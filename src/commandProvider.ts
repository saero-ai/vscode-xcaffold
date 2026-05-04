import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';

export interface CommandDef {
  id: string;
  args: string[];
}

export const XCAFFOLD_COMMANDS: CommandDef[] = [
  { id: 'xcaffold.apply', args: ['apply'] },
  { id: 'xcaffold.validate', args: ['validate'] },
  { id: 'xcaffold.status', args: ['status'] },
  { id: 'xcaffold.list', args: ['list'] },
  { id: 'xcaffold.import', args: ['import'] },
];

/**
 * registerCommandProvider registers all xcaffold commands to the VS Code command palette.
 */
export function registerCommandProvider(cli: XcaffoldCli): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  for (const cmd of XCAFFOLD_COMMANDS) {
    const d = vscode.commands.registerCommand(cmd.id, async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
            const result = await cli.run(cmd.args, workspaceFolder);
            vscode.window.showInformationMessage(`xcaffold: ${cmd.args[0]} completed successfully.`);
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
