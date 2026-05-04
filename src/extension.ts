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
import { runInitWizard } from './initWizardProvider';
import { runImportPicker } from './importPickerProvider';

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
          kind: result.kind.toLowerCase(),
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
 * initStatusBar fetches version and status from CLI and updates the status bar.
 */
function initStatusBar(cli: XcaffoldCli, workspaceFolderPath: string, statusBar: StatusBarProvider): void {
  cli.run(['--version'], workspaceFolderPath).then(
    (result) => {
      const versionMatch = /(\d+\.\d+\.\d+)/.exec(result.stdout);
      if (versionMatch) {
        statusBar.setVersion(versionMatch[1]);
      }
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

/**
 * setupFileWatchers sets up watchers for .xcf file changes.
 */
function setupFileWatchers(scheduleIndexRefresh: () => void): { saveWatcher: vscode.Disposable; deleteWatcher: vscode.FileSystemWatcher } {
  const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.fileName.endsWith('.xcf')) {
      scheduleIndexRefresh();
    }
  });

  const deleteWatcher = vscode.workspace.createFileSystemWatcher('**/*.xcf');
  deleteWatcher.onDidDelete(() => scheduleIndexRefresh());
  deleteWatcher.onDidCreate(() => scheduleIndexRefresh());

  return { saveWatcher, deleteWatcher };
}

/**
 * registerConfigChangeListener sets up listener for xcaffold config changes.
 */
function registerConfigChangeListener(context: vscode.ExtensionContext, cli: XcaffoldCli): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('xcaffold.binaryPath')) {
        cli.invalidateCache();
        cli.init(); // re-resolve in background
      }
    })
  );
}

/**
 * registerProviders registers diagnostic, command, and tree data providers.
 */
function registerProviders(
  cli: XcaffoldCli,
  xcfIndex: XcfIndex,
  context: vscode.ExtensionContext
): { treeProvider: XcaffoldTreeProvider; diagnosticProvider: vscode.Disposable; commandProvider: vscode.Disposable; treeView: vscode.Disposable } {
  const diagnosticProvider = registerDiagnosticProvider(cli);
  const commandProvider = registerCommandProvider(cli);

  const treeProvider = new XcaffoldTreeProvider(cli, xcfIndex);
  const treeView = vscode.window.registerTreeDataProvider('xcaffoldExplorer', treeProvider);

  return { treeProvider, diagnosticProvider, commandProvider, treeView };
}

/**
 * registerCommands registers custom commands for the extension.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  cli: XcaffoldCli,
  treeProvider: XcaffoldTreeProvider,
  scheduleIndexRefresh: () => void,
  workspaceFolderPath: string | undefined,
  statusBar: StatusBarProvider
): { refreshCommand: vscode.Disposable; graphCommand: vscode.Disposable; initWizardCommand: vscode.Disposable; importPickerCommand: vscode.Disposable; diffCommand: vscode.Disposable } {
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

  // Phase 2: Interactive commands
  const initWizardCommand = vscode.commands.registerCommand(
    'xcaffold.initWizard',
    async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      await runInitWizard(cli, wsFolder);
    }
  );

  const importPickerCommand = vscode.commands.registerCommand(
    'xcaffold.importPicker',
    async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      await runImportPicker(cli, wsFolder);
    }
  );

  const diffCommand = vscode.commands.registerCommand(
    'xcaffold.diff',
    async () => {
      vscode.window.showInformationMessage(
        'xcaffold: Diff preview will be available in a future update.'
      );
    }
  );

  return { refreshCommand, graphCommand, initWizardCommand, importPickerCommand, diffCommand };
}

/**
 * activate is called when the extension is first loaded.
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // 1. Get configuration and initialize CLI
  const config = vscode.workspace.getConfiguration('xcaffold');
  const binaryPath = config.get<string>('binaryPath', 'xcaffold');
  const cli = new XcaffoldCli(binaryPath);
  await cli.init();

  // 2. Check minimum CLI version (non-blocking) and register config listener
  const workspaceFolderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const pkgJson = require('../package.json');
  const minVersion: string = pkgJson?.xcaffold?.minCliVersion ?? '0.0.0';
  if (workspaceFolderPath) {
    checkMinimumVersion(cli, workspaceFolderPath, minVersion).catch(() => {
      // Swallow — version check is advisory, not blocking
    });
  }
  registerConfigChangeListener(context, cli);

  // 3. Initialize xcfIndex
  const xcfIndex = new XcfIndex();
  await buildXcfIndex(xcfIndex);

  // 4. Set up debounced index refresh with timer disposal
  let indexTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleIndexRefresh = () => {
    if (indexTimer) {
      clearTimeout(indexTimer);
    }
    indexTimer = setTimeout(() => buildXcfIndex(xcfIndex), INDEX_DEBOUNCE_MS);
  };
  context.subscriptions.push({
    dispose: () => {
      if (indexTimer) {
        clearTimeout(indexTimer);
      }
    }
  });

  // 5. Set up file watchers
  const { saveWatcher, deleteWatcher } = setupFileWatchers(scheduleIndexRefresh);

  // 6. Register providers and status bar
  const { treeProvider, diagnosticProvider, commandProvider, treeView } = registerProviders(cli, xcfIndex, context);
  const statusBar = new StatusBarProvider();
  initStatusBar(cli, workspaceFolderPath || '', statusBar);

  // 7. Register custom commands
  const { refreshCommand, graphCommand, initWizardCommand, importPickerCommand, diffCommand } = registerCommands(context, cli, treeProvider, scheduleIndexRefresh, workspaceFolderPath, statusBar);

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
    initWizardCommand,
    importPickerCommand,
    diffCommand,
  );
}

/**
 * deactivate is called when the extension is disabled.
 */
export function deactivate() {
  disposeOutputChannel();
}
