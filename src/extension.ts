import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import { registerDiagnosticProvider } from './diagnosticProvider';
import { registerCommandProvider } from './commandProvider';
import { XcaffoldTreeProvider } from './treeViewProvider';
import { XcaffoldGraphProvider } from './graphProvider';
import { disposeOutputChannel } from './outputChannel';
import { checkMinimumVersion } from './versionCheck';
import { XcfIndex, parseFrontmatter } from './xcfIndex';
import { StatusBarProvider } from './statusBarProvider';

/** Debounce timeout for xcfIndex refresh (ms). */
const INDEX_DEBOUNCE_MS = 500;

/**
 * buildXcfIndex scans all workspace .xcf files and populates the index.
 */
async function buildXcfIndex(index: XcfIndex): Promise<void> {
  index.clear();
  const files = await vscode.workspace.findFiles('**/*.xcf', '**/node_modules/**');
  for (const file of files) {
    try {
      const doc = await vscode.workspace.openTextDocument(file);
      const result = parseFrontmatter(doc.getText());
      if (result) {
        index.setEntry({
          kind: result.kind.toUpperCase(),
          name: result.name,
          fileUri: file.fsPath,
          nameLine: result.nameLine,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }
}

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

  // 2b. Check minimum CLI version (non-blocking)
  const workspaceFolderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const pkgJson = require('../package.json');
  const minVersion: string = pkgJson?.xcaffold?.minCliVersion ?? '0.0.0';
  if (workspaceFolderPath) {
    checkMinimumVersion(cli, workspaceFolderPath, minVersion).catch(() => {
      // Swallow — version check is advisory, not blocking
    });
  }

  // 2a. Invalidate cache on config change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('xcaffold.binaryPath')) {
        cli.invalidateCache();
        cli.init(); // re-resolve in background
      }
    })
  );

  // 3. Initialize xcfIndex
  const xcfIndex = new XcfIndex();
  await buildXcfIndex(xcfIndex);

  // 4. Set up debounced index refresh on file changes
  let indexTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleIndexRefresh = () => {
    if (indexTimer) {
      clearTimeout(indexTimer);
    }
    indexTimer = setTimeout(() => buildXcfIndex(xcfIndex), INDEX_DEBOUNCE_MS);
  };

  const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.fileName.endsWith('.xcf')) {
      scheduleIndexRefresh();
    }
  });

  const deleteWatcher = vscode.workspace.createFileSystemWatcher('**/*.xcf');
  deleteWatcher.onDidDelete(() => scheduleIndexRefresh());
  deleteWatcher.onDidCreate(() => scheduleIndexRefresh());

  // 5. Register Providers
  const diagnosticProvider = registerDiagnosticProvider(cli);
  const commandProvider = registerCommandProvider(cli);

  const treeProvider = new XcaffoldTreeProvider(cli, xcfIndex);
  const treeView = vscode.window.registerTreeDataProvider('xcaffoldExplorer', treeProvider);

  // 6. Initialize status bar
  const statusBar = new StatusBarProvider();

  // Fetch version on activation
  if (workspaceFolderPath) {
    cli.run(['--version'], workspaceFolderPath).then(
      (result) => {
        const versionMatch = /(\d+\.\d+\.\d+)/.exec(result.stdout);
        if (versionMatch) {
          statusBar.setVersion(versionMatch[1]);
        }
        // Fetch initial status
        return cli.run(['status'], workspaceFolderPath);
      },
      () => statusBar.updateFromError(),
    ).then(
      (result) => {
        if (result) {
          statusBar.update(result.stdout);
        }
      },
      () => statusBar.updateFromError(),
    );
  }

  // 7. Register Custom Commands
  const refreshCommand = vscode.commands.registerCommand('xcaffold.refreshExplorer', () => {
    treeProvider.refresh();
    scheduleIndexRefresh();

    // Refresh status bar on explicit refresh
    if (workspaceFolderPath) {
      cli.run(['status'], workspaceFolderPath).then(
        (result) => statusBar.update(result.stdout),
        () => statusBar.updateFromError(),
      );
    }
  });

  const graphCommand = vscode.commands.registerCommand('xcaffold.graph', () => {
    const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (wsFolder) {
      XcaffoldGraphProvider.show(cli, wsFolder, context.extensionUri);
    }
  });

  // 8. Add to subscriptions for cleanup
  context.subscriptions.push(
    diagnosticProvider,
    commandProvider,
    treeView,
    refreshCommand,
    graphCommand,
    statusBar,
    saveWatcher,
    deleteWatcher,
  );
}

/**
 * deactivate is called when the extension is disabled.
 */
export function deactivate() {
  disposeOutputChannel();
}
