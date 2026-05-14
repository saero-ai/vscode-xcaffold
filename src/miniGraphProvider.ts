// src/miniGraphProvider.ts
//
// Sidebar WebviewViewProvider that renders a small D3 force-directed graph
// showing the currently-open .xcaf file's immediate neighbors (1-hop).
// Updates automatically when the active text editor changes.

import * as vscode from 'vscode';
import { generateNonce, escapeHtml } from './webview/baseWebview';
import { DataSource } from './webview/dataSource';
import { XcafIndex } from './xcafIndex';
import {
  KIND_COLORS,
  parseNodeId,
  GraphNode,
  GraphEdge,
  GraphData,
} from './webview/graphWebview';

/** CSS class name for empty-state messages in the mini-graph panel. */
const PLACEHOLDER_CLASS = 'placeholder';

/**
 * buildEmptyStateHtml generates styled placeholder HTML for when the mini-graph
 * has no meaningful content to display. Optionally includes a "View full graph"
 * link that posts a message to the extension host.
 */
export function buildEmptyStateHtml(
  message: string,
  showFullGraphLink: boolean,
  nonce: string,
): string {
  const linkHtml = showFullGraphLink
    ? `<br><a href="#" id="fullGraphLink" style="opacity:0.8; font-size:0.85em; color:var(--vscode-textLink-foreground, #4a9eff);">View full graph</a>`
    : '';
  const linkScript = showFullGraphLink
    ? `<script nonce="${nonce}">
      (function() {
        var vscodeApi = acquireVsCodeApi();
        document.getElementById('fullGraphLink').addEventListener('click', function(e) {
          e.preventDefault();
          vscodeApi.postMessage({ command: 'openFullGraph' });
        });
      })();
    </script>`
    : '';

  return `<div class="${PLACEHOLDER_CLASS}">${escapeHtml(message)}${linkHtml}</div>${linkScript}`;
}

// -- Exported types and pure functions for testability -------------------

/** Result of extracting a 1-hop neighborhood from the full graph. */
export interface MiniGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerNodeId: string;
}

/**
 * extractNeighborhood filters a full graph down to a 1-hop neighborhood
 * around the given center node. Includes:
 * - The center node itself
 * - All nodes directly connected via edges (in either direction)
 * - All edges where both endpoints are in the neighborhood
 */
export function extractNeighborhood(
  allNodes: GraphNode[],
  allEdges: GraphEdge[],
  centerNodeId: string,
): MiniGraphData {
  // Find center node
  const centerNode = allNodes.find((n) => n.id === centerNodeId);
  if (!centerNode) {
    return { nodes: [], edges: [], centerNodeId };
  }

  // Collect direct neighbor IDs (1-hop)
  const neighborIds = new Set<string>();
  neighborIds.add(centerNodeId);

  const relevantEdges: GraphEdge[] = [];
  for (const edge of allEdges) {
    if (edge.from === centerNodeId) {
      neighborIds.add(edge.to);
      relevantEdges.push(edge);
    } else if (edge.to === centerNodeId) {
      neighborIds.add(edge.from);
      relevantEdges.push(edge);
    }
  }

  // Filter nodes to only those in the neighborhood
  const nodes = allNodes.filter((n) => neighborIds.has(n.id));

  return { nodes, edges: relevantEdges, centerNodeId };
}

// -- CSS for sidebar mini-graph ------------------------------------------

const MINI_GRAPH_CSS_VARS = `:root {
  --bg: var(--vscode-editor-background);
  --fg: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border, #333);
}`;

const MINI_GRAPH_CSS_RULES = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--fg);
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  padding: 0; overflow: hidden;
}
#canvas { width: 100%; height: 200px; display: block; }
.placeholder {
  text-align: center; padding: 24px 12px;
  opacity: 0.6; font-size: 0.9em; line-height: 1.5;
}
.link {
  stroke: #555; stroke-opacity: 0.5; stroke-width: 1.5px;
  marker-end: url(#arrowhead);
}
.node text {
  font: 10px var(--vscode-font-family, sans-serif);
  fill: var(--fg); pointer-events: none;
}
.node circle {
  stroke: #fff; stroke-width: 1.5px; cursor: pointer;
}
.node.center circle {
  stroke-width: 2.5px; stroke: #fff;
}
.error { color: #f44336; padding: 12px; font-size: 0.9em; }`;

// -- CSP for mini-graph --------------------------------------------------

function buildMiniGraphCsp(
  cspSource: string,
  nonce: string,
): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    `img-src ${cspSource}`,
    `font-src ${cspSource}`,
  ].join('; ');
}

// -- Mini-graph body HTML ------------------------------------------------

function buildMiniGraphBody(
  data: MiniGraphData,
  nonce: string,
  kindColorsJson: string,
): string {
  // No data at all — show generic empty message
  if (!data || !data.nodes || data.nodes.length === 0) {
    return buildEmptyStateHtml(
      'No dependency data available.',
      false,
      nonce,
    );
  }

  // Center node exists but has no connections — show informative message
  if (data.edges.length === 0) {
    const parsed = parseNodeId(data.centerNodeId);
    const label = parsed
      ? `${parsed.name} has no dependencies.`
      : 'No dependencies for this resource.';
    return buildEmptyStateHtml(label, true, nonce);
  }

  const dataJson = JSON.stringify(data);

  return `
    <svg id="canvas"></svg>
    <script nonce="${nonce}">
      (function() {
        var vscodeApi = acquireVsCodeApi();
        var data = ${dataJson};
        var kindColors = ${kindColorsJson};
        var defaultColor = '#999999';
        var CENTER_RADIUS = 10;
        var NEIGHBOR_RADIUS = 6;

        function colorFor(kind) {
          return kindColors[kind] || defaultColor;
        }

        var width = document.body.clientWidth || 260;
        var height = 200;

        var svg = d3.select('#canvas')
          .attr('viewBox', [0, 0, width, height]);

        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 15)
          .attr('refY', 0)
          .attr('orient', 'auto')
          .attr('markerWidth', 5)
          .attr('markerHeight', 5)
          .append('path')
          .attr('d', 'M 0,-5 L 10,0 L 0,5')
          .attr('fill', '#555')
          .style('stroke', 'none');

        var container = svg.append('g');

        var links = data.edges.map(function(e) {
          return { source: e.from, target: e.to, label: e.label };
        });

        var simulation = d3.forceSimulation(data.nodes)
          .force('link', d3.forceLink(links)
            .id(function(d) { return d.id; })
            .distance(60))
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(width / 2, height / 2));

        var link = container.append('g')
          .selectAll('line')
          .data(links)
          .join('line')
          .attr('class', 'link');

        var node = container.append('g')
          .selectAll('g')
          .data(data.nodes)
          .join('g')
          .attr('class', function(d) {
            return d.id === data.centerNodeId ? 'node center' : 'node';
          });

        node.append('circle')
          .attr('r', function(d) {
            return d.id === data.centerNodeId ? CENTER_RADIUS : NEIGHBOR_RADIUS;
          })
          .attr('fill', function(d) { return colorFor(d.kind); });

        node.append('text')
          .attr('x', function(d) {
            return (d.id === data.centerNodeId ? CENTER_RADIUS : NEIGHBOR_RADIUS) + 3;
          })
          .attr('y', 3)
          .text(function(d) { return d.label || d.id; });

        node.on('click', function(event, d) {
          vscodeApi.postMessage({ command: 'openFile', nodeId: d.id });
        });

        simulation.on('tick', function() {
          link
            .attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });
          node.attr('transform', function(d) {
            return 'translate(' + d.x + ',' + d.y + ')';
          });
        });
      })();
    </script>
  `;
}

// -- MiniGraphProvider class ---------------------------------------------

/**
 * MiniGraphProvider renders a small D3 graph in the sidebar showing
 * the currently-open .xcaf file's 1-hop dependency neighborhood.
 */
export class MiniGraphProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly dataSource: DataSource,
    private readonly workspaceFolder: string,
    private readonly xcafIndex: XcafIndex,
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

    // Listen for messages from the webview
    const msgDisposable = webviewView.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
    );
    this._disposables.push(msgDisposable);

    // Listen for active editor changes
    const editorDisposable = vscode.window.onDidChangeActiveTextEditor(
      () => this.refresh(),
    );
    this._disposables.push(editorDisposable);

    webviewView.onDidDispose(() => {
      this._view = undefined;
      for (const d of this._disposables) {
        d.dispose();
      }
      this._disposables = [];
    });

    // Initial render
    this.refresh();
  }

  /**
   * refresh re-renders the mini-graph for the current active editor.
   */
  async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const filePath = editor?.document?.fileName;

    // Show placeholder for non-xcaf files
    if (!filePath || !filePath.endsWith('.xcaf')) {
      this.renderPlaceholder();
      return;
    }

    // Look up the node ID from the xcaf index
    const nodeId = this.resolveNodeId(filePath);
    if (!nodeId) {
      this.renderPlaceholder();
      return;
    }

    await this.renderGraph(nodeId);
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  private resolveNodeId(filePath: string): string | undefined {
    // Iterate all entries to find the one matching this file path
    const entries = this.xcafIndex.allEntries();
    for (const entry of entries) {
      if (entry.fileUri === filePath) {
        return `${entry.kind}:${entry.name}`;
      }
    }
    return undefined;
  }

  private renderPlaceholder(): void {
    if (!this._view) {
      return;
    }
    const nonce = generateNonce();
    const csp = buildMiniGraphCsp(
      this._view.webview.cspSource,
      nonce,
    );
    this._view.webview.html = this.buildHtml(
      csp,
      nonce,
      '<div class="placeholder">Open an .xcaf file to see its dependencies.</div>',
    );
  }

  /**
   * renderMessage shows a styled message with an optional "View full graph" link.
   * Used when the graph has no useful content to display (e.g., no edges, no data).
   */
  private renderMessage(
    text: string,
    showFullGraphLink: boolean,
  ): void {
    if (!this._view) {
      return;
    }
    const nonce = generateNonce();
    const csp = buildMiniGraphCsp(
      this._view.webview.cspSource,
      nonce,
    );
    const body = buildEmptyStateHtml(text, showFullGraphLink, nonce);
    this._view.webview.html = this.buildHtml(csp, nonce, body);
  }

  private async fetchNeighborhood(
    centerNodeId: string,
  ): Promise<MiniGraphData | null> {
    const result = await this.dataSource.fetch(
      ['graph', '--format', 'json'],
      this.workspaceFolder,
    );

    let graphData: GraphData;
    try {
      const parsed = JSON.parse(result.stdout);
      graphData = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return null;
    }

    if (!graphData || !graphData.nodes) {
      return null;
    }

    const neighborhood = extractNeighborhood(
      graphData.nodes,
      graphData.edges || [],
      centerNodeId,
    );

    return neighborhood.nodes.length > 0 ? neighborhood : null;
  }

  private async renderGraph(centerNodeId: string): Promise<void> {
    if (!this._view) {
      return;
    }

    const webview = this._view.webview;
    const nonce = generateNonce();
    const csp = buildMiniGraphCsp(webview.cspSource, nonce);

    // Show loading state
    webview.html = this.buildHtml(
      csp,
      nonce,
      '<div class="placeholder">Loading graph...</div>',
    );

    try {
      const neighborhood = await this.fetchNeighborhood(centerNodeId);

      if (!neighborhood) {
        this.renderMessage(
          'Run xcaffold apply to generate dependency data.',
          false,
        );
        return;
      }

      // Build the D3 script URI
      const d3Uri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'd3.js'),
      );

      const freshNonce = generateNonce();
      const freshCsp = buildMiniGraphCsp(
        webview.cspSource,
        freshNonce,
      );
      const body = buildMiniGraphBody(
        neighborhood,
        freshNonce,
        JSON.stringify(KIND_COLORS),
      );

      webview.html = this.buildHtmlWithD3(
        freshCsp,
        freshNonce,
        body,
        String(d3Uri),
      );
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : String(err);
      this.renderError(message);
    }
  }

  private renderError(message: string): void {
    if (!this._view) {
      return;
    }
    const nonce = generateNonce();
    const csp = buildMiniGraphCsp(
      this._view.webview.cspSource,
      nonce,
    );
    this._view.webview.html = this.buildHtml(
      csp,
      nonce,
      `<div class="error">${escapeHtml(message)}</div>`,
    );
  }

  private buildHtml(
    csp: string,
    nonce: string,
    body: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Dependencies</title>
    <style nonce="${nonce}">
      ${MINI_GRAPH_CSS_VARS}
      ${MINI_GRAPH_CSS_RULES}
    </style>
</head>
<body>
    ${body}
</body>
</html>`;
  }

  private buildHtmlWithD3(
    csp: string,
    nonce: string,
    body: string,
    d3ScriptUri: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Dependencies</title>
    <style nonce="${nonce}">
      ${MINI_GRAPH_CSS_VARS}
      ${MINI_GRAPH_CSS_RULES}
    </style>
    <script nonce="${nonce}" src="${d3ScriptUri}"></script>
</head>
<body>
    ${body}
</body>
</html>`;
  }

  private handleMessage(message: { command: string; nodeId?: string }): void {
    if (message.command === 'openFile' && message.nodeId) {
      this.openNodeFile(message.nodeId);
    } else if (message.command === 'openFullGraph') {
      vscode.commands.executeCommand('xcaffold.graph');
    }
  }

  private openNodeFile(nodeId: string): void {
    const parsed = parseNodeId(nodeId);
    if (!parsed) {
      return;
    }

    const entry = this.xcafIndex.resolve(parsed.kind, parsed.name);
    if (entry) {
      const uri = vscode.Uri.file(entry.fileUri);
      vscode.window.showTextDocument(uri, {
        viewColumn: vscode.ViewColumn.One,
      });
    }
  }
}
