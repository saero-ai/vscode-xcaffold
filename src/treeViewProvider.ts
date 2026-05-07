import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import { XcfIndex } from './xcfIndex';
import * as path from 'path';

export interface ResourceInfo {
  kind: string;
  name: string;
  description: string;
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
  constructor(
    public readonly label: string,
    public readonly kind: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly description?: string,
    xcfIndex?: XcfIndex,
  ) {
    super(label, collapsibleState);
    this.tooltip = this.description || `${this.kind}: ${this.label}`;

    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.contextValue = 'resource-item';
      // Resolve file URI from xcfIndex for click-to-open
      if (xcfIndex) {
        const entry = xcfIndex.resolve(this.kind, this.label);
        if (entry) {
          this.command = {
            command: 'vscode.open',
            title: 'Open .xcaf File',
            arguments: [vscode.Uri.file(entry.fileUri)],
          };
        }
      }
    } else {
      this.contextValue = 'kind-group';
    }
  }
}

export class XcaffoldTreeProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ResourceTreeItem | undefined | void> = new vscode.EventEmitter<ResourceTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(
    private cli: XcaffoldCli,
    private xcfIndex?: XcfIndex,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResourceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ResourceTreeItem): Promise<ResourceTreeItem[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      return [new ResourceTreeItem('No workspace folder open', 'error', vscode.TreeItemCollapsibleState.None)];
    }

    try {
      const result = await this.cli.run(['list'], workspaceFolder);
      const grouped = parseListOutput(result.stdout);

      if (!element) {
        // Root: list kinds
        const items: ResourceTreeItem[] = [];

        if (grouped.size === 0) {
          return [new ResourceTreeItem('No xcaffold project detected', 'info', vscode.TreeItemCollapsibleState.None, 'Create a project.xcaf to get started.')];
        }

        for (const kind of Array.from(grouped.keys()).sort()) {
          const list = grouped.get(kind)!;
          items.push(new ResourceTreeItem(
            `${kind} (${list.length})`,
            kind,
            vscode.TreeItemCollapsibleState.Collapsed,
          ));
        }
        return items;
      } else {
        // Child of a kind: list resources
        const resources = grouped.get(element.kind) || [];
        return resources.map(res => new ResourceTreeItem(
          res.name,
          element.kind,
          vscode.TreeItemCollapsibleState.None,
          res.description,
          this.xcfIndex,
        ));
      }
    } catch (err: any) {
      return [new ResourceTreeItem('CLI Error: Check output channel', 'error', vscode.TreeItemCollapsibleState.None, err.message)];
    }
  }
}
