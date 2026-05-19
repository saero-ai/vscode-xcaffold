// src/statusDashProvider.ts
//
// Status dashboard webview. Runs `xcaffold status` and parses text
// output. Shows per-provider cards with name, status icon, last
// applied, file count, drift indicator, and an "Apply" button per card.

import * as vscode from 'vscode';
import { BaseWebview, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';

export interface ProviderStatus {
  name: string;
  status: string;
  lastApplied: string | null;
  fileCount: number;
  drift: boolean;
}

/**
 * driftIcon returns a unicode indicator for drift status.
 */
export function driftIcon(drifted: boolean): string {
  return drifted ? '⚠' : '✓';
}

/**
 * parseStatusDashOutput extracts per-provider status from CLI text output.
 * Parses "Provider: xxx" blocks emitted by `xcaffold status`.
 */
export function parseStatusDashOutput(stdout: string): ProviderStatus[] {
  if (!stdout.trim()) return [];

  // Parse "Provider: xxx" blocks
  const lines = stdout.split('\n');
  const providers: ProviderStatus[] = [];
  let current: Partial<ProviderStatus> | null = null;

  const providerRe = /^Provider:\s*(.+)$/i;
  const statusRe = /^\s*Status:\s*(.+)$/i;
  const lastAppliedRe = /^\s*Last applied:\s*(.+)$/i;
  const filesRe = /^\s*Files:\s*(\d+)/i;
  const driftRe = /^\s*Drift:\s*(.+)$/i;

  for (const line of lines) {
    const provMatch = providerRe.exec(line);
    if (provMatch) {
      if (current && current.name) {
        providers.push(finalizeProvider(current));
      }
      current = { name: provMatch[1].trim() };
      continue;
    }

    if (!current) continue;

    const statusMatch = statusRe.exec(line);
    if (statusMatch) {
      current.status = statusMatch[1].trim();
      continue;
    }

    const lastMatch = lastAppliedRe.exec(line);
    if (lastMatch) {
      current.lastApplied = lastMatch[1].trim();
      continue;
    }

    const filesMatch = filesRe.exec(line);
    if (filesMatch) {
      current.fileCount = parseInt(filesMatch[1], 10);
      continue;
    }

    const driftMatch = driftRe.exec(line);
    if (driftMatch) {
      const val = driftMatch[1].trim().toLowerCase();
      current.drift = val === 'drifted' || val === 'true';
    }
  }

  if (current && current.name) {
    providers.push(finalizeProvider(current));
  }

  return providers;
}

function finalizeProvider(
  partial: Partial<ProviderStatus>,
): ProviderStatus {
  return {
    name: partial.name || '',
    status: partial.status || 'unknown',
    lastApplied: partial.lastApplied || null,
    fileCount: partial.fileCount || 0,
    drift: partial.drift || false,
  };
}

/**
 * StatusDashProvider renders a dashboard with per-provider status cards.
 */
export class StatusDashProvider extends BaseWebview {
  constructor(
    extensionUri: vscode.Uri,
    dataSource: DataSource,
    workspaceFolder: string,
  ) {
    super(extensionUri, dataSource, workspaceFolder);
  }

  protected getViewType(): string {
    return 'xcaffoldStatusDash';
  }

  protected getTitle(): string {
    return 'xcaffold: Status Dashboard';
  }

  protected getStyles(): string {
    return `
      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
      .provider-card { position: relative; }
      .provider-card h2 { display: flex; align-items: center; gap: 8px; }
      .drift-icon { font-size: 1.2em; }
      .drift-ok { color: var(--success); }
      .drift-warn { color: var(--warning); }
      .meta { opacity: 0.7; margin: 4px 0; font-size: 0.9em; }
      .apply-btn { margin-top: 12px; }
      .toolbar { margin-bottom: 16px; display: flex; gap: 8px; }
    `;
  }

  protected async getHtmlBody(webview: vscode.Webview, nonce: string): Promise<string> {
    let stdout: string;
    try {
      const result = await this.dataSource.fetch(
        ['status'],
        this.workspaceFolder,
      );
      stdout = result.stdout;
    } catch (err: any) {
      return `<div class="error">Failed to run status: ${escapeHtml(err.message)}</div>`;
    }

    const providers = parseStatusDashOutput(stdout);

    if (providers.length === 0) {
      return `
        <h1>Status Dashboard</h1>
        <p>No provider status available. Run "xcaffold init" or "xcaffold apply" first.</p>
      `;
    }

    const cards = providers
      .map((p) => {
        const iconClass = p.drift ? 'drift-warn' : 'drift-ok';
        const icon = driftIcon(p.drift);
        const statusBadge = p.drift ? 'badge-yellow' : 'badge-green';
        const lastApplied = p.lastApplied || 'Never';

        return `
          <div class="card provider-card">
            <h2>
              <span class="drift-icon ${iconClass}">${icon}</span>
              ${escapeHtml(p.name)}
            </h2>
            <div class="meta">Status: <span class="badge ${statusBadge}">${escapeHtml(p.status)}</span></div>
            <div class="meta">Last applied: ${escapeHtml(lastApplied)}</div>
            <div class="meta">Files: ${p.fileCount}</div>
            <button class="apply-btn" data-provider="${escapeHtml(p.name)}"
              onclick="applyProvider('${escapeHtml(p.name)}')">
              Apply ${escapeHtml(p.name)}
            </button>
          </div>
        `;
      })
      .join('\n');

    return `
      <h1>Status Dashboard</h1>
      <div class="toolbar">
        <button onclick="refreshDash()">Refresh</button>
        <button onclick="applyAll()">Apply All</button>
      </div>
      <div class="cards">${cards}</div>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function applyProvider(name) {
          vscode.postMessage({ command: 'apply', provider: name });
        }
        function applyAll() {
          vscode.postMessage({ command: 'applyAll' });
        }
        function refreshDash() {
          vscode.postMessage({ command: 'refresh' });
        }
      </script>
    `;
  }

  protected handleMessage(message: any): void {
    switch (message.command) {
      case 'apply':
        vscode.commands.executeCommand('xcaffold.apply', message.provider);
        break;
      case 'applyAll':
        vscode.commands.executeCommand('xcaffold.apply');
        break;
      case 'refresh':
        this.refresh();
        break;
    }
  }
}
