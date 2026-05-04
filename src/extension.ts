import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import { registerDiagnosticProvider } from './diagnosticProvider';
import { registerCommandProvider } from './commandProvider';
import { XcaffoldTreeProvider } from './treeViewProvider';
import { XcaffoldGraphProvider } from './graphProvider';
import { disposeOutputChannel } from './outputChannel';

/**
 * activate is called when the extension is first loaded.
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // 1. Get configuration
  const config = vscode.workspace.getConfiguration('xcaffold');
  const binaryPath = config.get<string>('binaryPath', 'xcaffold');

  // 2. Initialize CLI adapter (async — no extension host blocking)
  const cli = new XcaffoldCli(binaryPath);
  await cli.init();

  // 2a. Invalidate cache on config change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('xcaffold.binaryPath')) {
        cli.invalidateCache();
        cli.init(); // re-resolve in background
      }
    })
  );

  // 3. Register Providers
  const diagnosticProvider = registerDiagnosticProvider(cli);
  const commandProvider = registerCommandProvider(cli);

  const treeProvider = new XcaffoldTreeProvider(cli);
  const treeView = vscode.window.registerTreeDataProvider('xcaffoldExplorer', treeProvider);

  // 4. Register Custom Commands
  const refreshCommand = vscode.commands.registerCommand('xcaffold.refreshExplorer', () => {
    treeProvider.refresh();
  });

  const graphCommand = vscode.commands.registerCommand('xcaffold.graph', () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolder) {
      XcaffoldGraphProvider.show(cli, workspaceFolder, context.extensionUri);
    }
  });

  // 5. Add to subscriptions for cleanup
  context.subscriptions.push(
    diagnosticProvider,
    commandProvider,
    treeView,
    refreshCommand,
    graphCommand
  );

  console.log('xcaffold extension is now active');
}

/**
 * deactivate is called when the extension is disabled.
 */
export function deactivate() {
  disposeOutputChannel();
}
