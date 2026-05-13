import * as assert from 'assert';
import { parseListOutput, ResourceTreeItem, extractMetadataFields, XcaffoldTreeProvider } from '../treeViewProvider';
import { XcafIndex } from '../xcafIndex';
import * as vscode from 'vscode';
import { XcaffoldCli, CliResult } from '../xcaffoldCli';

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
  test('leaf ResourceTreeItem has command property when xcafIndex has entry', () => {
    const index = new XcafIndex();
    index.setEntry({
      kind: 'AGENTS',
      name: 'reviewer',
      fileUri: '/workspace/xcaf/agents/reviewer.xcaf',
      nameLine: 3,
    });

    const item = new ResourceTreeItem(
      'reviewer',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
      'resource-item',
      { xcafIndex: index },
    );

    assert.ok(item.command, 'leaf item should have a command');
    assert.strictEqual(item.command.command, 'vscode.open');
  });

  test('leaf ResourceTreeItem has no command when xcafIndex lacks entry', () => {
    const index = new XcafIndex();

    const item = new ResourceTreeItem(
      'ghost',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
      'resource-item',
      { xcafIndex: index },
    );

    assert.strictEqual(item.command, undefined);
  });

  test('resource-item ResourceTreeItem has contextValue resource-item', () => {
    const index = new XcafIndex();

    const item = new ResourceTreeItem(
      'reviewer',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
      'resource-item',
      { xcafIndex: index },
    );

    assert.strictEqual(item.contextValue, 'resource-item');
  });

  test('collapsible kind-group ResourceTreeItem has contextValue kind-group', () => {
    const item = new ResourceTreeItem(
      'AGENTS (2)',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
      'kind-group',
    );

    assert.strictEqual(item.contextValue, 'kind-group');
  });

  test('metadata-field ResourceTreeItem has contextValue metadata-field', () => {
    const item = new ResourceTreeItem(
      'kind',
      'AGENTS',
      vscode.TreeItemCollapsibleState.None,
      'metadata-field',
      { description: 'agent' },
    );

    assert.strictEqual(item.contextValue, 'metadata-field');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test('resource-item stores fileUri from options', () => {
    const item = new ResourceTreeItem(
      'reviewer',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
      'resource-item',
      { fileUri: '/workspace/xcaf/agents/reviewer.xcaf' },
    );

    assert.strictEqual(item.fileUri, '/workspace/xcaf/agents/reviewer.xcaf');
  });

  test('resource-item resolves fileUri from xcafIndex when not in options', () => {
    const index = new XcafIndex();
    index.setEntry({
      kind: 'AGENTS',
      name: 'reviewer',
      fileUri: '/workspace/xcaf/agents/reviewer.xcaf',
      nameLine: 3,
    });

    const item = new ResourceTreeItem(
      'reviewer',
      'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed,
      'resource-item',
      { xcafIndex: index },
    );

    assert.strictEqual(item.fileUri, '/workspace/xcaf/agents/reviewer.xcaf');
  });
});

suite('extractMetadataFields', () => {
  test('extracts kind from frontmatter', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const kindField = fields.find(f => f.label === 'kind');
    assert.ok(kindField, 'should have kind field');
    assert.strictEqual(kindField.value, 'agent');
  });

  test('extracts description and truncates long values', () => {
    const longDesc = 'A'.repeat(80);
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      `description: ${longDesc}`,
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const descField = fields.find(f => f.label === 'description');
    assert.ok(descField, 'should have description field');
    assert.strictEqual(descField.value.length, 60);
    assert.ok(descField.value.endsWith('...'));
  });

  test('extracts description without truncation for short values', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'description: Code review specialist',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const descField = fields.find(f => f.label === 'description');
    assert.ok(descField, 'should have description field');
    assert.strictEqual(descField.value, 'Code review specialist');
  });

  test('extracts inline targets list', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'targets: [claude, cursor, gemini]',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const targetsField = fields.find(f => f.label === 'targets');
    assert.ok(targetsField, 'should have targets field');
    assert.strictEqual(targetsField.value, 'claude, cursor, gemini');
  });

  test('extracts block-style targets list', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'targets:',
      '  - claude',
      '  - cursor',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const targetsField = fields.find(f => f.label === 'targets');
    assert.ok(targetsField, 'should have targets field');
    assert.strictEqual(targetsField.value, 'claude, cursor');
  });

  test('extracts inline tools count', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'tools: [Read, Write, Edit]',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const toolsField = fields.find(f => f.label === 'tools');
    assert.ok(toolsField, 'should have tools field');
    assert.strictEqual(toolsField.value, '3 tools');
  });

  test('extracts block-style tools count', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'tools:',
      '  - Read',
      '  - Write',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const toolsField = fields.find(f => f.label === 'tools');
    assert.ok(toolsField, 'should have tools field');
    assert.strictEqual(toolsField.value, '2 tools');
  });

  test('extracts allowed-tools inline list', () => {
    const text = [
      '---',
      'kind: skill',
      'name: audit',
      'allowed-tools: [Read, Grep, Glob, Bash]',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const toolsField = fields.find(f => f.label === 'tools');
    assert.ok(toolsField, 'should have tools field');
    assert.strictEqual(toolsField.value, '4 tools');
  });

  test('extracts allowed-tools comma-separated string', () => {
    const text = [
      '---',
      'kind: skill',
      'name: audit',
      'allowed-tools: Read, Grep, Glob',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const toolsField = fields.find(f => f.label === 'tools');
    assert.ok(toolsField, 'should have tools field');
    assert.strictEqual(toolsField.value, '3 tools');
  });

  test('returns empty array for empty content', () => {
    const fields = extractMetadataFields('');
    assert.strictEqual(fields.length, 0);
  });

  test('handles content without frontmatter delimiters', () => {
    const text = [
      'kind: project',
      'name: my-project',
      'description: My scaffold project',
    ].join('\n');

    const fields = extractMetadataFields(text);
    assert.ok(fields.find(f => f.label === 'kind'));
    assert.ok(fields.find(f => f.label === 'description'));
  });

  test('returns all fields in correct order', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'description: Code review specialist',
      'targets: [claude, cursor]',
      'tools: [Read, Write]',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    assert.strictEqual(fields.length, 4);
    assert.strictEqual(fields[0].label, 'kind');
    assert.strictEqual(fields[1].label, 'description');
    assert.strictEqual(fields[2].label, 'targets');
    assert.strictEqual(fields[3].label, 'tools');
  });

  test('omits fields that are not present', () => {
    const text = [
      '---',
      'kind: rule',
      'name: my-rule',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    assert.strictEqual(fields.length, 1);
    assert.strictEqual(fields[0].label, 'kind');
    assert.strictEqual(fields[0].value, 'rule');
  });

  test('strips quotes from field values', () => {
    const text = [
      '---',
      'kind: "agent"',
      'name: "reviewer"',
      'description: "A code review agent"',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const kindField = fields.find(f => f.label === 'kind');
    assert.ok(kindField);
    assert.strictEqual(kindField.value, 'agent');

    const descField = fields.find(f => f.label === 'description');
    assert.ok(descField);
    assert.strictEqual(descField.value, 'A code review agent');
  });
});

suite('XcaffoldTreeProvider getChildren integration', () => {
  const listStdout = [
    'my-project  .  2 agents  .  1 skill',
    '',
    'AGENTS  (2)',
    '  coder',
    '  reviewer',
    '',
    'SKILLS  (1)',
    '  audit',
  ].join('\n');

  const agentXcafContent = [
    '---',
    'kind: agent',
    'name: reviewer',
    'description: Code review specialist',
    'targets: [claude, cursor]',
    'tools: [Read, Write]',
    '---',
  ].join('\n');

  function createMockCli(stdout: string): XcaffoldCli {
    return {
      run: async () => ({ exitCode: 0, stdout, stderr: '' }),
      init: async () => {},
      invalidateCache: () => {},
    } as unknown as XcaffoldCli;
  }

  let origWorkspaceFolders: typeof vscode.workspace.workspaceFolders;
  let origOpenTextDocument: typeof vscode.workspace.openTextDocument;

  setup(() => {
    origWorkspaceFolders = vscode.workspace.workspaceFolders;
    origOpenTextDocument = vscode.workspace.openTextDocument;

    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/workspace' }, name: 'workspace', index: 0 },
    ];
  });

  teardown(() => {
    (vscode.workspace as any).workspaceFolders = origWorkspaceFolders;
    (vscode.workspace as any).openTextDocument = origOpenTextDocument;
  });

  test('getChildren returns kind-group items at root level', async () => {
    const cli = createMockCli(listStdout);
    const provider = new XcaffoldTreeProvider(cli);

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 2);
    assert.strictEqual(roots[0].itemType, 'kind-group');
    assert.strictEqual(roots[1].itemType, 'kind-group');

    const labels = roots.map(r => r.label);
    assert.ok(labels.includes('AGENTS (2)'));
    assert.ok(labels.includes('SKILLS (1)'));
  });

  test('getChildren returns resource items for a kind-group', async () => {
    const cli = createMockCli(listStdout);
    const provider = new XcaffoldTreeProvider(cli);

    const agentsGroup = new ResourceTreeItem(
      'AGENTS (2)', 'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed, 'kind-group',
    );

    const resources = await provider.getChildren(agentsGroup);
    assert.strictEqual(resources.length, 2);
    assert.strictEqual(resources[0].label, 'coder');
    assert.strictEqual(resources[1].label, 'reviewer');
    resources.forEach(r => {
      assert.strictEqual(r.itemType, 'resource-item');
      assert.strictEqual(
        r.collapsibleState,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    });
  });

  test('getChildren returns metadata children for a resource-item', async () => {
    (vscode.workspace as any).openTextDocument = async () => ({
      getText: () => agentXcafContent,
    });

    const cli = createMockCli(listStdout);
    const provider = new XcaffoldTreeProvider(cli);

    const resourceItem = new ResourceTreeItem(
      'reviewer', 'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed, 'resource-item',
      { fileUri: '/workspace/xcaf/agents/reviewer.xcaf' },
    );

    const children = await provider.getChildren(resourceItem);
    assert.strictEqual(children.length, 4);

    assert.strictEqual(children[0].label, 'kind');
    assert.strictEqual(children[0].description, 'agent');
    assert.strictEqual(children[1].label, 'description');
    assert.strictEqual(children[1].description, 'Code review specialist');
    assert.strictEqual(children[2].label, 'targets');
    assert.strictEqual(children[2].description, 'claude, cursor');
    assert.strictEqual(children[3].label, 'tools');
    assert.strictEqual(children[3].description, '2 tools');

    children.forEach(c => {
      assert.strictEqual(c.itemType, 'metadata-field');
      assert.strictEqual(
        c.collapsibleState,
        vscode.TreeItemCollapsibleState.None,
      );
    });
  });

  test('getChildren returns empty metadata for resource-item without fileUri', async () => {
    const cli = createMockCli(listStdout);
    const provider = new XcaffoldTreeProvider(cli);

    const resourceItem = new ResourceTreeItem(
      'reviewer', 'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed, 'resource-item',
    );

    // Without fileUri, getChildren should not enter metadata branch
    const children = await provider.getChildren(resourceItem);
    assert.strictEqual(children.length, 0);
  });

  test('getChildren returns empty metadata when file read fails', async () => {
    (vscode.workspace as any).openTextDocument = async () => {
      throw new Error('File not found');
    };

    const cli = createMockCli(listStdout);
    const provider = new XcaffoldTreeProvider(cli);

    const resourceItem = new ResourceTreeItem(
      'reviewer', 'AGENTS',
      vscode.TreeItemCollapsibleState.Collapsed, 'resource-item',
      { fileUri: '/workspace/xcaf/agents/nonexistent.xcaf' },
    );

    const children = await provider.getChildren(resourceItem);
    assert.strictEqual(children.length, 0);
  });

  test('getChildren returns error item when no workspace is open', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;

    const cli = createMockCli(listStdout);
    const provider = new XcaffoldTreeProvider(cli);

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 1);
    assert.ok((roots[0].label as string).includes('No workspace'));
  });

  test('getChildren returns info item when CLI returns empty output', async () => {
    const cli = createMockCli('');
    const provider = new XcaffoldTreeProvider(cli);

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 1);
    assert.ok(
      (roots[0].label as string).includes('No xcaffold project'),
    );
  });

  test('getChildren returns error item when CLI throws', async () => {
    const cli = {
      run: async () => { throw new Error('binary not found'); },
      init: async () => {},
      invalidateCache: () => {},
    } as unknown as XcaffoldCli;
    const provider = new XcaffoldTreeProvider(cli);

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 1);
    assert.ok(
      (roots[0].label as string).includes('CLI Error'),
    );
  });
});
