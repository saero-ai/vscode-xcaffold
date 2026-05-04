// src/schemaViewerProvider.ts
//
// R-12: Schema viewer webview. Quick pick to select a kind, then runs
// `xcaffold help --xcf <kind>` and renders the schema reference
// with fields grouped by group name.

import * as vscode from 'vscode';
import { BaseWebview, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  group: string;
  description: string;
}

const KNOWN_KINDS = [
  'agent',
  'skill',
  'rule',
  'workflow',
  'mcp',
  'project',
  'settings',
  'hooks',
  'global',
  'policy',
  'blueprint',
];

/**
 * parseSchemaOutput extracts field definitions from `help --xcf` output.
 * Tries JSON first, falls back to text parsing.
 */
export function parseSchemaOutput(stdout: string): SchemaField[] {
  if (!stdout.trim()) return [];

  // Try JSON parse first
  try {
    const parsed = JSON.parse(stdout);
    if (parsed.fields && Array.isArray(parsed.fields)) {
      return parsed.fields.map((f: any) => ({
        name: f.name || '',
        type: f.type || 'string',
        required: f.required === true,
        group: f.group || '',
        description: f.description || '',
      }));
    }
  } catch {
    // Not JSON — fall through to text parsing
  }

  // Text fallback: parse tabular field rows
  // Expected format after "Fields:" header:
  //   name          string    required  identity   Agent name
  const lines = stdout.split('\n');
  const fields: SchemaField[] = [];
  let inFields = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'Fields:' || trimmed === 'FIELDS:') {
      inFields = true;
      continue;
    }

    if (!inFields) continue;
    if (trimmed === '') continue;

    // Parse whitespace-separated columns
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length >= 4) {
      fields.push({
        name: parts[0],
        type: parts[1],
        required: parts[2] === 'required',
        group: parts[3] || '',
        description: parts.slice(4).join(' ') || '',
      });
    }
  }

  return fields;
}

/**
 * groupFieldsByGroup organizes fields into a map keyed by group name.
 */
export function groupFieldsByGroup(
  fields: SchemaField[],
): Map<string, SchemaField[]> {
  const groups = new Map<string, SchemaField[]>();
  for (const field of fields) {
    const group = field.group;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(field);
  }
  return groups;
}

/**
 * SchemaViewerProvider shows a formatted schema reference for a selected kind.
 */
export class SchemaViewerProvider extends BaseWebview {
  private selectedKind: string | undefined;

  constructor(
    extensionUri: vscode.Uri,
    dataSource: DataSource,
    workspaceFolder: string,
  ) {
    super(extensionUri, dataSource, workspaceFolder);
  }

  protected getViewType(): string {
    return 'xcaffoldSchemaViewer';
  }

  protected getTitle(): string {
    return this.selectedKind
      ? `xcaffold: Schema — ${this.selectedKind}`
      : 'xcaffold: Schema Viewer';
  }

  protected getStyles(): string {
    return `
      .group-header {
        font-size: 1.1em;
        font-weight: 600;
        margin-top: 16px;
        margin-bottom: 4px;
        padding: 4px 0;
        border-bottom: 2px solid var(--accent);
        text-transform: capitalize;
      }
      .required-badge {
        color: var(--error);
        font-weight: 600;
        font-size: 0.85em;
      }
      .optional-badge {
        opacity: 0.5;
        font-size: 0.85em;
      }
      .type-col {
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 0.9em;
        opacity: 0.8;
      }
      .kind-selector { margin-bottom: 16px; }
    `;
  }

  /**
   * promptAndShow shows the kind picker, then opens the webview.
   */
  async promptAndShow(
    viewColumn?: vscode.ViewColumn,
  ): Promise<void> {
    const kind = await vscode.window.showQuickPick(KNOWN_KINDS, {
      placeHolder: 'Select a resource kind to view its schema',
      title: 'xcaffold: Schema Viewer',
    });

    if (!kind) return; // User cancelled

    this.selectedKind = kind;
    this.show(viewColumn);
  }

  protected async getHtmlBody(webview: vscode.Webview, nonce: string): Promise<string> {
    if (!this.selectedKind) {
      return '<p>No kind selected. Run the command again to choose a kind.</p>';
    }

    let stdout: string;
    try {
      const result = await this.dataSource.fetch(
        ['help', '--xcf', this.selectedKind],
        this.workspaceFolder,
      );
      stdout = result.stdout;
    } catch (err: any) {
      return `<div class="error">Failed to load schema for ${escapeHtml(this.selectedKind)}: ${escapeHtml(err.message)}</div>`;
    }

    const fields = parseSchemaOutput(stdout);

    if (fields.length === 0) {
      return `
        <h1>Schema: ${escapeHtml(this.selectedKind)}</h1>
        <p>No field data available for this kind.</p>
      `;
    }

    const grouped = groupFieldsByGroup(fields);
    let tablesHtml = '';

    for (const [group, groupFields] of grouped) {
      const groupTitle = group || 'General';
      const rows = groupFields
        .map(
          (f) => `
          <tr>
            <td><strong>${escapeHtml(f.name)}</strong></td>
            <td class="type-col">${escapeHtml(f.type)}</td>
            <td>${f.required
              ? '<span class="required-badge">required</span>'
              : '<span class="optional-badge">optional</span>'
            }</td>
            <td>${escapeHtml(f.description)}</td>
          </tr>`,
        )
        .join('\n');

      tablesHtml += `
        <div class="group-header">${escapeHtml(groupTitle)}</div>
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    return `
      <h1>Schema: ${escapeHtml(this.selectedKind)}</h1>
      <button onclick="changeKind()">Change Kind</button>
      ${tablesHtml}
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function changeKind() {
          vscode.postMessage({ command: 'changeKind' });
        }
      </script>
    `;
  }

  protected handleMessage(message: any): void {
    if (message.command === 'changeKind') {
      this.promptAndShow();
    }
  }
}
