import * as vscode from 'vscode';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';
import { parseValidateOutput } from './diagnosticProvider';
import { getOutputChannel } from './outputChannel';
import { ApplyProviderEvent, ApplySummaryEvent, ApplyEvent, StatusJSON } from './cliTypes';

export interface CommandDef {
  id: string;
  args: string[];
}

/**
 * Result of parsing a single apply completion line.
 */
export interface ApplyProgress {
  provider: string;
  fileCount: number;
}

/**
 * parseApplyLine extracts provider name and file count from a single
 * line of `xcaffold apply` output.
 *
 * Matches lines like:
 *   "  ok  Apply complete. 14 files written to .claude/"
 * Returns { provider: 'claude', fileCount: 14 } or null if no match.
 */
export function parseApplyLine(line: string): ApplyProgress | null {
  const re = /Apply complete\.\s+(\d+)\s+files?\s+written\s+to\s+\.([^/]+)\//i;
  const m = re.exec(line);
  if (!m) {
    return null;
  }
  return {
    provider: m[2],
    fileCount: parseInt(m[1], 10),
  };
}

/**
 * parseApplyOutput parses complete apply output and extracts all
 * provider completion results.
 */
export function parseApplyOutput(stdout: string): ApplyProgress[] {
  const results: ApplyProgress[] = [];
  for (const line of stdout.split('\n')) {
    const progress = parseApplyLine(line);
    if (progress) {
      results.push(progress);
    }
  }
  return results;
}

/**
 * parseApplyEventLine parses a single NDJSON line from `xcaffold apply --output json`.
 * Returns an ApplyEvent (provider or summary) or null if the line is not valid NDJSON.
 */
export function parseApplyEventLine(line: string): ApplyEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    return null;
  }
  try {
    const obj = JSON.parse(trimmed);
    if (obj.event === 'provider' || obj.event === 'summary') {
      return obj as ApplyEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Provider metadata returned by fetchProviderInfo for deprecation handling.
 */
export interface ProviderTarget {
  name: string;
  displayLabel: string;
  deprecated: boolean;
  deprecatedBy: string;
}

/**
 * fetchProviderTargets discovers available providers dynamically via
 * `xcaffold status --json`. Falls back to ['All Providers'] on error.
 * Excludes sunset providers from the list.
 */
export async function fetchProviderTargets(
  cli: { run(args: string[], cwd: string): Promise<{ stdout: string }> },
  cwd: string,
): Promise<string[]> {
  try {
    const result = await cli.run(['status', '--json'], cwd);
    const json: StatusJSON = JSON.parse(result.stdout);
    const names = json.providers
      .filter(p => p.status !== 'sunset')
      .map(p =>
        p.status === 'deprecated' ? `${p.name} (deprecated)` : p.name
      );
    return ['All Providers', ...names];
  } catch {
    return ['All Providers'];
  }
}

/**
 * fetchProviderInfo returns full provider metadata for deprecation checks.
 * Excludes sunset providers.
 */
export async function fetchProviderInfo(
  cli: { run(args: string[], cwd: string): Promise<{ stdout: string }> },
  cwd: string,
): Promise<ProviderTarget[]> {
  try {
    const result = await cli.run(['status', '--json'], cwd);
    const json: StatusJSON = JSON.parse(result.stdout);
    return json.providers
      .filter(p => p.status !== 'sunset')
      .map(p => ({
        name: p.name,
        displayLabel: p.displayLabel,
        deprecated: p.status === 'deprecated',
        deprecatedBy: p.deprecatedBy,
      }));
  } catch {
    return [];
  }
}

/**
 * Options for the xcaffold apply command.
 */
export interface ApplyOptions {
  globalScope?: boolean;
  blueprint?: string;
  outputDir?: string;
  project?: string;
  varFile?: string;
}

/**
 * buildApplyArgs constructs CLI arguments for apply.
 * Returns ['apply'] for "All Providers", or ['apply', '--target', provider] otherwise.
 * Appends optional flags (--global, --blueprint, --output-dir, --project, --var-file)
 * when their corresponding option values are set.
 */
export function buildApplyArgs(selection: string, options?: ApplyOptions): string[] {
  const cleanSelection = selection.replace(' (deprecated)', '');
  const args: string[] = [];
  if (cleanSelection === 'All Providers') {
    args.push('apply', '--json');
  } else {
    args.push('apply', '--target', cleanSelection, '--json');
  }
  if (options?.globalScope) {
    args.push('--global');
  }
  if (options?.blueprint) {
    args.push('--blueprint', options.blueprint);
  }
  if (options?.outputDir) {
    args.push('--output-dir', options.outputDir);
  }
  if (options?.project) {
    args.push('--project', options.project);
  }
  if (options?.varFile) {
    args.push('--var-file', options.varFile);
  }
  return args;
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
  { id: 'xcaffold.init', args: ['init'] },
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

  // Apply with target picker and live progress
  const applyDisposable = vscode.commands.registerCommand(
    'xcaffold.apply',
    async () => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('xcaffold: No workspace folder open.');
        return;
      }

      const targets = await fetchProviderTargets(cli, workspaceFolder);
      const selection = await vscode.window.showQuickPick(targets, {
        placeHolder: 'Select target provider (or All Providers)',
        title: 'xcaffold: Apply to which provider?',
      });

      if (!selection) {
        return; // user cancelled
      }

      let applySelection = selection;
      const cleanName = selection.replace(' (deprecated)', '');
      if (cleanName !== 'All Providers') {
        const providerInfo = await fetchProviderInfo(cli, workspaceFolder);
        const selected = providerInfo.find(p => p.name === cleanName);
        if (selected?.deprecated) {
          const action = await vscode.window.showWarningMessage(
            `Provider "${selected.name}" is deprecated. Use "${selected.deprecatedBy}" instead.`,
            { modal: true },
            'Migrate',
            'Continue Anyway',
          );
          if (!action) {
            return;
          }
          if (action === 'Migrate') {
            applySelection = selected.deprecatedBy;
          }
        }
      }

      const config = vscode.workspace.getConfiguration('xcaffold');
      const applyOpts: ApplyOptions = {
        globalScope: config.get<boolean>('globalScope', false),
        blueprint: config.get<string>('blueprint', '') || undefined,
        outputDir: config.get<string>('outputDir', '') || undefined,
        project: config.get<string>('project', '') || undefined,
        varFile: config.get<string>('varFile', '') || undefined,
      };
      const args = buildApplyArgs(applySelection, applyOpts);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Compiling xcaffold project...',
          cancellable: false,
        },
        async (progress) => {
          const completed: ApplyProgress[] = [];
          let lineBuffer = '';
          let warnedOnce = false;

          try {
            await cli.run(args, workspaceFolder, (data) => {
              lineBuffer += data;
              const lines = lineBuffer.split('\n');
              // Keep the last incomplete line in the buffer
              lineBuffer = lines.pop() ?? '';

              for (const line of lines) {
                const event = parseApplyEventLine(line);
                if (event) {
                  if (event.event === 'provider') {
                    const pe = event as ApplyProviderEvent;
                    completed.push({
                      provider: pe.provider,
                      fileCount: pe.fileCount,
                    });
                    progress.report({
                      message: `${pe.provider}: ${pe.fileCount} files`,
                    });
                  }
                } else {
                  if (!warnedOnce && line.trim()) {
                    vscode.window.showWarningMessage(
                      'xcaffold CLI does not support --json output. Some features may be limited. Upgrade to v0.14.0 or later.',
                    );
                    warnedOnce = true;
                  }
                  const result = parseApplyLine(line);
                  if (result) {
                    completed.push(result);
                    progress.report({
                      message: `${result.provider}: ${result.fileCount} files`,
                    });
                  }
                }
              }
            });

            // Process any remaining buffered line
            if (lineBuffer.trim()) {
              const event = parseApplyEventLine(lineBuffer);
              if (event) {
                if (event.event === 'provider') {
                  const pe = event as ApplyProviderEvent;
                  completed.push({
                    provider: pe.provider,
                    fileCount: pe.fileCount,
                  });
                }
              } else {
                if (!warnedOnce && lineBuffer.trim()) {
                  vscode.window.showWarningMessage(
                    'xcaffold CLI does not support --json output. Some features may be limited. Upgrade to v0.14.0 or later.',
                  );
                  warnedOnce = true;
                }
                const result = parseApplyLine(lineBuffer);
                if (result) {
                  completed.push(result);
                }
              }
            }

            const totalFiles = completed.reduce(
              (sum, p) => sum + p.fileCount,
              0,
            );
            const summary =
              completed.length > 0
                ? `${totalFiles} files written across ${completed.length} provider${completed.length === 1 ? '' : 's'}`
                : `apply completed for ${selection}`;

            vscode.window.showInformationMessage(
              `xcaffold: ${summary}.`,
            );
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : String(err);
            const action = await vscode.window.showErrorMessage(
              `xcaffold error: ${message}`,
              'Show Output',
            );
            if (action === 'Show Output') {
              getOutputChannel().show();
            }
          }

          // Refresh dashboard and file decorations after apply
          vscode.commands.executeCommand('xcaffold.refreshExplorer');
          vscode.commands.executeCommand('xcaffold.refreshDashboard');
        },
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
      if (!filePath.endsWith('.xcaf')) {
        vscode.window.showErrorMessage(
          'xcaffold: Active file is not an .xcaf manifest.'
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

  // Tree context menu: Open File
  disposables.push(
    vscode.commands.registerCommand(
      'xcaffold.openResource',
      async (item: { fileUri?: string }) => {
        if (item?.fileUri) {
          await vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.file(item.fileUri),
          );
        }
      },
    ),
  );

  // Tree context menu: Find References
  disposables.push(
    vscode.commands.registerCommand(
      'xcaffold.findReferences',
      async (item: { label?: string }) => {
        if (item?.label) {
          await vscode.commands.executeCommand(
            'workbench.action.findInFiles',
            {
              query: String(item.label),
              isRegex: false,
              filesToInclude: '**/*.xcaf',
            },
          );
        }
      },
    ),
  );

  // Tree context menu: Delete Resource
  disposables.push(
    vscode.commands.registerCommand(
      'xcaffold.deleteResource',
      async (item: { resourceUri?: vscode.Uri; fileUri?: string; label?: string }) => {
        const filePath = item?.resourceUri?.fsPath || item?.fileUri;
        if (!filePath) {
          vscode.window.showErrorMessage(
            'xcaffold: Cannot determine resource file path.',
          );
          return;
        }
        const confirm = await vscode.window.showWarningMessage(
          `Delete resource "${String(item.label)}"? This will remove the resource directory.`,
          { modal: true },
          'Delete',
        );
        if (confirm === 'Delete') {
          const fileDir = path.dirname(filePath);
          await vscode.workspace.fs.delete(
            vscode.Uri.file(fileDir),
            { recursive: true },
          );
        }
      },
    ),
  );

  return vscode.Disposable.from(...disposables);
}
