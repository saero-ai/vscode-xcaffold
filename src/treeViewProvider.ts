import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import * as path from 'path';

export interface ResourceInfo {
  kind: string;
  name: string;
  description: string;
}

export function parseListOutput(stdout: string): Map<string, ResourceInfo[]> {
  const lines = stdout.split('\n');
  const grouped = new Map<string, ResourceInfo[]>();

  for (const line of lines) {
    if (!line.includes('|') || line.startsWith('KIND') || line.startsWith('----')) {
      continue;
    }

    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 2) continue;

    const info: ResourceInfo = {
      kind: parts[0],
      name: parts[1],
      description: parts[2] || '',
    };

    const list = grouped.get(info.kind) || [];
    list.push(info);
    grouped.set(info.kind, list);
  }

  return grouped;
}

export class ResourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: string,
    public readonly name: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly description?: string,
  ) {
    super(label, collapsibleState);
    this.tooltip = this.description || `${this.kind}: ${this.name}`;
    this.contextValue = this.name ? 'resource' : 'kind';
  }
}

export class XcaffoldTreeProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ResourceTreeItem | undefined | void> = new vscode.EventEmitter<ResourceTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private cli: XcaffoldCli) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResourceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ResourceTreeItem): Promise<ResourceTreeItem[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      return [new ResourceTreeItem('No workspace folder open', 'error', '', vscode.TreeItemCollapsibleState.None)];
    }

    try {
      const result = await this.cli.run(['list'], workspaceFolder);
      const grouped = parseListOutput(result.stdout);

      if (!element) {
        // Root: list kinds
        const items: ResourceTreeItem[] = [];
        
        if (grouped.size === 0) {
          return [new ResourceTreeItem('No xcaffold project detected', 'info', '', vscode.TreeItemCollapsibleState.None, 'Create a project.xcf to get started.')];
        }

        for (const kind of Array.from(grouped.keys()).sort()) {
          const list = grouped.get(kind)!;
          items.push(new ResourceTreeItem(
            `${kind} (${list.length})`,
            kind,
            '',
            vscode.TreeItemCollapsibleState.Collapsed,
          ));
        }
        return items;
      } else {
        // Child of a kind: list resources
        const resources = grouped.get(element.kind) || [];
        return resources.map(r => new ResourceTreeItem(
          r.name,
          r.kind,
          r.name,
          vscode.TreeItemCollapsibleState.None,
          r.description
        ));
      }
    } catch (err: any) {
      return [new ResourceTreeItem('CLI Error: Check output channel', 'error', '', vscode.TreeItemCollapsibleState.None, err.message)];
    }
  }
}
