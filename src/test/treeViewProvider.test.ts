import * as assert from 'assert';
import { parseListOutput, ResourceTreeItem } from '../treeViewProvider';
import { XcfIndex } from '../xcfIndex';
import * as vscode from 'vscode';

suite('TreeViewProvider', () => {
  test('parseListOutput parses xcaffold list output into grouped map', () => {
    const stdout = [
      'my-project  .  2 agents  .  1 skill',
      '',
      'AGENTS  (2)',
      '  coder',
      '  reviewer',
      '',
      'SKILLS  (1)',
      '  audit',
    ].join('\n');

    const grouped = parseListOutput(stdout);
    assert.strictEqual(grouped.size, 2);
    assert.ok(grouped.has('AGENTS'));
    assert.ok(grouped.has('SKILLS'));

    const agents = grouped.get('AGENTS')!;
    assert.strictEqual(agents.length, 2);
    assert.strictEqual(agents[0].name, 'coder');
    assert.strictEqual(agents[1].name, 'reviewer');
  });

  test('parseListOutput handles empty output', () => {
    const grouped = parseListOutput('');
    assert.strictEqual(grouped.size, 0);
  });
});

suite('ResourceTreeItem click-to-open', () => {
  test('leaf ResourceTreeItem has command property when xcfIndex has entry', () => {
    const index = new XcfIndex();
    index.setEntry({
      kind: 'AGENTS',
      name: 'reviewer',
      fileUri: '/workspace/xcaf/agents/reviewer.xcaf',
      nameLine: 3,
    });

    const item = new ResourceTreeItem(
      'reviewer',
      'AGENTS',
      vscode.TreeItemCollapsibleState.None,
      undefined,
      index,
    );

    assert.ok(item.command, 'leaf item should have a command');
    assert.strictEqual(item.command.command, 'vscode.open');
  });

  test('leaf ResourceTreeItem has no command when xcfIndex lacks entry', () => {
    const index = new XcfIndex();

    const item = new ResourceTreeItem(
      'ghost',
      'AGENTS',
      vscode.TreeItemCollapsibleState.None,
      undefined,
      index,
    );

    assert.strictEqual(item.command, undefined);
  });

  test('leaf ResourceTreeItem has contextValue resource-item', () => {
    const index = new XcfIndex();

    const item = new ResourceTreeItem(
      'reviewer',
      'AGENTS',
      vscode.TreeItemCollapsibleState.None,
      undefined,
      index,
    );

    assert.strictEqual(item.contextValue, 'resource-item');
  });

  test('collapsible ResourceTreeItem has contextValue kind-group', () => {
    const item = new ResourceTreeItem(
      'AGENTS (2)',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    assert.strictEqual(item.contextValue, 'kind-group');
  });
});
