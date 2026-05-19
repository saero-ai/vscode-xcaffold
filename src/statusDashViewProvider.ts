// src/statusDashViewProvider.ts
//
// Sidebar WebviewViewProvider that renders a compact project status dashboard.
// Coexists with the full-panel StatusDashProvider — this is the primary
// status surface embedded in the xcaffold sidebar.

import * as path from 'path';
import * as vscode from 'vscode';
import { generateNonce, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';

/** Maps xcaffold provider names to their output directory names. */
const PROVIDER_OUTPUT_DIRS: Record<string, string> = {
  claude: '.claude',
  cursor: '.cursor',
  gemini: '.gemini',
  copilot: '.github',
  antigravity: '.agents',
  codex: '.codex',
};

/** Debounce interval for auto-refresh on .xcaf save (ms). */
const REFRESH_DEBOUNCE_MS = 2000;

/** CSS custom properties mapping VS Code theme variables. */
const SIDEBAR_CSS_VARIABLES = `:root {
  --bg: var(--vscode-editor-background);
  --fg: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border, #333);
  --accent: var(--vscode-focusBorder, #007acc);
  --success: #4caf50;
  --warning: #ff9800;
  --error: #f44336;
  --badge-bg: var(--vscode-badge-background, #4d4d4d);
  --badge-fg: var(--vscode-badge-foreground, #fff);
}`;

/** CSS rules for the sidebar dashboard layout. */
const SIDEBAR_CSS_RULES = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--fg);
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  padding: 8px 12px; line-height: 1.4;
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
  display: inline-block; padding: 1px 6px;
  border-radius: 8px; font-size: 0.8em; font-weight: 600;
}
.badge-green { background: var(--success); color: #fff; }
.badge-yellow { background: var(--warning); color: #000; }
.badge-red { background: var(--error); color: #fff; }
.status-ok { color: var(--success); }
.status-warn { color: var(--warning); }
.status-unmanaged { color: var(--accent); }
.status-muted { opacity: 0.5; }
.validation-messages {
  font-size: 0.8em; margin-top: 4px; padding-left: 16px; opacity: 0.85;
  list-style: none;
}
.validation-messages li::before { content: "- "; }
.loading { text-align: center; padding: 20px; opacity: 0.6; }
.error { color: var(--error); padding: 8px; font-size: 0.9em; }`;


/** Parsed result from `xcaffold status` tabular output. */
export interface StatusInfo {
  projectName: string;
  blueprint: string;
  lastApplied: string;
  providers: ProviderRow[];
}

/** A single provider row from the status table. */
export interface ProviderRow {
  name: string;
  files: number;
  status: string;
  state: 'synced' | 'drifted' | 'unmanaged' | 'not-applied';
}

/** Parsed result from `xcaffold validate` output. */
export interface ValidateSummary {
  errors: number;
  warnings: number;
  messages: string[];
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
    blueprint: '',
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
    const blueprintHeaderMatch = /^(\S+)\s+\.\s+blueprint:\s+(\S+)\s+\.\s+last applied\s+(.+)$/i.exec(
      headerLine.trim(),
    );
    if (blueprintHeaderMatch) {
      result.projectName = blueprintHeaderMatch[1];
      result.blueprint = blueprintHeaderMatch[2];
      result.lastApplied = blueprintHeaderMatch[3].trim();
    } else {
      const headerMatch = /^(\S+)\s+\.\s+last applied\s+(.+)$/i.exec(
        headerLine.trim(),
      );
      if (headerMatch) {
        result.projectName = headerMatch[1];
        result.lastApplied = headerMatch[2].trim();
      } else {
        result.projectName = headerLine.trim();
      }
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

    if (inTable && trimmed.length === 0) {
      inTable = false;
      continue;
    }

    if (!inTable) {
      continue;
    }

    // Parse: "antigravity       12   ok synced"
    const rowMatch = /^(\S+)\s+(\d+)\s+(.+)$/.exec(trimmed);
    if (rowMatch) {
      const status = rowMatch[3].trim();
      const isDrift = /!!|drift|modified/i.test(status);
      result.providers.push({
        name: rowMatch[1],
        files: parseInt(rowMatch[2], 10),
        status,
        state: isDrift ? 'drifted' : 'synced',
      });
    }
  }

  return result;
}

/**
 * parseDeclaredTargets extracts provider target names from
 * `project.xcaf` file content. Looks for a `targets:` key followed
 * by a YAML-style list of `- name` entries.
 */
export function parseDeclaredTargets(content: string): string[] {
  const targets: string[] = [];
  let inTargets = false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (/^targets:\s*$/.test(trimmed)) {
      inTargets = true;
      continue;
    }
    if (inTargets) {
      const match = /^-\s+(\S+)$/.exec(trimmed);
      if (match) {
        targets.push(match[1]);
      } else if (trimmed && !trimmed.startsWith('#')) {
        break;
      }
    }
  }
  return targets;
}

/**
 * parseValidateSummary counts errors and warnings from
 * `xcaffold validate` text output. Uses prefix-based detection:
 * `!!` prefix = error, `**` prefix = warning/skipped, `ok` prefix = pass.
 */
export function parseValidateSummary(stdout: string): ValidateSummary {
  const summary: ValidateSummary = { errors: 0, warnings: 0, messages: [] };

  if (!stdout.trim()) {
    return summary;
  }

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('!!')) {
      summary.errors++;
      const msg = trimmed.replace(/^!!\s*/, '').trim();
      if (msg) {
        summary.messages.push(msg);
      }
    } else if (trimmed.startsWith('**')) {
      summary.warnings++;
      const msg = trimmed.replace(/^\*\*\s*/, '').trim();
      if (msg) {
        summary.messages.push(msg);
      }
    } else if (/^error:/i.test(trimmed)) {
      summary.errors++;
      summary.messages.push(trimmed);
    } else if (/^warn(ing)?:/i.test(trimmed)) {
      summary.warnings++;
      const msg = trimmed.replace(/^warn(ing)?:?\s*/i, '').trim();
      if (msg) {
        summary.messages.push(msg);
      }
    }
  }

  return summary;
}

/**
 * buildSidebarCsp constructs a nonce-based Content Security Policy
 * for the sidebar webview. Scripts are disabled; only style nonce is needed.
 */
function buildSidebarCsp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
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
      enableScripts: false,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

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
      const body = await this.buildBody();
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

  private async buildBody(): Promise<string> {
    const statusInfo = await this.fetchStatusInfo();
    const validateSummary = await this.fetchValidateSummary();

    // Merge declared targets that haven't been applied yet
    const declaredTargets = await this.fetchDeclaredTargets();
    const appliedNames = new Set(statusInfo.providers.map(p => p.name));

    for (const target of declaredTargets) {
      if (!appliedNames.has(target)) {
        const dirName = PROVIDER_OUTPUT_DIRS[target] ?? `.${target}`;
        const dirExists = await this.checkDirExists(
          path.join(this.workspaceFolder, dirName),
        );
        statusInfo.providers.push({
          name: target,
          files: 0,
          status: dirExists ? 'unmanaged' : 'not applied',
          state: dirExists ? 'unmanaged' : 'not-applied',
        });
      }
    }

    const projectName = statusInfo.projectName || 'xcaffold project';
    const lastApplied = statusInfo.lastApplied || 'unknown';

    const validationBadge = this.buildValidationBadge(validateSummary);
    const providerTable = this.buildProviderTable(statusInfo.providers);

    const blueprintLine = statusInfo.blueprint
      ? `<p class="meta">Blueprint: <strong>${escapeHtml(statusInfo.blueprint)}</strong></p>`
      : '';

    return `
      <div class="section">
        <h2>${escapeHtml(projectName)}</h2>
        <p class="meta">Last applied: ${escapeHtml(lastApplied)}</p>
        ${blueprintLine}
      </div>

      <div class="section">
        <h3>Providers</h3>
        ${providerTable}
      </div>

      <div class="section">
        <h3>Validation</h3>
        ${validationBadge}
      </div>
    `;
  }

  private async fetchStatusInfo(): Promise<StatusInfo> {
    try {
      const result = await this.dataSource.fetch(
        ['status'],
        this.workspaceFolder,
      );
      return parseStatusOutput(result.stdout);
    } catch (err: unknown) {
      const stdout = (err as Record<string, unknown>)?.stdout;
      if (typeof stdout === 'string' && stdout.trim()) {
        return parseStatusOutput(stdout);
      }
      return { projectName: '', blueprint: '', lastApplied: '', providers: [] };
    }
  }

  private async fetchValidateSummary(): Promise<ValidateSummary> {
    try {
      const result = await this.dataSource.fetch(
        ['validate'],
        this.workspaceFolder,
      );
      return parseValidateSummary(result.stdout);
    } catch (err: unknown) {
      const stdout = (err as Record<string, unknown>)?.stdout;
      if (typeof stdout === 'string' && stdout.trim()) {
        return parseValidateSummary(stdout);
      }
      return { errors: 0, warnings: 0, messages: [] };
    }
  }

  private async fetchDeclaredTargets(): Promise<string[]> {
    try {
      const projectXcafUri = vscode.Uri.file(
        path.join(this.workspaceFolder, 'project.xcaf'),
      );
      const content = Buffer.from(
        await vscode.workspace.fs.readFile(projectXcafUri),
      ).toString('utf-8');
      return parseDeclaredTargets(content);
    } catch {
      return [];
    }
  }

  private async checkDirExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(dirPath));
      return (stat.type & vscode.FileType.Directory) !== 0;
    } catch {
      return false;
    }
  }

  private buildHtml(csp: string, nonce: string, body: string): string {
    const styles = this.sidebarStyles(nonce);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Status</title>
    ${styles}
</head>
<body>
    ${body}
</body>
</html>`;
  }

  private buildValidationBadge(summary: ValidateSummary): string {
    let badge: string;
    if (summary.errors > 0) {
      const plural = summary.errors > 1 ? 's' : '';
      badge = `<span class="badge badge-red">${summary.errors} error${plural}</span>`;
    } else if (summary.warnings > 0) {
      const plural = summary.warnings > 1 ? 's' : '';
      badge = `<span class="badge badge-yellow">${summary.warnings} warning${plural}</span>`;
    } else {
      return '<span class="badge badge-green">clean</span>';
    }

    if (summary.messages.length > 0) {
      const items = summary.messages
        .map((m) => `<li>${escapeHtml(m)}</li>`)
        .join('');
      badge += `<ul class="validation-messages">${items}</ul>`;
    }

    return badge;
  }

  private buildProviderTable(providers: ProviderRow[]): string {
    if (providers.length === 0) {
      return '<p class="muted">No providers configured</p>';
    }

    const rows = providers
      .map((p) => {
        let cls: string;
        switch (p.state) {
          case 'synced':
            cls = 'status-ok';
            break;
          case 'drifted':
            cls = 'status-warn';
            break;
          case 'unmanaged':
            cls = 'status-unmanaged';
            break;
          case 'not-applied':
            cls = 'status-muted';
            break;
        }
        const filesDisplay = p.files > 0 ? String(p.files) : '—';
        return `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${filesDisplay}</td>
          <td class="${cls}">${escapeHtml(p.status)}</td>
        </tr>`;
      })
      .join('\n');

    return `<table>
            <thead><tr><th>Provider</th><th>Files</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
  }

  private sidebarStyles(nonce: string): string {
    return `<style nonce="${nonce}">
      ${SIDEBAR_CSS_VARIABLES}
      ${SIDEBAR_CSS_RULES}
    </style>`;
  }

}
