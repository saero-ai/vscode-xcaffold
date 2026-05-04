import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';
import { XcfIndex } from './xcfIndex';
import * as path from 'path';

export interface ResourceInfo {
  kind: string;
  name: string;
  description: string;
}

export function parseListOutput(stdout: string): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  // Section header pattern: "AGENTS  (3)" or "MCP SERVERS  (2)"
  const sectionRe = /^([A-Z][A-Z ]+\S)\s+\(\d+\)/;
  const nameRe = /^  (\S+)/; // two-space indent = resource name

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
        grouped.get(currentKind)!.push(nameMatch[1]);
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
            title: 'Open .xcf File',
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
          return [new ResourceTreeItem('No xcaffold project detected', 'info', vscode.TreeItemCollapsibleState.None, 'Create a project.xcf to get started.')];
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
        return resources.map(name => new ResourceTreeItem(
          name,
          element.kind,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          this.xcfIndex,
        ));
      }
    } catch (err: any) {
      const msg: string = err.message ?? '';
      // Treat any list failure caused by missing project files as a friendly state
      if (
        msg.includes('no *.xcf files found') ||
        msg.includes('no project.xcf') ||
        msg.includes('parse error') ||
        (err.exitCode !== undefined && err.exitCode !== 0 && !msg.includes('binary not found'))
      ) {
        return [new ResourceTreeItem(
          'No xcaffold project detected', 'info',
          vscode.TreeItemCollapsibleState.None,
          'Create a project.xcf to get started.'
        )];
      }
      return [new ResourceTreeItem('CLI Error: Check output channel', 'error', vscode.TreeItemCollapsibleState.None, msg)];
    }
  }
}
