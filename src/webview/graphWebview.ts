// src/webview/graphWebview.ts
//
// Interactive D3 force-directed graph webview.
// Extends BaseWebview with kind-colored nodes, tooltips,
// search, filters, drag-to-pin, and click-to-navigate.

import * as vscode from 'vscode';
import { BaseWebview, escapeHtml } from './baseWebview';
import { DataSource } from './dataSource';
import { XcafIndex } from '../xcafIndex';

// -- Graph data types -------------------------------------------------

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// -- Exported pure functions for reuse by P3-04 mini-graph ------------

/**
 * KIND_COLORS maps resource kind names to hex color strings.
 * Reused by the mini-graph panel (P3-04).
 */
export const KIND_COLORS: Record<string, string> = {
  agent: '#4a9eff',
  skill: '#76ff03',
  rule: '#ffab00',
  workflow: '#e040fb',
  hook: '#ff5252',
  mcp: '#18ffff',
};

/** Fallback color for unknown kinds. */
const DEFAULT_COLOR = '#999999';

/**
 * computeRefCounts counts incoming edges per node ID.
 * Each edge's `to` field is counted as one inbound reference.
 */
export function computeRefCounts(
  edges: Array<{ from: string; to: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.to, (counts.get(edge.to) || 0) + 1);
  }
  return counts;
}

/**
 * nodeRadius computes a circle radius proportional to reference count.
 * Minimum radius is 6, maximum is 24.
 */
export function nodeRadius(
  refCount: number,
  maxRefCount: number,
): number {
  const MIN_RADIUS = 6;
  const MAX_RADIUS = 24;
  if (maxRefCount <= 0) return MIN_RADIUS;
  const ratio = refCount / maxRefCount;
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

/**
 * kindColor returns the hex color for a given kind,
 * falling back to DEFAULT_COLOR for unknown kinds.
 */
export function kindColor(kind: string): string {
  return KIND_COLORS[kind] || DEFAULT_COLOR;
}

/**
 * parseNodeId splits a "kind:name" node ID into its components.
 * Returns undefined if the ID does not contain a colon separator.
 */
export function parseNodeId(
  nodeId: string,
): { kind: string; name: string } | undefined {
  if (!nodeId) return undefined;
  const sepIdx = nodeId.indexOf(':');
  if (sepIdx === -1) return undefined;
  return {
    kind: nodeId.substring(0, sepIdx),
    name: nodeId.substring(sepIdx + 1),
  };
}

// -- Graph styles -----------------------------------------------------

function graphStyles(): string {
  return `
    body { padding: 0; overflow: hidden; }

    /* Toolbar */
    .graph-toolbar {
      position: absolute;
      top: 0; left: 0; right: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      z-index: 10;
      flex-wrap: wrap;
    }
    .graph-toolbar input[type="text"] {
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #555);
      padding: 4px 8px;
      border-radius: 2px;
      font-size: inherit;
      min-width: 180px;
    }
    .graph-toolbar input[type="text"]::placeholder {
      color: var(--vscode-input-placeholderForeground, #888);
    }
    .kind-filters {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .kind-filter {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      user-select: none;
    }
    .kind-swatch {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      display: inline-block;
    }

    /* SVG canvas */
    #canvas {
      width: 100vw;
      height: 100vh;
      display: block;
    }

    /* Tooltip */
    .graph-tooltip {
      position: absolute;
      pointer-events: none;
      background: var(--vscode-editorHoverWidget-background, #2d2d30);
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      color: var(--fg);
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      max-width: 280px;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 20;
    }
    .graph-tooltip.visible { opacity: 1; }
    .tooltip-kind {
      font-weight: 600;
      margin-bottom: 2px;
      text-transform: capitalize;
    }
    .tooltip-label {
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground, #aaa);
    }
    .tooltip-targets {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #aaa);
    }

    /* Graph elements */
    .link {
      stroke: #555;
      stroke-opacity: 0.5;
      stroke-width: 1.5px;
      marker-end: url(#arrowhead);
    }
    .node text {
      font: 11px var(--vscode-font-family, sans-serif);
      fill: var(--fg);
      pointer-events: none;
    }
    .node circle {
      stroke: #fff;
      stroke-width: 1.5px;
      cursor: pointer;
      transition: stroke-width 0.1s;
    }
    .node circle:hover { stroke-width: 3px; }
    .node.pinned circle { stroke-dasharray: 3 2; }
    .node.dimmed { opacity: 0.15; }
    .link.dimmed { opacity: 0.05; }
    .node.highlighted circle { stroke: #fff; stroke-width: 3px; }
  `;
}

// -- Graph body HTML --------------------------------------------------

function graphBody(
  dataJson: string,
  nonce: string,
  refCountsJson: string,
  kindColorsJson: string,
  kindList: string[],
): string {
  const filterCheckboxes = kindList
    .map(
      (k) =>
        `<label class="kind-filter">
          <input type="checkbox" data-kind="${escapeHtml(k)}" checked />
          <span class="kind-swatch" style="background:${kindColor(k)}"></span>
          <span>${escapeHtml(k)}</span>
        </label>`,
    )
    .join('\n');

  return `
    <div class="graph-toolbar">
      <input type="text" id="searchInput" placeholder="Search nodes..." />
      <div class="kind-filters">
        ${filterCheckboxes}
      </div>
    </div>
    <div class="graph-tooltip" id="tooltip"></div>
    <svg id="canvas"></svg>

    <script nonce="${nonce}">
      (function() {
        var vscodeApi = acquireVsCodeApi();
        var data = ${dataJson};
        var refCounts = ${refCountsJson};
        var kindColors = ${kindColorsJson};
        var defaultColor = '${DEFAULT_COLOR}';
        var MIN_RADIUS = 6;
        var MAX_RADIUS = 24;

        if (!data || !data.nodes || data.nodes.length === 0) {
          document.getElementById('canvas').style.display = 'none';
          var msg = document.createElement('div');
          msg.className = 'loading';
          msg.textContent = 'No graph data available. Run xcaffold apply first.';
          document.body.appendChild(msg);
          return;
        }

        function esc(str) {
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        }

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

        // Build lookup for outgoing edge counts (targets)
        var targetCounts = {};
        data.edges.forEach(function(e) {
          targetCounts[e.from] = (targetCounts[e.from] || 0) + 1;
        });

        var width = window.innerWidth;
        var height = window.innerHeight;

        var svg = d3.select('#canvas')
          .attr('viewBox', [0, 0, width, height]);

        // Zoom
        var zoomBehavior = d3.zoom().scaleExtent([0.1, 4]).on('zoom', function(event) {
          container.attr('transform', event.transform);
        });
        svg.call(zoomBehavior);

        // Arrowhead marker
        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 20)
          .attr('refY', 0)
          .attr('orient', 'auto')
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .append('path')
          .attr('d', 'M 0,-5 L 10,0 L 0,5')
          .attr('fill', '#555')
          .style('stroke', 'none');

        var container = svg.append('g');

        // Force simulation
        var simulation = d3.forceSimulation(data.nodes)
          .force('link', d3.forceLink(data.edges)
            .id(function(d) { return d.id; })
            .distance(120))
          .force('charge', d3.forceManyBody().strength(-400))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide().radius(function(d) {
            return radius(d.id) + 4;
          }));

        // Links
        var link = container.append('g')
          .selectAll('line')
          .data(data.edges)
          .join('line')
          .attr('class', 'link');

        // Node groups
        var node = container.append('g')
          .selectAll('g')
          .data(data.nodes)
          .join('g')
          .attr('class', 'node');

        // Circles
        node.append('circle')
          .attr('r', function(d) { return radius(d.id); })
          .attr('fill', function(d) { return colorFor(d.kind); });

        // Labels
        node.append('text')
          .attr('x', function(d) { return radius(d.id) + 4; })
          .attr('y', 4)
          .text(function(d) { return d.label || d.id; });

        // Tooltip
        var tooltip = document.getElementById('tooltip');

        node.on('mouseover', function(event, d) {
          var refs = refCounts[d.id] || 0;
          var targets = targetCounts[d.id] || 0;
          tooltip.innerHTML =
            '<div class="tooltip-kind" style="color:' + colorFor(d.kind) + '">' +
              esc(d.kind) +
            '</div>' +
            '<div class="tooltip-label">' + esc(d.label || d.id) + '</div>' +
            '<div class="tooltip-targets">' +
              refs + ' incoming ref' + (refs !== 1 ? 's' : '') +
              ' · ' +
              targets + ' target' + (targets !== 1 ? 's' : '') +
            '</div>';
          tooltip.classList.add('visible');
        });

        node.on('mousemove', function(event) {
          tooltip.style.left = (event.pageX + 12) + 'px';
          tooltip.style.top = (event.pageY - 10) + 'px';
        });

        node.on('mouseout', function() {
          tooltip.classList.remove('visible');
        });

        // Click-to-navigate
        node.on('click', function(event, d) {
          vscodeApi.postMessage({ command: 'openFile', nodeId: d.id });
        });

        // Drag + pin behavior
        var dragBehavior = d3.drag()
          .on('start', function(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function(event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            // Keep pinned after drag
            d3.select(this).classed('pinned', true);
          });

        node.call(dragBehavior);

        // Double-click to unpin
        node.on('dblclick', function(event, d) {
          d.fx = null;
          d.fy = null;
          d3.select(this).classed('pinned', false);
          simulation.alphaTarget(0.1).restart();
          setTimeout(function() { simulation.alphaTarget(0); }, 500);
        });

        // Tick
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

        // -- Search ---------------------------------------------------
        var searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', applyFilters);

        // -- Kind filters ---------------------------------------------
        var checkboxes = document.querySelectorAll('.kind-filter input');
        checkboxes.forEach(function(cb) {
          cb.addEventListener('change', applyFilters);
        });

        function applyFilters() {
          var query = searchInput.value.trim().toLowerCase();

          // Collect hidden kinds
          var hiddenKinds = {};
          checkboxes.forEach(function(cb) {
            if (!cb.checked) hiddenKinds[cb.dataset.kind] = true;
          });

          // Build visible node set
          var visibleIds = {};
          data.nodes.forEach(function(n) {
            if (hiddenKinds[n.kind]) return;
            if (query && (n.label || n.id).toLowerCase().indexOf(query) === -1) return;
            visibleIds[n.id] = true;
          });

          // Dim/show nodes
          node.classed('dimmed', function(d) {
            return !visibleIds[d.id];
          });
          node.classed('highlighted', function(d) {
            return query && visibleIds[d.id];
          });

          // Dim/show links
          link.classed('dimmed', function(d) {
            var srcId = typeof d.source === 'object' ? d.source.id : d.source;
            var tgtId = typeof d.target === 'object' ? d.target.id : d.target;
            return !visibleIds[srcId] || !visibleIds[tgtId];
          });
        }

        // Handle window resize
        window.addEventListener('resize', function() {
          var w = window.innerWidth;
          var h = window.innerHeight;
          svg.attr('viewBox', [0, 0, w, h]);
          simulation.force('center', d3.forceCenter(w / 2, h / 2));
          simulation.alpha(0.3).restart();
        });
      })();
    </script>
  `;
}

// -- GraphWebview class -----------------------------------------------

/**
 * GraphWebview renders an interactive D3 force-directed graph
 * of xcaffold resource dependencies.
 */
export class GraphWebview extends BaseWebview {
  private readonly disposeCallback: (() => void) | undefined;

  constructor(
    extensionUri: vscode.Uri,
    dataSource: DataSource,
    workspaceFolder: string,
    private readonly xcafIndex: XcafIndex,
    onDispose?: () => void,
  ) {
    super(extensionUri, dataSource, workspaceFolder);
    this.disposeCallback = onDispose;
  }

  protected override onDidDispose(): void {
    this.disposeCallback?.();
  }

  protected getViewType(): string {
    return 'xcaffoldGraph';
  }

  protected getTitle(): string {
    return 'xcaffold: Resource Graph';
  }

  protected getScriptUris(
    webview: vscode.Webview,
  ): Array<{ uri: string }> {
    const d3Uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'd3.js'),
    );
    return [{ uri: String(d3Uri) }];
  }

  protected getStyles(): string {
    return graphStyles();
  }

  protected async getHtmlBody(
    _webview: vscode.Webview,
    nonce: string,
  ): Promise<string> {
    let stdout: string;
    try {
      const result = await this.dataSource.fetch(
        ['graph', '--format', 'json'],
        this.workspaceFolder,
      );
      stdout = result.stdout;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unknown error';
      return `<div class="error">Failed to load graph: ${escapeHtml(msg)}</div>`;
    }

    let data: GraphData;
    try {
      const parsed = JSON.parse(stdout);
      data = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return '<div class="error">Failed to parse graph JSON.</div>';
    }

    if (
      !data ||
      !data.nodes ||
      data.nodes.length === 0
    ) {
      return '<div class="loading">No graph data. Run xcaffold apply first.</div>';
    }

    const refCounts = computeRefCounts(data.edges || []);
    const refCountsObj: Record<string, number> = {};
    refCounts.forEach((v, k) => {
      refCountsObj[k] = v;
    });

    // Collect unique kinds present in the data
    const kindSet = new Set<string>();
    for (const n of data.nodes) {
      kindSet.add(n.kind);
    }
    const kindList = Array.from(kindSet).sort();

    const dataJson = JSON.stringify(data);
    const refCountsJson = JSON.stringify(refCountsObj);
    const kindColorsJson = JSON.stringify(KIND_COLORS);

    return graphBody(
      dataJson,
      nonce,
      refCountsJson,
      kindColorsJson,
      kindList,
    );
  }

  protected handleMessage(message: Record<string, unknown>): void {
    if (message.command === 'openFile') {
      this.openNodeFile(message.nodeId as string);
    } else if (message.command === 'refresh') {
      this.refresh();
    }
  }

  private openNodeFile(nodeId: string): void {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return;

    const entry = this.xcafIndex.resolve(parsed.kind, parsed.name);
    if (entry) {
      const uri = vscode.Uri.file(entry.fileUri);
      vscode.window.showTextDocument(uri, {
        viewColumn: vscode.ViewColumn.One,
      });
    }
  }
}
