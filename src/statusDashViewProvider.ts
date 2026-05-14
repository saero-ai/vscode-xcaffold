// src/statusDashViewProvider.ts
//
// Sidebar WebviewViewProvider that renders a compact project status dashboard.
// Coexists with the full-panel StatusDashProvider — this is the primary
// status surface embedded in the xcaffold sidebar.

import * as vscode from 'vscode';
import { generateNonce, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';

/** Debounce interval for auto-refresh on .xcaf save (ms). */
const REFRESH_DEBOUNCE_MS = 2000;

/** Parsed result from `xcaffold status` tabular output. */
export interface StatusInfo {
  projectName: string;
  lastApplied: string;
  providers: ProviderRow[];
}

/** A single provider row from the status table. */
export interface ProviderRow {
  name: string;
  files: number;
  status: string;
}

/** Parsed result from `xcaffold validate` output. */
export interface ValidateSummary {
  errors: number;
  warnings: number;
}

/**
 * parseStatusOutput extracts project name, last applied timestamp,
 * and per-provider rows from `xcaffold status` tabular text output.
 *
 * Expected format:
 *   project-name  .  last applied just now
 *
 *     PROVIDER       FILES   STATUS
 *     antigravity       12   ok synced
 *     claude            14   ok synced
 */
export function parseStatusOutput(stdout: string): StatusInfo {
  const result: StatusInfo = {
    projectName: '',
    lastApplied: '',
    providers: [],
  };

  if (!stdout.trim()) {
    return result;
  }

  const lines = stdout.split('\n');

  // First non-empty line: "project-name  .  last applied <timestamp>"
  const headerLine = lines.find((l) => l.trim().length > 0);
  if (headerLine) {
    const headerMatch = /^(\S+)\s+\.\s+last applied\s+(.+)$/i.exec(
      headerLine.trim(),
    );
    if (headerMatch) {
      result.projectName = headerMatch[1];
      result.lastApplied = headerMatch[2].trim();
    } else {
      // Fallback: use entire first line as project name
      result.projectName = headerLine.trim();
    }
  }

  // Find provider rows after the PROVIDER/FILES/STATUS header
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();

    if (/^PROVIDER\s+FILES\s+STATUS/i.test(trimmed)) {
      inTable = true;
      continue;
    }

    if (!inTable) {
      continue;
    }

    if (trimmed.length === 0) {
      continue;
    }

    // Parse: "antigravity       12   ok synced"
    const rowMatch = /^(\S+)\s+(\d+)\s+(.+)$/.exec(trimmed);
    if (rowMatch) {
      result.providers.push({
        name: rowMatch[1],
        files: parseInt(rowMatch[2], 10),
        status: rowMatch[3].trim(),
      });
    }
  }

  return result;
}

/**
 * parseValidateSummary counts errors and warnings from
 * `xcaffold validate` text output. Lines with `!!` are errors;
 * lines with `warn` (case-insensitive) are warnings.
 */
export function parseValidateSummary(stdout: string): ValidateSummary {
  const summary: ValidateSummary = { errors: 0, warnings: 0 };

  if (!stdout.trim()) {
    return summary;
  }

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.includes('!!') || /\berror\b/i.test(trimmed)) {
      summary.errors++;
    } else if (/\bwarn(ing)?\b/i.test(trimmed)) {
      summary.warnings++;
    }
  }

  return summary;
}

/**
 * buildSidebarCsp constructs a nonce-based Content Security Policy
 * for the sidebar webview. Uses nonces for both script-src and
 * style-src (no unsafe-inline).
 */
function buildSidebarCsp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    `img-src ${cspSource}`,
    `font-src ${cspSource}`,
  ].join('; ');
}

/**
 * StatusDashViewProvider implements WebviewViewProvider for the
 * xcaffold sidebar status dashboard.
 */
export class StatusDashViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly dataSource: DataSource,
    private readonly workspaceFolder: string,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    const msgDisposable = webviewView.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
    );
    this._disposables.push(msgDisposable);

    webviewView.onDidDispose(() => {
      this._view = undefined;
      clearTimeout(this._debounceTimer);
      for (const d of this._disposables) {
        d.dispose();
      }
      this._disposables = [];
    });

    this.refresh();
  }

  /**
   * refresh re-renders the sidebar view with fresh CLI data.
   */
  async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    const webview = this._view.webview;
    const nonce = generateNonce();
    const csp = buildSidebarCsp(webview.cspSource, nonce);

    // Show loading state
    webview.html = this.buildHtml(
      csp,
      nonce,
      '<div class="loading">Loading...</div>',
    );

    try {
      const body = await this.buildBody(nonce);
      const freshNonce = generateNonce();
      const freshCsp = buildSidebarCsp(webview.cspSource, freshNonce);
      webview.html = this.buildHtml(freshCsp, freshNonce, body);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      webview.html = this.buildHtml(
        csp,
        nonce,
        `<div class="error">${escapeHtml(message)}</div>`,
      );
    }
  }

  /**
   * scheduleRefresh queues a debounced refresh (2s).
   */
  scheduleRefresh(): void {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this.refresh(), REFRESH_DEBOUNCE_MS);
  }

  /**
   * dispose cleans up timers and disposables.
   */
  dispose(): void {
    clearTimeout(this._debounceTimer);
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  private async buildBody(nonce: string): Promise<string> {
    // Fetch status
    let statusInfo: StatusInfo;
    try {
      const statusResult = await this.dataSource.fetch(
        ['status'],
        this.workspaceFolder,
      );
      statusInfo = parseStatusOutput(statusResult.stdout);
    } catch {
      statusInfo = {
        projectName: '',
        lastApplied: '',
        providers: [],
      };
    }

    // Fetch validation summary
    let validateSummary: ValidateSummary;
    try {
      const validateResult = await this.dataSource.fetch(
        ['validate'],
        this.workspaceFolder,
      );
      validateSummary = parseValidateSummary(validateResult.stdout);
    } catch {
      validateSummary = { errors: 0, warnings: 0 };
    }

    // Project name fallback
    const projectName = statusInfo.projectName || 'xcaffold project';

    // Last applied display
    const lastApplied = statusInfo.lastApplied || 'unknown';

    // Validation badge
    let validationBadge: string;
    if (validateSummary.errors > 0) {
      validationBadge =
        `<span class="badge badge-red">${validateSummary.errors} error${validateSummary.errors > 1 ? 's' : ''}</span>`;
    } else if (validateSummary.warnings > 0) {
      validationBadge =
        `<span class="badge badge-yellow">${validateSummary.warnings} warning${validateSummary.warnings > 1 ? 's' : ''}</span>`;
    } else {
      validationBadge = '<span class="badge badge-green">clean</span>';
    }

    // Provider rows
    const providerRows = statusInfo.providers
      .map((p) => {
        const statusClass = p.status.includes('ok')
          ? 'status-ok'
          : 'status-warn';
        return `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.files}</td>
          <td class="${statusClass}">${escapeHtml(p.status)}</td>
        </tr>`;
      })
      .join('\n');

    const providerTable =
      statusInfo.providers.length > 0
        ? `<table>
            <thead><tr><th>Provider</th><th>Files</th><th>Status</th></tr></thead>
            <tbody>${providerRows}</tbody>
          </table>`
        : '<p class="muted">No providers configured</p>';

    return `
      <div class="section">
        <h2>${escapeHtml(projectName)}</h2>
        <p class="meta">Last applied: ${escapeHtml(lastApplied)}</p>
      </div>

      <div class="section">
        <h3>Validation</h3>
        ${validationBadge}
      </div>

      <div class="section">
        <h3>Providers</h3>
        ${providerTable}
      </div>

      <div class="actions">
        <button onclick="handleAction('applyAll')">Apply All</button>
        <button onclick="handleAction('validate')">Validate</button>
      </div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function handleAction(action) {
          vscode.postMessage({ command: action });
        }
      </script>
    `;
  }

  private buildHtml(csp: string, nonce: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Status</title>
    <style nonce="${nonce}">
      :root {
        --bg: var(--vscode-editor-background);
        --fg: var(--vscode-editor-foreground);
        --border: var(--vscode-panel-border, #333);
        --accent: var(--vscode-focusBorder, #007acc);
        --btn-bg: var(--vscode-button-background, #0e639c);
        --btn-fg: var(--vscode-button-foreground, #fff);
        --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
        --success: #4caf50;
        --warning: #ff9800;
        --error: #f44336;
        --badge-bg: var(--vscode-badge-background, #4d4d4d);
        --badge-fg: var(--vscode-badge-foreground, #fff);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: var(--bg);
        color: var(--fg);
        font-family: var(--vscode-font-family, sans-serif);
        font-size: var(--vscode-font-size, 13px);
        padding: 8px 12px;
        line-height: 1.4;
      }
      h2 { font-size: 1.1em; margin-bottom: 2px; }
      h3 { font-size: 0.95em; margin-bottom: 4px; opacity: 0.8; }
      .section { margin-bottom: 12px; }
      .meta { font-size: 0.85em; opacity: 0.7; }
      .muted { font-size: 0.85em; opacity: 0.5; }
      table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
      th, td { padding: 3px 6px; text-align: left; border-bottom: 1px solid var(--border); }
      th { font-weight: 600; font-size: 0.85em; opacity: 0.7; }
      .badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 0.8em;
        font-weight: 600;
      }
      .badge-green { background: var(--success); color: #fff; }
      .badge-yellow { background: var(--warning); color: #000; }
      .badge-red { background: var(--error); color: #fff; }
      .status-ok { color: var(--success); }
      .status-warn { color: var(--warning); }
      .actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
      button {
        background: var(--btn-bg);
        color: var(--btn-fg);
        border: none;
        padding: 4px 10px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 0.85em;
        flex: 1;
      }
      button:hover { background: var(--btn-hover); }
      .loading { text-align: center; padding: 20px; opacity: 0.6; }
      .error { color: var(--error); padding: 8px; font-size: 0.9em; }
    </style>
</head>
<body>
    ${body}
</body>
</html>`;
  }

  private handleMessage(message: { command: string }): void {
    switch (message.command) {
      case 'applyAll':
        vscode.commands.executeCommand('xcaffold.apply');
        break;
      case 'validate':
        vscode.commands.executeCommand('xcaffold.validate');
        break;
    }
  }
}
