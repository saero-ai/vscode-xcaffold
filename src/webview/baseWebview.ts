// src/webview/baseWebview.ts
//
// Abstract base class for xcaffold webview panels. Provides:
// - Dark theme CSS via VS Code CSS variables
// - Scripts loaded via webview.asWebviewUri() (CSP compliant)
// - postMessage / onDidReceiveMessage bridge
// - Disposable lifecycle management
// - Content Security Policy via webview.cspSource + nonces
// - Data source abstraction (interface, not direct CLI)

import * as vscode from 'vscode';
import { DataSource } from './dataSource';

/**
 * generateNonce creates a 32-character random alphanumeric string
 * used for Content Security Policy script nonces.
 */
export function generateNonce(): string {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * buildCsp constructs a Content Security Policy string for webview panels.
 */
export function buildCsp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
  ].join('; ');
}

export interface WrapHtmlOptions {
  title: string;
  cspSource: string;
  nonce: string;
  body: string;
  scripts: Array<{ uri: string }>;
  styles: string;
}

/**
 * BASE_STYLES provides dark theme integration using VS Code CSS variables.
 */
const BASE_STYLES = `
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border, #333);
    --accent: var(--vscode-focusBorder, #007acc);
    --badge-bg: var(--vscode-badge-background, #4d4d4d);
    --badge-fg: var(--vscode-badge-foreground, #fff);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #fff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
    --success: #4caf50;
    --warning: #ff9800;
    --error: #f44336;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    padding: 16px;
    line-height: 1.5;
  }
  button {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border: none;
    padding: 6px 14px;
    border-radius: 2px;
    cursor: pointer;
    font-size: inherit;
  }
  button:hover { background: var(--btn-hover); }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  th { font-weight: 600; }
  .card {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 16px;
    margin: 8px 0;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.85em;
    font-weight: 600;
  }
  .badge-green { background: var(--success); color: #fff; }
  .badge-yellow { background: var(--warning); color: #000; }
  .badge-red { background: var(--error); color: #fff; }
  .badge-gray { background: var(--badge-bg); color: var(--badge-fg); }
  h1 { font-size: 1.4em; margin-bottom: 12px; }
  h2 { font-size: 1.2em; margin-bottom: 8px; }
  .loading { text-align: center; padding: 40px; opacity: 0.6; }
  .error { color: var(--error); padding: 16px; }
`;

/**
 * wrapHtml generates a complete HTML document for a webview panel.
 */
export function wrapHtml(options: WrapHtmlOptions): string {
  const nonce = options.nonce;
  const csp = buildCsp(options.cspSource, nonce);

  const scriptTags = options.scripts
    .map((s) => `<script nonce="${nonce}" src="${s.uri}"></script>`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>${options.title}</title>
    <style nonce="${nonce}">${BASE_STYLES}${options.styles}</style>
    ${scriptTags}
</head>
<body>
    ${options.body}
</body>
</html>`;
}

/**
 * BaseWebview is the abstract base class for all xcaffold webview panels.
 * Subclasses implement getTitle(), getHtmlBody(), and handleMessage().
 */
export abstract class BaseWebview implements vscode.Disposable {
  protected panel: vscode.WebviewPanel | undefined;
  protected disposables: vscode.Disposable[] = [];

  constructor(
    protected readonly extensionUri: vscode.Uri,
    protected readonly dataSource: DataSource,
    protected readonly workspaceFolder: string,
  ) {}

  /**
   * show creates or reveals the webview panel.
   */
  show(viewColumn?: vscode.ViewColumn): void {
    if (this.panel) {
      this.panel.reveal(viewColumn);
      this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      this.getViewType(),
      this.getTitle(),
      viewColumn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist'),
        ],
      },
    );

    this.panel.onDidDispose(
      () => this.onDispose(),
      null,
      this.disposables,
    );

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );

    this.refresh();
  }

  /**
   * refresh re-renders the webview content by fetching fresh data.
   */
  async refresh(): Promise<void> {
    if (!this.panel) return;

    const webview = this.panel.webview;
    const nonce = generateNonce();

    // Show loading state
    webview.html = wrapHtml({
      title: this.getTitle(),
      cspSource: webview.cspSource,
      nonce,
      body: '<div class="loading">Loading...</div>',
      scripts: this.getScriptUris(webview),
      styles: this.getStyles(),
    });

    try {
      const body = await this.getHtmlBody(webview, nonce);
      webview.html = wrapHtml({
        title: this.getTitle(),
        cspSource: webview.cspSource,
        nonce,
        body,
        scripts: this.getScriptUris(webview),
        styles: this.getStyles(),
      });
    } catch (err: any) {
      webview.html = wrapHtml({
        title: this.getTitle(),
        cspSource: webview.cspSource,
        nonce,
        body: `<div class="error">Error: ${escapeHtml(err.message)}</div>`,
        scripts: [],
        styles: this.getStyles(),
      });
    }
  }

  /**
   * postMessage sends a message from the extension to the webview.
   */
  protected postMessage(message: unknown): void {
    this.panel?.webview.postMessage(message);
  }

  /**
   * getScriptUris returns script URIs to include in the webview.
   * Override in subclasses that need D3 or other scripts.
   */
  protected getScriptUris(
    _webview: vscode.Webview,
  ): Array<{ uri: string }> {
    return [];
  }

  /**
   * getStyles returns additional CSS to include beyond BASE_STYLES.
   * Override in subclasses for provider-specific styling.
   */
  protected getStyles(): string {
    return '';
  }

  private onDispose(): void {
    this.panel = undefined;
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
    this.onDidDispose();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  /** Subclass hook called after the panel is disposed. */
  protected onDidDispose(): void {}

  /** Unique view type identifier for the webview panel. */
  protected abstract getViewType(): string;

  /** Display title for the webview panel tab. */
  protected abstract getTitle(): string;

  /** Generate the HTML body content. Called on every refresh. Nonce must be used on all inline script tags. */
  protected abstract getHtmlBody(webview: vscode.Webview, nonce: string): Promise<string>;

  /** Handle messages from the webview script. */
  protected abstract handleMessage(message: any): void;
}

/**
 * escapeHtml prevents XSS in error messages rendered into webview HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
