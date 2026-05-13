import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import { XcafIndex } from './xcafIndex';

export interface ResourceInfo {
  kind: string;
  name: string;
  description: string;
}

export type TreeItemType = 'kind-group' | 'resource-item' | 'metadata-field';

export interface MetadataField {
  label: string;
  value: string;
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
      description = raw.length > 60 ? raw.substring(0, 57) + '...' : raw;
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
    fields.push({ label: 'description', value: description });
  }
  if (targets.length > 0) {
    fields.push({ label: 'targets', value: targets.join(', ') });
  }
  if (toolsCount > 0) {
    fields.push({ label: 'tools', value: `${toolsCount} tools` });
  }

  return fields;
}

export function parseListOutput(stdout: string): Map<string, ResourceInfo[]> {
  const grouped = new Map<string, ResourceInfo[]>();

  const sectionRe = /^([A-Z][A-Z ]+\S)\s+\(\d+/;
  const nameRe = /^  (\S+)/;

  let currentKind = '';
  for (const line of stdout.split('\n')) {
    const sectionMatch = sectionRe.exec(line);
    if (sectionMatch) {
      currentKind = sectionMatch[1];
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

export class ResourceTreeItem extends vscode.TreeItem {
  public readonly itemType: TreeItemType;
  public readonly fileUri?: string;

  constructor(
    public readonly label: string,
    public readonly kind: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    itemType: TreeItemType,
    options?: {
      description?: string;
      xcafIndex?: XcafIndex;
      fileUri?: string;
    },
  ) {
    super(label, collapsibleState);
    this.itemType = itemType;
    this.contextValue = itemType;

    if (options?.description !== undefined) {
      this.description = options.description;
    }
    this.tooltip = (this.description as string) || `${this.kind}: ${this.label}`;

    if (options?.fileUri) {
      this.fileUri = options.fileUri;
    }

    if (itemType === 'resource-item' && options?.xcafIndex) {
      const entry = options.xcafIndex.resolve(this.kind, this.label);
      if (entry) {
        this.fileUri = this.fileUri ?? entry.fileUri;
        this.command = {
          command: 'vscode.open',
          title: 'Open .xcaf File',
          arguments: [vscode.Uri.file(entry.fileUri)],
        };
      }
    }
  }
}

export class XcaffoldTreeProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ResourceTreeItem | undefined | void> = new vscode.EventEmitter<ResourceTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(
    private cli: XcaffoldCli,
    private xcafIndex?: XcafIndex,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResourceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ResourceTreeItem): Promise<ResourceTreeItem[]> {
    // Level 3: metadata children of a resource item
    if (element?.itemType === 'resource-item' && element.fileUri) {
      return this.getMetadataChildren(element);
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      return [new ResourceTreeItem(
        'No workspace folder open', 'error',
        vscode.TreeItemCollapsibleState.None, 'metadata-field',
      )];
    }

    try {
      const result = await this.cli.run(['list'], workspaceFolder);
      const grouped = parseListOutput(result.stdout);

      if (!element) {
        // Level 1: list kind groups
        if (grouped.size === 0) {
          return [new ResourceTreeItem(
            'No xcaffold project detected', 'info',
            vscode.TreeItemCollapsibleState.None, 'metadata-field',
            { description: 'Create a project.xcaf to get started.' },
          )];
        }

        const items: ResourceTreeItem[] = [];
        for (const kind of Array.from(grouped.keys()).sort()) {
          const list = grouped.get(kind)!;
          items.push(new ResourceTreeItem(
            `${kind} (${list.length})`,
            kind,
            vscode.TreeItemCollapsibleState.Collapsed,
            'kind-group',
          ));
        }
        return items;
      } else if (element.itemType === 'kind-group') {
        // Level 2: list resources within a kind
        const resources = grouped.get(element.kind) || [];
        return resources.map(res => {
          const fileUri = this.xcafIndex?.resolve(element.kind, res.name)?.fileUri;
          return new ResourceTreeItem(
            res.name,
            element.kind,
            vscode.TreeItemCollapsibleState.Collapsed,
            'resource-item',
            {
              description: res.description,
              xcafIndex: this.xcafIndex,
              fileUri,
            },
          );
        });
      }

      return [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return [new ResourceTreeItem(
        'CLI Error: Check output channel', 'error',
        vscode.TreeItemCollapsibleState.None, 'metadata-field',
        { description: message },
      )];
    }
  }

  private async getMetadataChildren(
    element: ResourceTreeItem,
  ): Promise<ResourceTreeItem[]> {
    try {
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(element.fileUri!),
      );
      const fields = extractMetadataFields(doc.getText());
      return fields.map(field => new ResourceTreeItem(
        field.label,
        element.kind,
        vscode.TreeItemCollapsibleState.None,
        'metadata-field',
        { description: field.value },
      ));
    } catch {
      return [];
    }
  }
}
