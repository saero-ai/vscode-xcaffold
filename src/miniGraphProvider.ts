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
  computeRefCounts,
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
#canvas { width: 100%; height: 100vh; display: block; }
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
.node.pinned circle { stroke-dasharray: 3 2; }
.node.dimmed { opacity: 0.15; }
.link.dimmed { opacity: 0.05; }
.node.focused circle { stroke: #fff; stroke-width: 3px; filter: drop-shadow(0 0 4px rgba(255,255,255,0.5)); }
.graph-tooltip {
  position: absolute; pointer-events: none;
  background: var(--vscode-editorHoverWidget-background, #2d2d30);
  border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
  color: var(--fg); padding: 6px 10px; border-radius: 4px;
  font-size: 11px; max-width: 220px; opacity: 0;
  transition: opacity 0.15s; z-index: 20;
}
.graph-tooltip.visible { opacity: 1; }
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

// -- Full-graph body HTML -------------------------------------------------

export function buildFullGraphBody(
  data: GraphData,
  nonce: string,
  kindColorsJson: string,
  refCountsJson: string,
  focusNodeId?: string,
): string {
  if (!data || !data.nodes || data.nodes.length === 0) {
    return buildEmptyStateHtml(
      'No graph data available. Run xcaffold apply first.',
      true,
      nonce,
    );
  }

  const dataJson = JSON.stringify(data);

  return `
    <div class="graph-tooltip" id="tooltip"></div>
    <svg id="canvas"></svg>
    <script nonce="${nonce}">
      (function() {
        var vscodeApi = acquireVsCodeApi();
        var data = ${dataJson};
        var kindColors = ${kindColorsJson};
        var refCounts = ${refCountsJson};
        var defaultColor = '#999999';
        var MIN_RADIUS = 5;
        var MAX_RADIUS = 16;
        var focusedId = ${focusNodeId ? JSON.stringify(focusNodeId) : 'null'};

        var maxRef = 0;
        for (var k in refCounts) {
          if (refCounts[k] > maxRef) maxRef = refCounts[k];
        }

        function radius(nodeId) {
          var count = refCounts[nodeId] || 0;
          if (maxRef <= 0) return MIN_RADIUS;
          return MIN_RADIUS + (count / maxRef) * (MAX_RADIUS - MIN_RADIUS);
        }

        function colorFor(kind) {
          return kindColors[kind] || defaultColor;
        }

        function esc(str) {
          return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        var links = data.edges.map(function(e) {
          return { source: e.from, target: e.to, label: e.label };
        });

        var targetCounts = {};
        data.edges.forEach(function(e) {
          targetCounts[e.from] = (targetCounts[e.from] || 0) + 1;
        });

        var width = document.body.clientWidth || 260;
        var height = window.innerHeight || 400;

        var svg = d3.select('#canvas')
          .attr('viewBox', [0, 0, width, height]);

        var zoomBehavior = d3.zoom()
          .scaleExtent([0.1, 4])
          .on('zoom', function(event) {
            container.attr('transform', event.transform);
          });
        svg.call(zoomBehavior);

        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 18)
          .attr('refY', 0)
          .attr('orient', 'auto')
          .attr('markerWidth', 5)
          .attr('markerHeight', 5)
          .append('path')
          .attr('d', 'M 0,-5 L 10,0 L 0,5')
          .attr('fill', '#555')
          .style('stroke', 'none');

        var container = svg.append('g');

        var simulation = d3.forceSimulation(data.nodes)
          .force('link', d3.forceLink(links)
            .id(function(d) { return d.id; })
            .distance(80))
          .force('charge', d3.forceManyBody().strength(-300))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide().radius(function(d) {
            return radius(d.id) + 3;
          }));

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
            return d.id === focusedId ? 'node focused' : 'node';
          });

        node.append('circle')
          .attr('r', function(d) { return radius(d.id); })
          .attr('fill', function(d) { return colorFor(d.kind); });

        node.append('text')
          .attr('x', function(d) { return radius(d.id) + 3; })
          .attr('y', 3)
          .text(function(d) { return d.label || d.id; });

        // Tooltip
        var tooltip = document.getElementById('tooltip');

        node.on('mouseover', function(event, d) {
          var refs = refCounts[d.id] || 0;
          var targets = targetCounts[d.id] || 0;
          tooltip.innerHTML =
            '<div style="font-weight:600;color:' + colorFor(d.kind) + '">' + esc(d.kind) + '</div>' +
            '<div style="opacity:0.8">' + esc(d.label || d.id) + '</div>' +
            '<div style="font-size:10px;opacity:0.6">' +
              refs + ' ref' + (refs !== 1 ? 's' : '') + ' · ' +
              targets + ' target' + (targets !== 1 ? 's' : '') +
            '</div>';
          tooltip.classList.add('visible');
        });
        node.on('mousemove', function(event) {
          tooltip.style.left = (event.pageX + 10) + 'px';
          tooltip.style.top = (event.pageY - 8) + 'px';
        });
        node.on('mouseout', function() {
          tooltip.classList.remove('visible');
        });

        // Click to open file
        node.on('click', function(event, d) {
          vscodeApi.postMessage({ command: 'openFile', nodeId: d.id });
        });

        // Drag to pin
        var dragBehavior = d3.drag()
          .on('start', function(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', function(event, d) {
            d.fx = event.x; d.fy = event.y;
          })
          .on('end', function(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d3.select(this).classed('pinned', true);
          });
        node.call(dragBehavior);

        // Double-click to unpin
        node.on('dblclick', function(event, d) {
          d.fx = null; d.fy = null;
          d3.select(this).classed('pinned', false);
          simulation.alphaTarget(0.1).restart();
          setTimeout(function() { simulation.alphaTarget(0); }, 500);
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

        // Focus: zoom to a specific node
        function focusOnNode(nodeId) {
          var target = data.nodes.find(function(n) { return n.id === nodeId; });
          if (!target || target.x == null) return;
          node.classed('focused', function(d) { return d.id === nodeId; });
          var scale = 1.5;
          var tx = width / 2 - target.x * scale;
          var ty = height / 2 - target.y * scale;
          svg.transition().duration(500)
            .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }

        // Listen for focus messages from extension host
        window.addEventListener('message', function(event) {
          var msg = event.data;
          if (msg.command === 'focusNode' && msg.nodeId) {
            focusOnNode(msg.nodeId);
          }
        });

        // Initial focus if provided
        if (focusedId) {
          simulation.on('end', function() { focusOnNode(focusedId); });
        }

        // Handle resize
        window.addEventListener('resize', function() {
          var w = document.body.clientWidth || 260;
          var h = window.innerHeight || 400;
          svg.attr('viewBox', [0, 0, w, h]);
          simulation.force('center', d3.forceCenter(w / 2, h / 2));
          simulation.alpha(0.2).restart();
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
  private _graphRendered = false;

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
    this._graphRendered = false;

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

    // Listen for active editor changes — focus the node instead of re-rendering
    const editorDisposable = vscode.window.onDidChangeActiveTextEditor(
      (editor) => this.onEditorChanged(editor),
    );
    this._disposables.push(editorDisposable);

    webviewView.onDidDispose(() => {
      this._view = undefined;
      this._graphRendered = false;
      for (const d of this._disposables) {
        d.dispose();
      }
      this._disposables = [];
    });

    // Initial render
    this.refresh();
  }

  /**
   * refresh fetches the full graph and renders it. If an .xcaf file is active,
   * the corresponding node is focused. Otherwise the graph is shown unfocused.
   */
  async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    const focusNodeId = this.resolveActiveNodeId();
    await this.renderFullGraph(focusNodeId);
  }

  /**
   * focusNode sends a focusNode message to the webview, panning/zooming
   * to the specified node without re-rendering the entire graph.
   */
  focusNode(nodeId: string): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'focusNode', nodeId });
    }
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  private onEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (this._graphRendered) {
      const nodeId = this.resolveEditorNodeId(editor);
      if (nodeId) {
        this.focusNode(nodeId);
      }
    } else {
      this.refresh();
    }
  }

  private resolveActiveNodeId(): string | undefined {
    return this.resolveEditorNodeId(vscode.window.activeTextEditor);
  }

  private resolveEditorNodeId(
    editor: vscode.TextEditor | undefined,
  ): string | undefined {
    const filePath = editor?.document?.fileName;
    if (!filePath || !filePath.endsWith('.xcaf')) {
      return undefined;
    }
    return this.resolveNodeId(filePath);
  }

  private resolveNodeId(filePath: string): string | undefined {
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
      '<div class="placeholder">Loading harness graph...</div>',
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

  private async fetchFullGraph(): Promise<GraphData | null> {
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

    return graphData;
  }

  private async renderFullGraph(focusNodeId?: string): Promise<void> {
    if (!this._view) {
      return;
    }

    const webview = this._view.webview;
    this.renderPlaceholder();

    try {
      const graphData = await this.fetchFullGraph();

      if (!graphData) {
        this._graphRendered = false;
        this.renderMessage(
          'Run xcaffold apply to generate graph data.',
          false,
        );
        return;
      }

      const refCounts = computeRefCounts(graphData.edges || []);
      const refCountsObj: Record<string, number> = {};
      refCounts.forEach((v, k) => {
        refCountsObj[k] = v;
      });

      const d3Uri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'd3.js'),
      );

      const freshNonce = generateNonce();
      const freshCsp = buildMiniGraphCsp(
        webview.cspSource,
        freshNonce,
      );
      const body = buildFullGraphBody(
        graphData,
        freshNonce,
        JSON.stringify(KIND_COLORS),
        JSON.stringify(refCountsObj),
        focusNodeId,
      );

      webview.html = this.buildHtmlWithD3(
        freshCsp,
        freshNonce,
        body,
        String(d3Uri),
      );
      this._graphRendered = true;
    } catch (err: unknown) {
      this._graphRendered = false;
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
    <title>Harness Graph</title>
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
    <title>Harness Graph</title>
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
