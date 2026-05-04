import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import { registerDiagnosticProvider } from './diagnosticProvider';
import { registerCommandProvider } from './commandProvider';
import { XcaffoldTreeProvider } from './treeViewProvider';
import { disposeOutputChannel } from './outputChannel';

/**
 * activate is called when the extension is first loaded.
 */
export function activate(context: vscode.ExtensionContext) {
  // 1. Get configuration
  const config = vscode.workspace.getConfiguration('xcaffold');
  const binaryPath = config.get<string>('binaryPath', 'xcaffold');

  // 2. Initialize CLI adapter
  const cli = new XcaffoldCli(binaryPath);

  // 3. Register Providers
  const diagnosticProvider = registerDiagnosticProvider(cli);
  const commandProvider = registerCommandProvider(cli);
  
  const treeProvider = new XcaffoldTreeProvider(cli);
  const treeView = vscode.window.registerTreeDataProvider('xcaffoldExplorer', treeProvider);

  // 4. Register Refresh Command for Tree View
  const refreshCommand = vscode.commands.registerCommand('xcaffold.refreshExplorer', () => {
    treeProvider.refresh();
  });

  // 5. Add to subscriptions for cleanup
  context.subscriptions.push(
    diagnosticProvider,
    commandProvider,
    treeView,
    refreshCommand
  );

  console.log('xcaffold extension is now active');
}

/**
 * deactivate is called when the extension is disabled.
 */
export function deactivate() {
  disposeOutputChannel();
}
