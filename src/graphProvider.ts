import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { XcaffoldCli } from './xcaffoldCli';

export class XcaffoldGraphProvider {
  public static currentPanel: XcaffoldGraphProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private cli: XcaffoldCli,
    private workspaceFolder: string,
    private extensionUri: vscode.Uri
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._update();
  }

  public static show(
    cli: XcaffoldCli,
    workspaceFolder: string,
    extensionUri: vscode.Uri
  ) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (XcaffoldGraphProvider.currentPanel) {
      XcaffoldGraphProvider.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'xcaffoldGraph',
      'xcaffold: Resource Graph',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
        ],
      }
    );

    XcaffoldGraphProvider.currentPanel = new XcaffoldGraphProvider(panel, cli, workspaceFolder, extensionUri);
  }

  public dispose() {
    XcaffoldGraphProvider.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private async _update() {
    const webview = this._panel.webview;
    this._panel.title = 'xcaffold: Resource Graph';
    webview.html = this._getHtmlForWebview(webview, 'Loading graph...');

    try {
      const result = await this.cli.run(['graph', '--format', 'json'], this.workspaceFolder);
      const scopes = JSON.parse(result.stdout);
      const data = Array.isArray(scopes) ? scopes[0] : scopes;
      webview.html = this._getHtmlForWebview(webview, '', data);
    } catch (err: any) {
      webview.html = this._getHtmlForWebview(webview, `Error: ${err.message}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, message: string, data: any = null) {
    const dataJson = data ? JSON.stringify(data) : 'null';

    const d3Uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'd3.js')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src 'unsafe-inline';">
    <title>xcaffold Graph</title>
    <script nonce="${nonce}" src="${d3Uri}"></script>
    <style>
        body { background: #1e1e1e; color: #ccc; font-family: sans-serif; overflow: hidden; margin: 0; }
        #canvas { width: 100vw; height: 100vh; }
        .node circle { fill: #4a9eff; stroke: #fff; stroke-width: 1.5px; }
        .node text { font: 12px sans-serif; fill: #fff; pointer-events: none; }
        .link { stroke: #666; stroke-opacity: 0.6; stroke-width: 1.5px; marker-end: url(#arrowhead); }
        #message { position: absolute; top: 20px; left: 20px; color: #ff4a4a; }
        .node-agent circle { fill: #76ff03; }
        .node-skill circle { fill: #ffeb3b; }
        .node-rule circle { fill: #ff5722; }
    </style>
</head>
<body>
    <div id="message">${escapeHtml(message)}</div>
    <svg id="canvas"></svg>

    <script>
        const data = ${dataJson};
        if (data) {
            document.getElementById('message').innerText = '';
            renderGraph(data);
        }

        function renderGraph(data) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const svg = d3.select("#canvas")
                .attr("viewBox", [0, 0, width, height])
                .call(d3.zoom().on("zoom", (event) => {
                    container.attr("transform", event.transform);
                }));

            // Arrowhead marker
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 20)
                .attr("refY", 0)
                .attr("orient", "auto")
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("xoverflow", "visible")
                .append("svg:path")
                .attr("d", "M 0,-5 L 10 ,0 L 0,5")
                .attr("fill", "#666")
                .style("stroke", "none");

            const container = svg.append("g");

            const simulation = d3.forceSimulation(data.nodes)
                .force("link", d3.forceLink(data.edges).id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("center", d3.forceCenter(width / 2, height / 2));

            const link = container.append("g")
                .selectAll("line")
                .data(data.edges)
                .join("line")
                .attr("class", "link");

            const node = container.append("g")
                .selectAll("g")
                .data(data.nodes)
                .join("g")
                .attr("class", d => "node node-" + d.kind)
                .call(drag(simulation));

            node.append("circle").attr("r", 8);
            node.append("text")
                .attr("x", 12)
                .attr("y", 4)
                .text(d => d.label || d.id);

            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
            });

            function drag(simulation) {
                function started(event) {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    event.subject.fx = event.subject.x;
                    event.subject.fy = event.subject.y;
                }
                function dragged(event) {
                    event.subject.fx = event.x;
                    event.subject.fy = event.y;
                }
                function ended(event) {
                    if (!event.active) simulation.alphaTarget(0);
                    event.subject.fx = null;
                    event.subject.fy = null;
                }
                return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
            }
        }
    </script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
