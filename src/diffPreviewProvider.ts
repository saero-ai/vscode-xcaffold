// src/diffPreviewProvider.ts
//
// R-05: Diff preview — shows pending changes before apply using `apply --dry-run`.
// Runs to a temp directory, compares against existing provider dirs, and opens
// VS Code's native diff editor for each changed file.

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { BaseWebview, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';

/**
 * makeTempDirName generates a unique directory name for dry-run output.
 * Format: xcaffold-diff-{random}
 */
export function makeTempDirName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `xcaffold-diff-${suffix}`;
}

/**
 * parseDryRunOutput extracts changed file paths from `apply --dry-run` output.
 * Tries JSON format first (--format json), falls back to text parsing.
 */
export function parseDryRunOutput(stdout: string): string[] {
  if (!stdout.trim()) return [];

  // Try JSON parse first
  try {
    const parsed = JSON.parse(stdout);
    if (parsed.files && Array.isArray(parsed.files)) {
      return parsed.files.map((f: any) =>
        typeof f === 'string' ? f : f.path,
      );
    }
  } catch {
    // Not JSON — fall through to text parsing
  }

  // Text parsing: lines starting with whitespace are file paths
  const lines = stdout.split('\n');
  const files: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // File paths are indented lines that look like relative paths
    if (
      line !== trimmed &&
      trimmed.length > 0 &&
      !trimmed.startsWith('Dry run') &&
      trimmed.includes('/')
    ) {
      files.push(trimmed);
    }
  }
  return files;
}

/**
 * Recursively remove a directory and all its contents.
 */
function removeDirSync(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * DiffPreviewProvider runs `xcaffold apply --dry-run` to a temp directory
 * and opens VS Code's native diff editor for each changed file.
 */
export class DiffPreviewProvider extends BaseWebview {
  private tempDirs: string[] = [];

  constructor(
    extensionUri: vscode.Uri,
    dataSource: DataSource,
    workspaceFolder: string,
  ) {
    super(extensionUri, dataSource, workspaceFolder);
  }

  protected getViewType(): string {
    return 'xcaffoldDiffPreview';
  }

  protected getTitle(): string {
    return 'xcaffold: Diff Preview';
  }

  protected getStyles(): string {
    return `
      .file-list { list-style: none; padding: 0; }
      .file-list li {
        padding: 6px 12px;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
      }
      .file-list li:hover { background: rgba(255,255,255,0.05); }
      .file-icon { margin-right: 8px; opacity: 0.7; }
      .summary { margin-bottom: 16px; opacity: 0.8; }
    `;
  }

  protected async getHtmlBody(webview: vscode.Webview, nonce: string): Promise<string> {
    const tempDirName = makeTempDirName();
    const tempDir = path.join(os.tmpdir(), tempDirName);

    try {
      // Run dry-run to temp directory
      const result = await this.dataSource.fetch(
        ['apply', '--dry-run', '--output', tempDir],
        this.workspaceFolder,
      );

      this.tempDirs.push(tempDir);

      const files = parseDryRunOutput(result.stdout);

      if (files.length === 0) {
        return '<div class="summary">No changes detected. Provider output is up to date.</div>';
      }

      // Build file list HTML with click-to-diff support
      const fileItems = files
        .map(
          (f) =>
            `<li data-file="${escapeHtml(f)}">` +
            `<span class="file-icon">M</span>${escapeHtml(f)}</li>`,
        )
        .join('\n');

      return `
        <h1>Pending Changes</h1>
        <div class="summary">${files.length} file(s) would be changed by apply.</div>
        <ul class="file-list">${fileItems}</ul>
        <p style="margin-top: 16px; opacity: 0.6;">
          Click a file to open the diff view. Run "xcaffold: Apply" to write these changes.
        </p>
        <script nonce="${nonce}">
          (function() {
            const vscode = acquireVsCodeApi();
            document.querySelectorAll('.file-list li').forEach(li => {
              li.addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openDiff',
                  file: li.getAttribute('data-file'),
                  tempDir: '${escapeHtml(tempDir)}',
                });
              });
            });
          })();
        </script>
      `;
    } catch (err: any) {
      // Fallback: show status output instead
      try {
        const statusResult = await this.dataSource.fetch(
          ['status'],
          this.workspaceFolder,
        );
        return `
          <h1>Diff Preview (fallback)</h1>
          <div class="error">
            Could not run --dry-run: ${escapeHtml(err.message)}
          </div>
          <h2>Current Status</h2>
          <pre>${escapeHtml(statusResult.stdout)}</pre>
        `;
      } catch {
        throw err; // Re-throw original error
      }
    }
  }

  protected handleMessage(message: any): void {
    if (message.command === 'openDiff') {
      const filePath = message.file;
      const tempDir = message.tempDir;

      const existingUri = vscode.Uri.file(
        path.join(this.workspaceFolder, filePath),
      );
      const newUri = vscode.Uri.file(path.join(tempDir, filePath));

      vscode.commands.executeCommand(
        'vscode.diff',
        existingUri,
        newUri,
        `${filePath} (Current vs Pending)`,
      );
    }
  }

  /**
   * cleanupTempDirs removes all temp directories created by this provider.
   * Called in deactivate hook and on dispose.
   */
  cleanupTempDirs(): void {
    for (const dir of this.tempDirs) {
      try {
        removeDirSync(dir);
      } catch {
        // Best-effort cleanup
      }
    }
    this.tempDirs = [];
  }

  protected onDidDispose(): void {
    this.cleanupTempDirs();
  }

  dispose(): void {
    this.cleanupTempDirs();
    super.dispose();
  }
}
