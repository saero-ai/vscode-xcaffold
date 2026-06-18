import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ListResourceJSON } from './cliTypes';
import { XcafProjectModel, XcafResource, kindToDisplayName } from './xcafProjectModel';

export interface ResourceInfo {
  kind: string;
  name: string;
  description: string;
}

export interface MetadataField {
  label: string;
  value: string;
  fullValue?: string;
}

/**
 * Extracts metadata fields from .xcaf file content for display as tree children.
 * Parses YAML frontmatter (between --- delimiters) or top-level YAML fields.
 * Returns an array of label/value pairs for: kind, description, targets, tools count.
 */
export function extractMetadataFields(text: string): MetadataField[] {
  const lines = text.split('\n');
  const fields: MetadataField[] = [];

  let startLine = 0;
  let endLine = lines.length;

  if (lines[0]?.trim() === '---') {
    startLine = 1;
    const closingIdx = lines.indexOf('---', 1);
    if (closingIdx !== -1) {
      endLine = closingIdx;
    }
  }

  let kind: string | undefined;
  let description: string | undefined;
  let descriptionFull: string | undefined;
  let version: string | undefined;
  let model: string | undefined;
  let activation: string | undefined;
  const targets: string[] = [];
  let toolsCount = 0;
  let inTargets = false;
  let inTools = false;

  for (let i = startLine; i < endLine; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect top-level keys (no leading whitespace or exactly at indent 0)
    const isTopLevel = line.length > 0 && (line[0] !== ' ' && line[0] !== '\t');

    if (isTopLevel) {
      inTargets = false;
      inTools = false;
    }

    const kindMatch = /^kind:\s*(.+)$/.exec(trimmed);
    if (kindMatch && isTopLevel) {
      kind = kindMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    const descMatch = /^description:\s*(.+)$/.exec(trimmed);
    if (descMatch && isTopLevel) {
      const raw = descMatch[1].replace(/^["']|["']$/g, '').trim();
      descriptionFull = raw;
      description = raw.length > 60 ? raw.substring(0, 57) + '...' : raw;
      continue;
    }

    const versionMatch = /^version:\s*(.+)$/.exec(trimmed);
    if (versionMatch && isTopLevel) {
      version = versionMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    const modelMatch = /^model:\s*(.+)$/.exec(trimmed);
    if (modelMatch && isTopLevel) {
      model = modelMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    const activationMatch = /^activation:\s*(.+)$/.exec(trimmed);
    if (activationMatch && isTopLevel) {
      activation = activationMatch[1].replace(/^["']|["']$/g, '').trim();
      continue;
    }

    if (/^targets:\s*$/.exec(trimmed) && isTopLevel) {
      inTargets = true;
      continue;
    }

    // targets as inline list: targets: [claude, cursor]
    const targetsInlineMatch = /^targets:\s*\[(.+)]$/.exec(trimmed);
    if (targetsInlineMatch && isTopLevel) {
      const items = targetsInlineMatch[1].split(',').map(s => s.trim());
      targets.push(...items);
      continue;
    }

    if (inTargets) {
      const itemMatch = /^-\s*(.+)$/.exec(trimmed);
      if (itemMatch) {
        targets.push(itemMatch[1].trim());
      }
      continue;
    }

    if (/^tools:\s*$/.exec(trimmed) && isTopLevel) {
      inTools = true;
      continue;
    }

    // tools as inline list: tools: [Read, Write, Edit]
    const toolsInlineMatch = /^tools:\s*\[(.+)]$/.exec(trimmed);
    if (toolsInlineMatch && isTopLevel) {
      toolsCount = toolsInlineMatch[1].split(',').length;
      continue;
    }

    // allowed-tools as inline list
    const allowedToolsMatch = /^allowed-tools:\s*\[(.+)]$/.exec(trimmed);
    if (allowedToolsMatch && isTopLevel) {
      toolsCount = allowedToolsMatch[1].split(',').length;
      continue;
    }

    // allowed-tools as comma-separated string
    const allowedToolsStringMatch = /^allowed-tools:\s*(.+)$/.exec(trimmed);
    if (allowedToolsStringMatch && isTopLevel && !allowedToolsStringMatch[1].startsWith('[')) {
      toolsCount = allowedToolsStringMatch[1].split(',').length;
      continue;
    }

    if (inTools && /^\s+-/.test(line)) {
      toolsCount++;
      continue;
    }
  }

  if (kind) {
    fields.push({ label: 'kind', value: kind });
  }
  if (description) {
    fields.push({ label: 'description', value: description, fullValue: descriptionFull });
  }
  if (version) {
    fields.push({ label: 'version', value: version });
  }
  if (model) {
    fields.push({ label: 'model', value: model });
  }
  if (targets.length > 0) {
    fields.push({ label: 'targets', value: targets.join(', ') });
  }
  if (activation) {
    fields.push({ label: 'activation', value: activation });
  }
  if (toolsCount > 0) {
    fields.push({ label: 'tools', value: `${toolsCount} tools` });
  }

  return fields;
}

const SINGULAR_TO_DISPLAY: Record<string, string> = {
  'agent': 'AGENTS',
  'skill': 'SKILLS',
  'rule': 'RULES',
  'workflow': 'WORKFLOWS',
  'hooks': 'HOOKS',
  'mcp': 'MCP SERVERS',
  'context': 'CONTEXTS',
  'settings': 'SETTINGS',
  'memory': 'MEMORIES',
  'blueprint': 'BLUEPRINTS',
  'policy': 'POLICIES',
  'global': 'GLOBALS',
};

const DISPLAY_TO_KIND: Record<string, string> = {
  'AGENTS': 'agent',
  'SKILLS': 'skill',
  'RULES': 'rule',
  'WORKFLOWS': 'workflow',
  'HOOKS': 'hooks',
  'MCP SERVERS': 'mcp',
  'CONTEXTS': 'context',
  'SETTINGS': 'settings',
  'MEMORY': 'memory',
  'MEMORIES': 'memory',
  'BLUEPRINTS': 'blueprint',
  'POLICIES': 'policy',
  'GLOBALS': 'global',
};

function normalizeKind(displayKind: string): string {
  return DISPLAY_TO_KIND[displayKind] || displayKind.toLowerCase().replace(/s$/, '');
}

export function parseListOutput(stdout: string): Map<string, ResourceInfo[]> {
  const grouped = new Map<string, ResourceInfo[]>();

  const sectionRe = /^([A-Z][A-Z ]+\S)\s+\(\d+/;
  const nameRe = /^  (\S+)/;

  let currentKind = '';
  for (const line of stdout.split('\n')) {
    const sectionMatch = sectionRe.exec(line);
    if (sectionMatch) {
      currentKind = normalizeKind(sectionMatch[1]);
      grouped.set(currentKind, []);
      continue;
    }
    if (currentKind) {
      const nameMatch = nameRe.exec(line);
      if (nameMatch && nameMatch[1] !== '(none)') {
        const list = grouped.get(currentKind)!;
        list.push({ kind: currentKind, name: nameMatch[1], description: '' });
      }
    }
  }

  return grouped;
}

export function parseListJSON(stdout: string): Map<string, ResourceInfo[]> {
  const items: ListResourceJSON[] = JSON.parse(stdout);
  const grouped = new Map<string, ResourceInfo[]>();
  for (const item of items) {
    const list = grouped.get(item.kind) ?? [];
    list.push({ kind: item.kind, name: item.name, description: '' });
    grouped.set(item.kind, list);
  }
  return grouped;
}

export function parseListData(stdout: string): Map<string, ResourceInfo[]> {
  try {
    return parseListJSON(stdout);
  } catch {
    return parseListOutput(stdout);
  }
}

// ---------------------------------------------------------------------------
// Object Explorer node types
// ---------------------------------------------------------------------------

export type ExplorerNodeType =
  | 'kind-group'
  | 'scope-group'
  | 'resource'
  | 'property'
  | 'override'
  | 'artifact-dir'
  | 'artifact-file';

export interface KindGroupData { type: 'kind-group'; kind: string; count: number }
export interface ScopeGroupData { type: 'scope-group'; kind: string; scope: string; count: number }
export interface ResourceData { type: 'resource'; kind: string; name: string; baseManifest: string; overrideCount: number }
export interface PropertyData { type: 'property'; fieldLabel: string; value: string; fullValue?: string }
export interface OverrideData { type: 'override'; provider: string; filePath: string }
export interface ArtifactDirData { type: 'artifact-dir'; dirName: string; dirPath: string; files: string[] }
export interface ArtifactFileData { type: 'artifact-file'; fileName: string; filePath: string }

export type ExplorerNodeData =
  | KindGroupData
  | ScopeGroupData
  | ResourceData
  | PropertyData
  | OverrideData
  | ArtifactDirData
  | ArtifactFileData;

export class ExplorerNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly nodeType: ExplorerNodeType,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly data: ExplorerNodeData,
  ) {
    super(label, collapsibleState);
    this.contextValue = nodeType;
  }
}

// ---------------------------------------------------------------------------
// ObjectExplorerProvider
// ---------------------------------------------------------------------------

export class ObjectExplorerProvider implements vscode.TreeDataProvider<ExplorerNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ExplorerNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private model: XcafProjectModel;
  private cli?: { run(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> };
  private workspaceFolder?: string;
  private fallbackData?: Map<string, ResourceInfo[]>;

  constructor(
    model: XcafProjectModel,
    cli?: { run(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> },
    workspaceFolder?: string,
  ) {
    this.model = model;
    this.cli = cli;
    this.workspaceFolder = workspaceFolder;
  }

  setModel(model: XcafProjectModel): void {
    this.model = model;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExplorerNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ExplorerNode): Promise<ExplorerNode[]> {
    if (!element) {
      return this._getRootChildren();
    }

    if (element.data.type === 'kind-group') {
      return this._getKindGroupChildren(element.data);
    }

    if (element.data.type === 'scope-group') {
      return this._getScopeGroupChildren(element.data);
    }

    if (element.data.type === 'resource') {
      return this._getResourceChildren(element.data);
    }

    if (element.data.type === 'artifact-dir') {
      return this._getArtifactFileChildren(element.data as ArtifactDirData);
    }

    return [];
  }

  private async _getRootChildren(): Promise<ExplorerNode[]> {
    const kinds = this.model.getKinds();
    let children: ExplorerNode[];

    if (kinds.length > 0) {
      children = kinds.map(kg => new ExplorerNode(
        `${kg.displayName} (${kg.resources.length})`,
        'kind-group',
        vscode.TreeItemCollapsibleState.Collapsed,
        { type: 'kind-group', kind: kg.kind, count: kg.resources.length },
      ));
    } else if (this.cli && this.workspaceFolder) {
      children = await this._getCliFallbackChildren();
    } else {
      return [new ExplorerNode(
        'No xcaffold project detected',
        'property',
        vscode.TreeItemCollapsibleState.None,
        { type: 'property', fieldLabel: 'info', value: 'Create a project.xcaf or run xcaffold init' },
      )];
    }

    children.push(new ExplorerNode(
      'Global',
      'kind-group',
      vscode.TreeItemCollapsibleState.Collapsed,
      { type: 'kind-group', kind: '__global__', count: 0 },
    ));

    children.push(new ExplorerNode(
      'Registry',
      'kind-group',
      vscode.TreeItemCollapsibleState.Collapsed,
      { type: 'kind-group', kind: '__registry__', count: 0 },
    ));

    return children;
  }

  private async _getCliFallbackChildren(): Promise<ExplorerNode[]> {
    try {
      let stdout: string;
      let jsonFailed = false;
      try {
        const result = await this.cli!.run(['list', '--json'], this.workspaceFolder!);
        stdout = result.stdout;
      } catch {
        jsonFailed = true;
        const result = await this.cli!.run(['list'], this.workspaceFolder!);
        stdout = result.stdout;
      }

      if (jsonFailed) {
        vscode.window.showWarningMessage(
          'xcaffold CLI does not support --json output. Some features may be limited. Upgrade to v0.14.0 or later.',
        );
      }

      const grouped = parseListData(stdout);
      if (grouped.size === 0) {
        return [new ExplorerNode(
          'No xcaffold project detected',
          'property',
          vscode.TreeItemCollapsibleState.None,
          { type: 'property', fieldLabel: 'info', value: 'Create a project.xcaf or run xcaffold init' },
        )];
      }
      this.fallbackData = grouped;
      const nodes: ExplorerNode[] = [];
      for (const [kind, resources] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        const displayName = kindToDisplayName(kind);
        nodes.push(new ExplorerNode(
          `${displayName} (${resources.length})`,
          'kind-group',
          vscode.TreeItemCollapsibleState.Collapsed,
          { type: 'kind-group', kind, count: resources.length },
        ));
      }
      return nodes;
    } catch {
      return [new ExplorerNode(
        'CLI Error',
        'property',
        vscode.TreeItemCollapsibleState.None,
        { type: 'property', fieldLabel: 'error', value: 'Failed to run xcaffold list' },
      )];
    }
  }

  private async _getKindGroupChildren(data: KindGroupData): Promise<ExplorerNode[]> {
    if (data.kind === '__global__') {
      return this._getGlobalChildren();
    }

    if (data.kind === '__registry__') {
      return this._getRegistryChildren();
    }

    const resources = this.model.getResources(data.kind);
    if (resources.length > 0) {
      // Group scoped resources into scope-group nodes
      const scoped = resources.filter(r => r.scope !== undefined);
      const unscoped = resources.filter(r => r.scope === undefined);

      const children: ExplorerNode[] = [];

      // Scope groups sorted alphabetically
      const scopeMap = new Map<string, XcafResource[]>();
      for (const r of scoped) {
        const list = scopeMap.get(r.scope!) ?? [];
        list.push(r);
        scopeMap.set(r.scope!, list);
      }
      for (const [scope, scopeResources] of Array.from(scopeMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        children.push(new ExplorerNode(
          `${scope}/ (${scopeResources.length})`,
          'scope-group',
          vscode.TreeItemCollapsibleState.Collapsed,
          { type: 'scope-group', kind: data.kind, scope, count: scopeResources.length },
        ));
      }

      // Unscoped resources
      for (const r of unscoped) {
        children.push(this._makeResourceNode(r));
      }

      return children;
    }
    if (this.fallbackData) {
      const cliResources = this.fallbackData.get(data.kind) ?? [];
      return cliResources.map(r => new ExplorerNode(
        r.name,
        'resource',
        vscode.TreeItemCollapsibleState.None,
        { type: 'resource', kind: data.kind, name: r.name, baseManifest: '', overrideCount: 0 },
      ));
    }
    return [];
  }

  private async _getGlobalChildren(): Promise<ExplorerNode[]> {
    if (!this.cli || !this.workspaceFolder) {
      return [];
    }
    try {
      let stdout: string;
      try {
        const result = await this.cli.run(['list', '--json', '--global'], this.workspaceFolder);
        stdout = result.stdout;
      } catch {
        const result = await this.cli.run(['list', '--global'], this.workspaceFolder);
        stdout = result.stdout;
      }
      const grouped = parseListData(stdout);
      if (grouped.size === 0) {
        return [new ExplorerNode(
          'No global resources',
          'property',
          vscode.TreeItemCollapsibleState.None,
          { type: 'property', fieldLabel: 'info', value: 'Add agents, rules, or skills to ~/.xcaffold/xcaf/' },
        )];
      }
      const nodes: ExplorerNode[] = [];
      const globalBase = path.join(os.homedir(), '.xcaffold', 'xcaf');
      for (const [kind, resources] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        for (const r of resources) {
          const node = new ExplorerNode(
            r.name,
            'resource',
            vscode.TreeItemCollapsibleState.None,
            { type: 'resource', kind, name: r.name, baseManifest: '', overrideCount: 0 },
          );
          node.description = kind;
          const candidates = [
            path.join(globalBase, kind, r.name, r.name + '.xcaf'),
            path.join(globalBase, kind + 's', r.name, r.name + '.xcaf'),
            path.join(globalBase, kind, r.name + '.xcaf'),
          ];
          const resolved = candidates.find(c => fs.existsSync(c));
          if (resolved) {
            node.command = {
              command: 'vscode.open',
              title: 'Open Global Resource',
              arguments: [vscode.Uri.file(resolved)],
            };
          }
          nodes.push(node);
        }
      }
      const openFolder = new ExplorerNode(
        'Open Global Config Folder',
        'property',
        vscode.TreeItemCollapsibleState.None,
        { type: 'property', fieldLabel: 'action', value: globalBase },
      );
      openFolder.command = {
        command: 'vscode.openFolder',
        title: 'Open Global Config',
        arguments: [vscode.Uri.file(globalBase), { forceNewWindow: true }],
      };
      nodes.push(openFolder);
      return nodes;
    } catch {
      return [new ExplorerNode(
        'No global resources found',
        'property',
        vscode.TreeItemCollapsibleState.None,
        { type: 'property', fieldLabel: 'info', value: 'Run "xcaffold init --global" to set up global config' },
      )];
    }
  }

  private async _getRegistryChildren(): Promise<ExplorerNode[]> {
    if (!this.cli || !this.workspaceFolder) {
      return [];
    }
    try {
      try { await this.cli.run(['registry', 'prune'], this.workspaceFolder); } catch { /* best-effort */ }
      const result = await this.cli.run(['registry', 'list', '--json'], this.workspaceFolder);
      const stdout = result.stdout.trim();
      if (!stdout || stdout === '[]') {
        return [new ExplorerNode(
          'No registry entries',
          'property',
          vscode.TreeItemCollapsibleState.None,
          { type: 'property', fieldLabel: 'info', value: 'Run "xcaffold: Registry Add" to add entries' },
        )];
      }
      const entries: Array<{ Name: string; Path: string }> = JSON.parse(stdout);
      return entries.map(e => {
        const node = new ExplorerNode(
          e.Name,
          'resource',
          vscode.TreeItemCollapsibleState.None,
          { type: 'resource', kind: 'registry', name: e.Name, baseManifest: e.Path || '', overrideCount: 0 },
        );
        node.contextValue = 'registry-entry';
        node.description = e.Path;
        node.tooltip = `${e.Name}\n${e.Path}`;
        node.command = {
          command: 'vscode.openFolder',
          title: 'Open Project',
          arguments: [vscode.Uri.file(e.Path), { forceNewWindow: true }],
        };
        return node;
      });
    } catch {
      return [new ExplorerNode(
        'Failed to load registry',
        'property',
        vscode.TreeItemCollapsibleState.None,
        { type: 'property', fieldLabel: 'error', value: 'CLI error' },
      )];
    }
  }

  private _getScopeGroupChildren(data: ScopeGroupData): ExplorerNode[] {
    const resources = this.model.getResources(data.kind)
      .filter(r => r.scope === data.scope);
    return resources.map(r => this._makeResourceNode(r));
  }

  private _makeResourceNode(r: XcafResource): ExplorerNode {
    const node = new ExplorerNode(
      r.name,
      'resource',
      vscode.TreeItemCollapsibleState.Collapsed,
      { type: 'resource', kind: r.kind, name: r.name, baseManifest: r.baseManifest, overrideCount: r.overrides.length },
    );
    node.resourceUri = vscode.Uri.file(r.baseManifest);
    node.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(r.baseManifest)] };
    if (r.overrides.length > 0) {
      node.description = `[${r.overrides.length}]`;
    }
    return node;
  }

  private async _getResourceChildren(data: ResourceData): Promise<ExplorerNode[]> {
    const resource = this.model.getResource(data.kind, data.name);
    if (!resource) {
      return [];
    }

    const children: ExplorerNode[] = [];

    // 1. Properties (inline)
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(resource.baseManifest));
      const fields = extractMetadataFields(doc.getText());
      if (fields.length === 0) {
        children.push(new ExplorerNode(
          '(no properties)',
          'property',
          vscode.TreeItemCollapsibleState.None,
          { type: 'property', fieldLabel: 'empty', value: '' },
        ));
      } else {
        for (const f of fields) {
          const node = new ExplorerNode(
            f.label,
            'property',
            vscode.TreeItemCollapsibleState.None,
            { type: 'property', fieldLabel: f.label, value: f.value, fullValue: f.fullValue },
          );
          node.description = f.value;
          node.tooltip = `${f.label}: ${f.fullValue || f.value}`;
          children.push(node);
        }
      }
    } catch { /* ignore read errors */ }

    // 2. Overrides (inline)
    for (const o of resource.overrides) {
      const node = new ExplorerNode(
        o.provider,
        'override',
        vscode.TreeItemCollapsibleState.None,
        { type: 'override', provider: o.provider, filePath: o.path },
      );
      node.resourceUri = vscode.Uri.file(o.path);
      node.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(o.path)] };
      node.description = `${resource.kind}.${o.provider}.xcaf`;
      children.push(node);
    }

    // 3. Artifact directories (inline)
    for (const ad of resource.artifactDirs) {
      const fileWord = ad.files.length === 1 ? 'file' : 'files';
      children.push(new ExplorerNode(
        `${ad.name}/ (${ad.files.length} ${fileWord})`,
        'artifact-dir',
        ad.files.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        { type: 'artifact-dir', dirName: ad.name, dirPath: ad.path, files: ad.files },
      ));
    }

    return children;
  }

  private _getArtifactFileChildren(data: ArtifactDirData): ExplorerNode[] {
    if (data.files.length === 0) {
      return [];
    }
    return data.files.map(f => {
      const filePath = path.join(data.dirPath, f);
      const node = new ExplorerNode(
        f,
        'artifact-file',
        vscode.TreeItemCollapsibleState.None,
        { type: 'artifact-file', fileName: f, filePath },
      );
      node.resourceUri = vscode.Uri.file(filePath);
      node.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(filePath)] };
      return node;
    });
  }
}

// Compatibility shim — extension.ts still uses the old XcaffoldTreeProvider(cli, xcafIndex)
// signature. This stub accepts the old arguments but internally uses an empty model.
// Removed in a later task when extension.ts is rewired to use ObjectExplorerProvider directly.
export class XcaffoldTreeProvider extends ObjectExplorerProvider {
  constructor(
    cliOrModel?: { run?(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> } | unknown,
    _xcafIndex?: unknown,
    workspaceFolder?: string,
  ) {
    const cli = cliOrModel && typeof (cliOrModel as any).run === 'function'
      ? cliOrModel as { run(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> }
      : undefined;
    super(new XcafProjectModel([]), cli, workspaceFolder);
  }
}
