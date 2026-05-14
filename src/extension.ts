import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';
import { registerDiagnosticProvider } from './diagnosticProvider';
import { registerCommandProvider } from './commandProvider';
import { ObjectExplorerProvider } from './treeViewProvider';
import { XcaffoldGraphProvider } from './graphProvider';
import { disposeOutputChannel } from './outputChannel';
import { checkMinimumVersion } from './versionCheck';
import { XcafIndex } from './xcafIndex';
import { XcafProjectModel, FsAdapter } from './xcafProjectModel';
import type { DataSource } from './webview/dataSource';
import { StatusBarProvider } from './statusBarProvider';
import { runInitWizard } from './initWizardProvider';
import { runImportPicker } from './importPickerProvider';
import { CliDataSource } from './webview/dataSource';
import { DiffPreviewProvider } from './diffPreviewProvider';
import { FidelityProvider } from './fidelityProvider';
import { StatusDashProvider } from './statusDashProvider';
import { SchemaViewerProvider } from './schemaViewerProvider';
import { XcafCodeLensProvider } from './codeLensProvider';
import { XcafDefinitionProvider } from './definitionProvider';
import { XcafSchemaCache } from './xcafSchema';
import { XcafCompletionProvider } from './completionProvider';
import { XcafHoverProvider } from './hoverProvider';
import { XcafDocumentSymbolProvider } from './documentSymbolProvider';
import { XcafReferenceProvider } from './referenceProvider';
import { XcafRenameProvider } from './renameProvider';
import { XcafFileDecorationProvider } from './fileDecorationProvider';
import { XcafSemanticTokenProvider, xcafSemanticLegend } from './semanticTokenProvider';
import { diagnosticCollection } from './diagnosticProvider';
import { runNewResourceWizard } from './newResourceProvider';
import { XcafCodeActionProvider } from './codeActionProvider';
import { StatusDashViewProvider } from './statusDashViewProvider';
import { MiniGraphProvider } from './miniGraphProvider';

/** Debounce timeout for xcafIndex refresh (ms). */
const INDEX_DEBOUNCE_MS = 500;

/** Module-scoped for deactivate cleanup */
let _diffPreview: DiffPreviewProvider | undefined;

/**
 * promptIconTheme shows a one-time prompt to enable the xcaffold icon theme.
 * Fire-and-forget — never awaited so it does not block activation.
 */
function promptIconTheme(context: vscode.ExtensionContext): void {
  if (context.globalState.get('xcaffold.iconThemePrompted')) {
    return;
  }
  const current = vscode.workspace.getConfiguration('workbench').get<string>('iconTheme');
  if (current === 'xcaffold-icons') {
    context.globalState.update('xcaffold.iconThemePrompted', true);
    return;
  }
  vscode.window.showInformationMessage(
    'Enable xcaffold file icons for .xcaf files?',
    'Enable',
    'Not now',
  ).then((choice) => {
    if (choice === 'Enable') {
      vscode.workspace.getConfiguration('workbench').update('iconTheme', 'xcaffold-icons', vscode.ConfigurationTarget.Global);
    }
    context.globalState.update('xcaffold.iconThemePrompted', true);
  });
}

/**
 * createVscodeFsAdapter returns an FsAdapter backed by the VS Code workspace filesystem API.
 */
function createVscodeFsAdapter(): FsAdapter {
  return {
    readDirectory: async (dirPath: string) => {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
      return entries.map(([name, type]) => [name, type] as [string, number]);
    },
  };
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
 * setupFileWatchers sets up watchers for .xcaf file changes.
 */
function setupFileWatchers(scheduleIndexRefresh: () => void): { saveWatcher: vscode.Disposable; deleteWatcher: vscode.FileSystemWatcher } {
  const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.fileName.endsWith('.xcaf')) {
      scheduleIndexRefresh();
    }
  });

  const deleteWatcher = vscode.workspace.createFileSystemWatcher('**/*.xcaf');
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
  xcafIndex: XcafIndex,
  model: XcafProjectModel,
  workspaceFolderPath: string | undefined,
  context: vscode.ExtensionContext
): { treeProvider: ObjectExplorerProvider; diagnosticProvider: vscode.Disposable; commandProvider: vscode.Disposable; treeView: vscode.Disposable } {
  const diagnosticProvider = registerDiagnosticProvider(cli);
  const commandProvider = registerCommandProvider(cli);

  const treeProvider = new ObjectExplorerProvider(model, cli, workspaceFolderPath);
  const treeView = vscode.window.registerTreeDataProvider('xcaffoldExplorer', treeProvider);

  return { treeProvider, diagnosticProvider, commandProvider, treeView };
}

/**
 * registerCommands registers custom commands for the extension.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  cli: XcaffoldCli,
  treeProvider: ObjectExplorerProvider,
  scheduleModelRefresh: () => void,
  workspaceFolderPath: string | undefined,
  statusBar: StatusBarProvider,
  dataSource: DataSource,
  xcafIndex: XcafIndex,
): { refreshCommand: vscode.Disposable; graphCommand: vscode.Disposable; initWizardCommand: vscode.Disposable; importPickerCommand: vscode.Disposable; diffCommand: vscode.Disposable; fidelityCommand: vscode.Disposable; statusDashCommand: vscode.Disposable; schemaViewerCommand: vscode.Disposable } {
  const refreshCommand = vscode.commands.registerCommand('xcaffold.refreshExplorer', () => {
    treeProvider.refresh();
    scheduleModelRefresh();

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
      XcaffoldGraphProvider.show(dataSource, wsFolder, context.extensionUri, xcafIndex);
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

  // Phase 3: Webview commands
  let diffPreview: DiffPreviewProvider | undefined;
  let fidelityProvider: FidelityProvider | undefined;
  let statusDashProvider: StatusDashProvider | undefined;
  let schemaViewerProvider: SchemaViewerProvider | undefined;

  const diffCommand = vscode.commands.registerCommand(
    'xcaffold.diff',
    () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      if (!diffPreview) {
        diffPreview = new DiffPreviewProvider(
          context.extensionUri,
          dataSource,
          wsFolder,
        );
      }
      _diffPreview = diffPreview;
      diffPreview.show();
    },
  );

  const fidelityCommand = vscode.commands.registerCommand(
    'xcaffold.fidelity',
    () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      if (!fidelityProvider) {
        fidelityProvider = new FidelityProvider(
          context.extensionUri,
          dataSource,
          wsFolder,
        );
      }
      fidelityProvider.show();
    },
  );

  const statusDashCommand = vscode.commands.registerCommand(
    'xcaffold.statusDash',
    () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      if (!statusDashProvider) {
        statusDashProvider = new StatusDashProvider(
          context.extensionUri,
          dataSource,
          wsFolder,
        );
      }
      statusDashProvider.show();
    },
  );

  const schemaViewerCommand = vscode.commands.registerCommand(
    'xcaffold.schemaViewer',
    () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      if (!schemaViewerProvider) {
        schemaViewerProvider = new SchemaViewerProvider(
          context.extensionUri,
          dataSource,
          wsFolder,
        );
      }
      schemaViewerProvider.promptAndShow();
    },
  );

  return { refreshCommand, graphCommand, initWizardCommand, importPickerCommand, diffCommand, fidelityCommand, statusDashCommand, schemaViewerCommand };
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

  // 2b. One-time icon theme prompt (non-blocking, fire-and-forget)
  promptIconTheme(context);

  // 3. Initialize xcafIndex backed by XcafProjectModel
  const xcafIndex = new XcafIndex();
  const vscodeFs = createVscodeFsAdapter();
  const xcafRoot = workspaceFolderPath ? path.join(workspaceFolderPath, 'xcaf') : undefined;

  let model: XcafProjectModel;
  if (xcafRoot) {
    try {
      model = await XcafProjectModel.scan(xcafRoot, vscodeFs);
    } catch {
      model = new XcafProjectModel([]);
    }
  } else {
    model = new XcafProjectModel([]);
  }
  xcafIndex.setModel(model);

  // 3b. Initialize schema cache (non-blocking)
  const schemaCache = new XcafSchemaCache((args, cwd) => cli.run(args, cwd));
  if (workspaceFolderPath) {
    schemaCache.loadAll(workspaceFolderPath).catch(() => {
      // Swallow — schema cache is advisory, falls back to hardcoded schemas
    });
  }

  // 4. Set up debounced model refresh with timer disposal
  //    treeProvider is declared below (step 6) but captured by closure — OK at call time.
  let indexTimer: ReturnType<typeof setTimeout> | undefined;
  // eslint-disable-next-line prefer-const
  let treeProvider: ObjectExplorerProvider;
  const scheduleModelRefresh = () => {
    if (indexTimer) {
      clearTimeout(indexTimer);
    }
    indexTimer = setTimeout(async () => {
      if (xcafRoot) {
        try {
          const newModel = await XcafProjectModel.scan(xcafRoot, vscodeFs);
          xcafIndex.setModel(newModel);
          treeProvider.setModel(newModel);
          treeProvider.refresh();
        } catch { /* ignore scan errors */ }
      }
    }, INDEX_DEBOUNCE_MS);
  };
  context.subscriptions.push({
    dispose: () => {
      if (indexTimer) {
        clearTimeout(indexTimer);
      }
    }
  });

  // 5. Set up file watchers
  const { saveWatcher, deleteWatcher } = setupFileWatchers(scheduleModelRefresh);

  // 6. Register providers and status bar
  const { treeProvider: tp, diagnosticProvider, commandProvider, treeView } = registerProviders(cli, xcafIndex, model, workspaceFolderPath, context);
  treeProvider = tp;
  const statusBar = new StatusBarProvider();
  initStatusBar(cli, workspaceFolderPath || '', statusBar);

  // 6b. Register CodeLens and Definition providers for .xcaf files
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { scheme: 'file', pattern: '**/*.xcaf' },
    new XcafCodeLensProvider(),
  );

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    { scheme: 'file', pattern: '**/*.xcaf' },
    new XcafDefinitionProvider(xcafIndex),
  );

  // 6c. Register language intelligence providers for .xcaf files
  const xcafFilter = { scheme: 'file', pattern: '**/*.xcaf' };

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    xcafFilter,
    new XcafCompletionProvider(schemaCache),
  );

  const hoverProvider = vscode.languages.registerHoverProvider(
    xcafFilter,
    new XcafHoverProvider(schemaCache),
  );

  const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider(
    xcafFilter,
    new XcafDocumentSymbolProvider(),
  );

  const referenceProvider = vscode.languages.registerReferenceProvider(
    xcafFilter,
    new XcafReferenceProvider(xcafIndex),
  );

  const renameProvider = vscode.languages.registerRenameProvider(
    xcafFilter,
    new XcafRenameProvider(xcafIndex),
  );

  const semanticTokenProvider = vscode.languages.registerDocumentSemanticTokensProvider(
    xcafFilter,
    new XcafSemanticTokenProvider(schemaCache, xcafIndex),
    xcafSemanticLegend,
  );

  // 6c-ii. Register code action provider for quick fixes
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    xcafFilter,
    new XcafCodeActionProvider(schemaCache),
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
  );

  // 6d. Register file decoration provider for validation status badges
  const fileDecoProvider = new XcafFileDecorationProvider(diagnosticCollection);
  const fileDecoRegistration = vscode.window.registerFileDecorationProvider(fileDecoProvider);
  const diagnosticChangeListener = vscode.languages.onDidChangeDiagnostics((e) => {
    const xcafUris = e.uris.filter(u => u.fsPath.endsWith('.xcaf'));
    if (xcafUris.length > 0) {
      fileDecoProvider.onDiagnosticsChanged(xcafUris);
    }
  });

  // 7. Initialize webview data source
  const dataSource = new CliDataSource(
    (args, cwd) => cli.run(args, cwd),
  );

  // 7b. Register sidebar status dashboard (WebviewViewProvider)
  const statusDashViewProvider = workspaceFolderPath
    ? new StatusDashViewProvider(context.extensionUri, dataSource, workspaceFolderPath)
    : undefined;
  if (statusDashViewProvider) {
    const statusDashViewRegistration = vscode.window.registerWebviewViewProvider(
      'xcaffoldStatusDash',
      statusDashViewProvider,
    );
    context.subscriptions.push(statusDashViewRegistration);
    context.subscriptions.push(statusDashViewProvider);
  }

  // 7b-ii. Register sidebar mini-graph (WebviewViewProvider)
  const miniGraphProvider = workspaceFolderPath
    ? new MiniGraphProvider(context.extensionUri, dataSource, workspaceFolderPath, xcafIndex)
    : undefined;
  if (miniGraphProvider) {
    const miniGraphRegistration = vscode.window.registerWebviewViewProvider(
      'xcaffoldMiniGraph',
      miniGraphProvider,
    );
    context.subscriptions.push(miniGraphRegistration);
    context.subscriptions.push(miniGraphProvider);
  }

  // 7b-iii. Register refreshDashboard command for post-apply refresh
  const refreshDashboardCommand = vscode.commands.registerCommand(
    'xcaffold.refreshDashboard',
    () => {
      statusDashViewProvider?.refresh();
    },
  );
  context.subscriptions.push(refreshDashboardCommand);

  // 7c. Wire .xcaf save watcher to sidebar status refresh (2s debounce)
  if (statusDashViewProvider) {
    const sidebarSaveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('.xcaf')) {
        statusDashViewProvider.scheduleRefresh();
      }
    });
    context.subscriptions.push(sidebarSaveWatcher);
  }

  // 8. Register custom commands
  const { refreshCommand, graphCommand, initWizardCommand, importPickerCommand, diffCommand, fidelityCommand, statusDashCommand, schemaViewerCommand } = registerCommands(context, cli, treeProvider, scheduleModelRefresh, workspaceFolderPath, statusBar, dataSource, xcafIndex);

  // 8b. Register New Resource wizard (replaces the stub in commandProvider)
  const newResourceCommand = vscode.commands.registerCommand(
    'xcaffold.newResource',
    () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }
      return runNewResourceWizard(xcafIndex, wsFolder);
    },
  );

  // 9. Add to subscriptions for cleanup
  context.subscriptions.push(
    diagnosticProvider,
    commandProvider,
    treeView,
    refreshCommand,
    graphCommand,
    statusBar,
    saveWatcher,
    deleteWatcher,
    codeLensProvider,
    definitionProvider,
    completionProvider,
    hoverProvider,
    documentSymbolProvider,
    referenceProvider,
    renameProvider,
    semanticTokenProvider,
    codeActionProvider,
    fileDecoRegistration,
    fileDecoProvider,
    diagnosticChangeListener,
    initWizardCommand,
    importPickerCommand,
    diffCommand,
    fidelityCommand,
    statusDashCommand,
    schemaViewerCommand,
    newResourceCommand,
  );
}

/**
 * deactivate is called when the extension is disabled.
 */
export function deactivate() {
  if (_diffPreview) {
    _diffPreview.cleanupTempDirs();
  }
  disposeOutputChannel();
}
