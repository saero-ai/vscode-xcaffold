import * as vscode from 'vscode';
import { XcafProjectModel, XcafResource } from './xcafProjectModel';

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
      if (nameMatch) {
        const list = grouped.get(currentKind)!;
        list.push({ kind: currentKind, name: nameMatch[1], description: '' });
      }
    }
  }

  return grouped;
}

// ---------------------------------------------------------------------------
// Object Explorer node types
// ---------------------------------------------------------------------------

export type ExplorerNodeType =
  | 'kind-group'
  | 'resource'
  | 'section'
  | 'property'
  | 'override'
  | 'artifact-dir'
  | 'artifact-file';

export interface KindGroupData { type: 'kind-group'; kind: string; count: number }
export interface ResourceData { type: 'resource'; kind: string; name: string; baseManifest: string; overrideCount: number }
export interface SectionData { type: 'section'; sectionName: 'Properties' | 'Overrides' | 'Artifacts'; parentKind: string; parentName: string }
export interface PropertyData { type: 'property'; fieldLabel: string; value: string; fullValue?: string }
export interface OverrideData { type: 'override'; provider: string; filePath: string }
export interface ArtifactDirData { type: 'artifact-dir'; dirName: string; dirPath: string; files: string[] }
export interface ArtifactFileData { type: 'artifact-file'; fileName: string; filePath: string }

export type ExplorerNodeData =
  | KindGroupData
  | ResourceData
  | SectionData
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

  constructor(model: XcafProjectModel) {
    this.model = model;
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
      return this._getResourceChildren(element.data);
    }

    if (element.data.type === 'resource') {
      return this._getSectionChildren(element.data);
    }

    if (element.data.type === 'section' && element.data.sectionName === 'Overrides') {
      return this._getOverrideChildren(element.data);
    }

    if (element.data.type === 'section' && element.data.sectionName === 'Properties') {
      return this._getPropertyChildren(element.data);
    }

    if (element.data.type === 'section' && element.data.sectionName === 'Artifacts') {
      // Task 6 will implement artifact browsing here
      return [];
    }

    return [];
  }

  private _getRootChildren(): ExplorerNode[] {
    const kinds = this.model.getKinds();
    if (kinds.length === 0) {
      return [new ExplorerNode(
        'No xcaffold project detected',
        'property',
        vscode.TreeItemCollapsibleState.None,
        { type: 'property', fieldLabel: 'info', value: 'Create a project.xcaf or run xcaffold init' },
      )];
    }
    return kinds.map(kg => new ExplorerNode(
      `${kg.displayName} (${kg.resources.length})`,
      'kind-group',
      vscode.TreeItemCollapsibleState.Collapsed,
      { type: 'kind-group', kind: kg.kind, count: kg.resources.length },
    ));
  }

  private _getResourceChildren(data: KindGroupData): ExplorerNode[] {
    const resources = this.model.getResources(data.kind);
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

  private _getSectionChildren(data: ResourceData): ExplorerNode[] {
    const resource = this.model.getResource(data.kind, data.name);
    if (!resource) {
      return [];
    }

    const sections: ExplorerNode[] = [];

    // Properties section always shown
    sections.push(new ExplorerNode(
      'Properties',
      'section',
      vscode.TreeItemCollapsibleState.Collapsed,
      { type: 'section', sectionName: 'Properties', parentKind: data.kind, parentName: data.name },
    ));

    // Overrides only if non-empty
    if (resource.overrides.length > 0) {
      sections.push(new ExplorerNode(
        `Overrides (${resource.overrides.length})`,
        'section',
        vscode.TreeItemCollapsibleState.Collapsed,
        { type: 'section', sectionName: 'Overrides', parentKind: data.kind, parentName: data.name },
      ));
    }

    // Artifacts only if non-empty
    if (resource.artifactDirs.length > 0) {
      sections.push(new ExplorerNode(
        'Artifacts',
        'section',
        vscode.TreeItemCollapsibleState.Collapsed,
        { type: 'section', sectionName: 'Artifacts', parentKind: data.kind, parentName: data.name },
      ));
    }

    return sections;
  }

  private async _getPropertyChildren(data: SectionData): Promise<ExplorerNode[]> {
    const resource = this.model.getResource(data.parentKind, data.parentName);
    if (!resource) {
      return [];
    }
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(resource.baseManifest));
      const fields = extractMetadataFields(doc.getText());
      if (fields.length === 0) {
        return [new ExplorerNode(
          '(no properties)',
          'property',
          vscode.TreeItemCollapsibleState.None,
          { type: 'property', fieldLabel: 'empty', value: '' },
        )];
      }
      return fields.map(f => {
        const node = new ExplorerNode(
          f.label,
          'property',
          vscode.TreeItemCollapsibleState.None,
          { type: 'property', fieldLabel: f.label, value: f.value, fullValue: f.fullValue },
        );
        node.description = f.value;
        node.tooltip = `${f.label}: ${f.fullValue || f.value}`;
        return node;
      });
    } catch {
      return [];
    }
  }

  private _getOverrideChildren(data: SectionData): ExplorerNode[] {
    const resource = this.model.getResource(data.parentKind, data.parentName);
    if (!resource) {
      return [];
    }
    return resource.overrides.map(o => {
      const node = new ExplorerNode(
        o.provider,
        'override',
        vscode.TreeItemCollapsibleState.None,
        { type: 'override', provider: o.provider, filePath: o.path },
      );
      node.resourceUri = vscode.Uri.file(o.path);
      node.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(o.path)] };
      return node;
    });
  }
}

// Compatibility shim — extension.ts still uses the old XcaffoldTreeProvider(cli, xcafIndex)
// signature. This stub accepts the old arguments but internally uses an empty model.
// Removed in a later task when extension.ts is rewired to use ObjectExplorerProvider directly.
export class XcaffoldTreeProvider extends ObjectExplorerProvider {
  constructor(_cliOrModel: unknown, _xcafIndex?: unknown) {
    super(new XcafProjectModel([]));
  }
}
