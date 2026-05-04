// src/fidelityProvider.ts
//
// R-10: Fidelity report webview. Runs `xcaffold fidelity --format json`
// (preferred) or parses text output (fallback). Renders a styled table
// with color-coded scores.

import * as vscode from 'vscode';
import { BaseWebview, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';

export interface FidelityEntry {
  provider: string;
  score: number;
  notes: string;
}

/**
 * scoreToClass maps a fidelity score to a CSS badge class.
 * Green >= 90%, yellow >= 70%, red < 70%.
 */
export function scoreToClass(score: number): string {
  if (score >= 90) return 'badge-green';
  if (score >= 70) return 'badge-yellow';
  return 'badge-red';
}

/**
 * parseFidelityOutput extracts fidelity entries from CLI output.
 * Tries JSON first, falls back to text table parsing.
 */
export function parseFidelityOutput(stdout: string): FidelityEntry[] {
  if (!stdout.trim()) return [];

  // Try JSON parse first
  try {
    const parsed = JSON.parse(stdout);
    if (parsed.providers && Array.isArray(parsed.providers)) {
      return parsed.providers.map((p: any) => ({
        provider: p.provider || p.name || '',
        score: typeof p.score === 'number' ? p.score : parseInt(p.score, 10),
        notes: p.notes || '',
      }));
    }
  } catch {
    // Not JSON — fall through to text parsing
  }

  // Text fallback: parse table rows
  // Expected format:
  //   Provider    Score  Notes
  //   --------    -----  -----
  //   claude        95%  Full support
  const lines = stdout.split('\n');
  const entries: FidelityEntry[] = [];
  const rowRe = /^(\S+)\s+(\d+)%?\s+(.*)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip header and separator lines
    if (
      trimmed.startsWith('Provider') ||
      trimmed.startsWith('---') ||
      trimmed.startsWith('===') ||
      trimmed === ''
    ) {
      continue;
    }

    const match = rowRe.exec(trimmed);
    if (match) {
      entries.push({
        provider: match[1],
        score: parseInt(match[2], 10),
        notes: match[3].trim(),
      });
    }
  }

  return entries;
}

/**
 * FidelityProvider renders a webview with provider fidelity scores.
 */
export class FidelityProvider extends BaseWebview {
  constructor(
    extensionUri: vscode.Uri,
    dataSource: DataSource,
    workspaceFolder: string,
  ) {
    super(extensionUri, dataSource, workspaceFolder);
  }

  protected getViewType(): string {
    return 'xcaffoldFidelity';
  }

  protected getTitle(): string {
    return 'xcaffold: Fidelity Report';
  }

  protected getStyles(): string {
    return `
      .score-cell { text-align: center; }
      .refresh-btn { margin-bottom: 16px; }
    `;
  }

  protected async getHtmlBody(_webview: vscode.Webview, nonce: string): Promise<string> {
    // Try --format json first, fall back to text
    let stdout: string;
    try {
      const result = await this.dataSource.fetch(
        ['fidelity', '--format', 'json'],
        this.workspaceFolder,
      );
      stdout = result.stdout;
    } catch {
      try {
        const result = await this.dataSource.fetch(
          ['fidelity'],
          this.workspaceFolder,
        );
        stdout = result.stdout;
      } catch (err: any) {
        return `<div class="error">Failed to run fidelity: ${escapeHtml(err.message)}</div>`;
      }
    }

    const entries = parseFidelityOutput(stdout);

    if (entries.length === 0) {
      return `
        <h1>Fidelity Report</h1>
        <p>No fidelity data available. Run "xcaffold apply" first.</p>
      `;
    }

    const rows = entries
      .map(
        (e) => `
        <tr>
          <td>${escapeHtml(e.provider)}</td>
          <td class="score-cell">
            <span class="badge ${scoreToClass(e.score)}">${e.score}%</span>
          </td>
          <td>${escapeHtml(e.notes)}</td>
        </tr>`,
      )
      .join('\n');

    return `
      <h1>Fidelity Report</h1>
      <button class="refresh-btn" onclick="refresh()">Refresh</button>
      <table>
        <thead>
          <tr><th>Provider</th><th>Score</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    `;
  }

  protected handleMessage(message: any): void {
    if (message.command === 'refresh') {
      this.refresh();
    }
  }
}
