import * as vscode from 'vscode';

export interface StatusInfo {
  lastApplied: string | null;
  drift: 'Clean' | 'Drifted' | 'Unknown';
}

/**
 * parseStatusOutput extracts last-applied timestamp and drift status
 * from `xcaffold status` CLI text output.
 */
export function parseStatusOutput(stdout: string): StatusInfo {
  const lines = stdout.split('\n');

  let lastApplied: string | null = null;
  let drift: 'Clean' | 'Drifted' | 'Unknown' = 'Unknown';

  const lastAppliedRe = /^Last applied:\s*(.+)$/i;
  const driftRe = /^Drift:\s*(.+)$/i;

  for (const line of lines) {
    const trimmed = line.trim();

    const lastMatch = lastAppliedRe.exec(trimmed);
    if (lastMatch) {
      lastApplied = lastMatch[1].trim();
      continue;
    }

    const driftMatch = driftRe.exec(trimmed);
    if (driftMatch) {
      const val = driftMatch[1].trim();
      if (val === 'Clean' || val === 'Drifted') {
        drift = val;
      }
    }
  }

  return { lastApplied, drift };
}

/**
 * formatStatusText builds the status bar display string.
 */
export function formatStatusText(
  version: string | null,
  lastApplied: string | null,
  drift: string,
): string {
  const v = version ? `v${version}` : 'v?';
  const last = lastApplied || 'n/a';
  return `xcaffold: ${v} | Last: ${last} | ${drift}`;
}

/**
 * StatusBarProvider manages the xcaffold status bar item.
 * Shows version, last apply timestamp, and drift status.
 */
export class StatusBarProvider implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private version: string | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.item.name = 'xcaffold Status';
    this.item.command = 'xcaffold.status';
    this.item.text = formatStatusText(null, null, 'Unknown');
    this.item.show();
  }

  /**
   * setVersion caches the CLI version string.
   */
  setVersion(version: string): void {
    this.version = version;
  }

  /**
   * update refreshes the status bar text from parsed status output.
   */
  update(statusOutput: string): void {
    const info = parseStatusOutput(statusOutput);
    this.item.text = formatStatusText(
      this.version,
      info.lastApplied,
      info.drift,
    );

    // Color coding for drift
    if (info.drift === 'Drifted') {
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground',
      );
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  /**
   * updateFromError sets status bar to reflect a CLI error.
   */
  updateFromError(): void {
    this.item.text = formatStatusText(this.version, null, 'Unknown');
    this.item.backgroundColor = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}

/**
 * XcafDocumentInfoProvider shows word/line count for the active .xcaf file.
 */
export class XcafDocumentInfoProvider implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      90,
    );
    this.item.name = 'xcaf Document Info';

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => this.updateFromEditor(editor)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor?.document === e.document) {
          this.updateFromEditor(vscode.window.activeTextEditor);
        }
      }),
    );

    this.updateFromEditor(vscode.window.activeTextEditor);
  }

  private updateFromEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor || !editor.document.fileName.endsWith('.xcaf')) {
      this.item.hide();
      return;
    }
    const text = editor.document.getText();
    const lines = editor.document.lineCount;
    const words = text.split(/\s+/).filter(Boolean).length;
    this.item.text = `${lines} lines, ${words} words`;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
