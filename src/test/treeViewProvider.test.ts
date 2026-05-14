import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  parseListOutput,
  extractMetadataFields,
  ObjectExplorerProvider,
  ExplorerNode,
} from '../treeViewProvider';
import { XcafProjectModel, XcafKindGroup } from '../xcafProjectModel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(groups: XcafKindGroup[]): XcafProjectModel {
  return new XcafProjectModel(groups);
}

function makeGroups(): XcafKindGroup[] {
  return [
    {
      kind: 'agent',
      displayName: 'AGENTS',
      resources: [
        {
          name: 'coder',
          kind: 'agent',
          baseManifest: '/workspace/xcaf/agents/coder/agent.xcaf',
          overrides: [],
          artifactDirs: [],
        },
        {
          name: 'reviewer',
          kind: 'agent',
          baseManifest: '/workspace/xcaf/agents/reviewer/agent.xcaf',
          overrides: [
            { provider: 'claude', path: '/workspace/xcaf/agents/reviewer/agent.claude.xcaf' },
            { provider: 'gemini', path: '/workspace/xcaf/agents/reviewer/agent.gemini.xcaf' },
          ],
          artifactDirs: [
            { name: 'references', path: '/workspace/xcaf/agents/reviewer/references', files: ['guide.md'] },
          ],
        },
      ],
    },
    {
      kind: 'rule',
      displayName: 'RULES',
      resources: [
        {
          name: 'security',
          kind: 'rule',
          baseManifest: '/workspace/xcaf/rules/security/rule.xcaf',
          overrides: [],
          artifactDirs: [],
        },
      ],
    },
    {
      kind: 'skill',
      displayName: 'SKILLS',
      resources: [
        {
          name: 'audit',
          kind: 'skill',
          baseManifest: '/workspace/xcaf/skills/audit/skill.xcaf',
          overrides: [],
          artifactDirs: [],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// parseListOutput tests (kept — tests a kept function)
// ---------------------------------------------------------------------------

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
    assert.ok(grouped.has('agent'));
    assert.ok(grouped.has('skill'));

    const agents = grouped.get('agent')!;
    assert.strictEqual(agents.length, 2);
    assert.strictEqual(agents[0].name, 'coder');
    assert.strictEqual(agents[1].name, 'reviewer');
  });

  test('parseListOutput handles empty output', () => {
    const grouped = parseListOutput('');
    assert.strictEqual(grouped.size, 0);
  });

  test('parseListOutput normalizes MEMORIES section to memory kind', () => {
    const stdout = [
      'my-project  .  1 memory',
      '',
      'MEMORIES  (1)',
      '  session-context',
    ].join('\n');

    const grouped = parseListOutput(stdout);
    assert.ok(grouped.has('memory'));
    assert.strictEqual(grouped.get('memory')!.length, 1);
    assert.strictEqual(grouped.get('memory')![0].name, 'session-context');
  });

  test('parseListOutput normalizes POLICIES section to policy kind', () => {
    const stdout = [
      'my-project  .  1 policy',
      '',
      'POLICIES  (1)',
      '  security',
    ].join('\n');

    const grouped = parseListOutput(stdout);
    assert.ok(grouped.has('policy'));
    assert.strictEqual(grouped.get('policy')!.length, 1);
  });
});

// ---------------------------------------------------------------------------
// extractMetadataFields tests (kept — tests a kept function)
// ---------------------------------------------------------------------------

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

  test('extracts version field', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'version: "1.0"',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const versionField = fields.find(f => f.label === 'version');
    assert.ok(versionField, 'should have version field');
    assert.strictEqual(versionField.value, '1.0');
  });

  test('extracts model field', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'model: sonnet',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const modelField = fields.find(f => f.label === 'model');
    assert.ok(modelField, 'should have model field');
    assert.strictEqual(modelField.value, 'sonnet');
  });

  test('extracts activation field', () => {
    const text = [
      '---',
      'kind: rule',
      'name: my-rule',
      'activation: always',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const activationField = fields.find(f => f.label === 'activation');
    assert.ok(activationField, 'should have activation field');
    assert.strictEqual(activationField.value, 'always');
  });

  test('returns fields in correct order: kind, description, version, model, targets, activation, tools', () => {
    const text = [
      '---',
      'kind: agent',
      'name: reviewer',
      'description: Code review specialist',
      'version: "1.0"',
      'model: sonnet',
      'targets: [claude, cursor]',
      'activation: on-demand',
      'tools: [Read, Write]',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    assert.strictEqual(fields.length, 7);
    assert.strictEqual(fields[0].label, 'kind');
    assert.strictEqual(fields[1].label, 'description');
    assert.strictEqual(fields[2].label, 'version');
    assert.strictEqual(fields[3].label, 'model');
    assert.strictEqual(fields[4].label, 'targets');
    assert.strictEqual(fields[5].label, 'activation');
    assert.strictEqual(fields[6].label, 'tools');
  });

  test('description field has fullValue with untruncated text', () => {
    const longDesc = 'A'.repeat(80);
    const text = [
      '---',
      'kind: agent',
      `description: ${longDesc}`,
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const descField = fields.find(f => f.label === 'description');
    assert.ok(descField, 'should have description field');
    assert.strictEqual(descField.value.length, 60);
    assert.strictEqual(descField.fullValue, longDesc);
  });

  test('description field fullValue equals value when not truncated', () => {
    const text = [
      '---',
      'kind: agent',
      'description: Short desc',
      '---',
    ].join('\n');

    const fields = extractMetadataFields(text);
    const descField = fields.find(f => f.label === 'description');
    assert.ok(descField);
    assert.strictEqual(descField.fullValue, 'Short desc');
    assert.strictEqual(descField.value, descField.fullValue);
  });
});

// ---------------------------------------------------------------------------
// ObjectExplorerProvider tests
// ---------------------------------------------------------------------------

suite('ObjectExplorerProvider', () => {
  test('root level returns sorted kind-group nodes (AGENTS, RULES, SKILLS)', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();

    assert.strictEqual(roots.length, 3);
    // Sorted by kind: agent < rule < skill
    assert.strictEqual((roots[0] as ExplorerNode).nodeType, 'kind-group');
    assert.strictEqual((roots[1] as ExplorerNode).nodeType, 'kind-group');
    assert.strictEqual((roots[2] as ExplorerNode).nodeType, 'kind-group');

    const labels = roots.map(r => r.label as string);
    assert.strictEqual(labels[0], 'AGENTS (2)');
    assert.strictEqual(labels[1], 'RULES (1)');
    assert.strictEqual(labels[2], 'SKILLS (1)');
  });

  test('kind-group label includes count', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();

    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS'));
    assert.ok(agentsNode);
    assert.strictEqual(agentsNode.label, 'AGENTS (2)');
  });

  test('empty model returns "No xcaffold project detected" node', async () => {
    const provider = new ObjectExplorerProvider(makeModel([]));
    const roots = await provider.getChildren();

    assert.strictEqual(roots.length, 1);
    assert.ok((roots[0].label as string).includes('No xcaffold project detected'));
  });

  test('kind-group expand returns sorted resource nodes', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();

    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    assert.ok(agentsNode);

    const resources = await provider.getChildren(agentsNode);
    assert.strictEqual(resources.length, 2);
    // Resources sorted by name: coder < reviewer
    assert.strictEqual(resources[0].label, 'coder');
    assert.strictEqual(resources[1].label, 'reviewer');
    resources.forEach(r => {
      assert.strictEqual((r as ExplorerNode).nodeType, 'resource');
    });
  });

  test('resource node has resourceUri set to base manifest', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();
    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    const resources = await provider.getChildren(agentsNode);

    const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;
    assert.ok(coderNode);
    assert.ok(coderNode.resourceUri);
    assert.strictEqual(coderNode.resourceUri.fsPath, '/workspace/xcaf/agents/coder/agent.xcaf');
  });

  test('resource node has click-to-open command', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();
    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    const resources = await provider.getChildren(agentsNode);

    const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;
    assert.ok(coderNode);
    assert.ok(coderNode.command);
    assert.strictEqual(coderNode.command.command, 'vscode.open');
  });

  test('resource with overrides shows description badge "[2]"', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();
    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    const resources = await provider.getChildren(agentsNode);

    const reviewerNode = resources.find(r => r.label === 'reviewer') as ExplorerNode;
    assert.ok(reviewerNode);
    assert.strictEqual(reviewerNode.description, '[2]');
  });

  test('resource with no overrides has no description', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();
    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    const resources = await provider.getChildren(agentsNode);

    const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;
    assert.ok(coderNode);
    assert.strictEqual(coderNode.description, undefined);
  });

  test('resource expand (flat) returns inline properties, overrides, and artifact dirs', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => [
        '---',
        'kind: agent',
        'name: reviewer',
        'description: A review agent',
        '---',
      ].join('\n'),
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const reviewerNode = resources.find(r => r.label === 'reviewer') as ExplorerNode;
      assert.ok(reviewerNode);

      const children = await provider.getChildren(reviewerNode);
      // Should have: 2 properties (kind, description) + 2 overrides + 1 artifact-dir
      assert.ok(children.length >= 5, `Expected at least 5 children, got ${children.length}`);

      const nodeTypes = children.map(c => (c as ExplorerNode).nodeType);
      assert.ok(nodeTypes.includes('property'), 'should include property nodes');
      assert.ok(nodeTypes.includes('override'), 'should include override nodes');
      assert.ok(nodeTypes.includes('artifact-dir'), 'should include artifact-dir nodes');

      // No section nodes
      assert.ok(!nodeTypes.includes('section' as any), 'should NOT include section nodes');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('resource expand (flat, no overrides/artifacts) returns only property nodes', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => [
        '---',
        'kind: agent',
        'name: coder',
        'description: A coding agent',
        'model: sonnet',
        '---',
      ].join('\n'),
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;
      assert.ok(coderNode);

      const children = await provider.getChildren(coderNode);
      assert.ok(children.length > 0, 'should return property nodes');

      const labels = children.map(c => c.label as string);
      assert.ok(labels.includes('kind'), 'should include kind');
      assert.ok(labels.includes('description'), 'should include description');
      assert.ok(labels.includes('model'), 'should include model');

      children.forEach(c => {
        assert.strictEqual((c as ExplorerNode).nodeType, 'property');
      });
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('resource expand returns inline override nodes with provider names', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: agent\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const reviewerNode = resources.find(r => r.label === 'reviewer') as ExplorerNode;
      const children = await provider.getChildren(reviewerNode);

      const overrideNodes = children.filter(c => (c as ExplorerNode).nodeType === 'override');
      assert.strictEqual(overrideNodes.length, 2);
      const providerNames = overrideNodes.map(o => o.label as string);
      assert.ok(providerNames.includes('claude'));
      assert.ok(providerNames.includes('gemini'));
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('inline override node has click-to-open command and resourceUri', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: agent\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const reviewerNode = resources.find(r => r.label === 'reviewer') as ExplorerNode;
      const children = await provider.getChildren(reviewerNode);

      const claudeOverride = children.find(c => c.label === 'claude') as ExplorerNode;
      assert.ok(claudeOverride, 'should have claude override node');
      assert.ok(claudeOverride.command);
      assert.strictEqual(claudeOverride.command.command, 'vscode.open');
      assert.ok(claudeOverride.resourceUri);
      assert.strictEqual(
        claudeOverride.resourceUri.fsPath,
        '/workspace/xcaf/agents/reviewer/agent.claude.xcaf',
      );
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('resource expand returns property nodes from manifest', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => [
        '---',
        'kind: agent',
        'name: coder',
        'description: A coding agent',
        'model: sonnet',
        '---',
      ].join('\n'),
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;

      const children = await provider.getChildren(coderNode);
      const propNodes = children.filter(c => (c as ExplorerNode).nodeType === 'property');
      assert.ok(propNodes.length > 0, 'should return property nodes');

      const labels = propNodes.map(p => p.label as string);
      assert.ok(labels.includes('kind'), 'should include kind');
      assert.ok(labels.includes('description'), 'should include description');
      assert.ok(labels.includes('model'), 'should include model');

      const descNode = propNodes.find(p => p.label === 'description') as ExplorerNode;
      assert.ok(descNode);
      assert.strictEqual(descNode.description, 'A coding agent');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('property nodes have tooltip with full value for long descriptions', async () => {
    const longDesc = 'B'.repeat(80);
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => [
        '---',
        'kind: agent',
        `description: ${longDesc}`,
        '---',
      ].join('\n'),
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;

      const children = await provider.getChildren(coderNode);
      const descNode = children.find(p => p.label === 'description') as ExplorerNode;
      assert.ok(descNode, 'should have description node');
      assert.ok((descNode.description as string).endsWith('...'), 'visible value should be truncated');
      assert.ok(
        (descNode.tooltip as string).includes(longDesc),
        'tooltip should contain the full untruncated description',
      );
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('resource expand returns empty placeholder node when manifest has no fields', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;

      const children = await provider.getChildren(coderNode);
      const propNodes = children.filter(c => (c as ExplorerNode).nodeType === 'property');
      assert.strictEqual(propNodes.length, 1, 'should return one placeholder node');
      assert.ok((propNodes[0].label as string).includes('no properties'), 'placeholder label should say "no properties"');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('resource expand returns empty property list when manifest read throws', async () => {
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => {
      throw new Error('file not found');
    };

    try {
      const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
      const roots = await provider.getChildren();
      const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
      const resources = await provider.getChildren(agentsNode);
      const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;

      const children = await provider.getChildren(coderNode);
      // No properties (read failed), no overrides, no artifact dirs on coder
      assert.strictEqual(children.length, 0, 'should return empty array when manifest read fails');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('resource expand returns inline artifact-dir nodes', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'skill',
        displayName: 'SKILLS',
        resources: [
          {
            name: 'audit',
            kind: 'skill',
            baseManifest: '/workspace/xcaf/skills/audit/skill.xcaf',
            overrides: [],
            artifactDirs: [
              { name: 'references', path: '/workspace/xcaf/skills/audit/references', files: ['guide.md', 'patterns.md'] },
            ],
          },
        ],
      },
    ];
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: skill\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(groups));
      const roots = await provider.getChildren();
      const skillsNode = roots.find(r => (r.label as string).startsWith('SKILLS')) as ExplorerNode;
      const resources = await provider.getChildren(skillsNode);
      const auditNode = resources.find(r => r.label === 'audit') as ExplorerNode;

      const children = await provider.getChildren(auditNode);
      const dirNodes = children.filter(c => (c as ExplorerNode).nodeType === 'artifact-dir');
      assert.strictEqual(dirNodes.length, 1, 'should return one artifact-dir node inline');
      const dirNode = dirNodes[0] as ExplorerNode;
      assert.strictEqual(dirNode.label, 'references/ (2 files)');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('artifact-dir node expands to artifact-file nodes', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'skill',
        displayName: 'SKILLS',
        resources: [
          {
            name: 'audit',
            kind: 'skill',
            baseManifest: '/workspace/xcaf/skills/audit/skill.xcaf',
            overrides: [],
            artifactDirs: [
              { name: 'references', path: '/workspace/xcaf/skills/audit/references', files: ['guide.md', 'patterns.md'] },
            ],
          },
        ],
      },
    ];
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: skill\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(groups));
      const roots = await provider.getChildren();
      const skillsNode = roots.find(r => (r.label as string).startsWith('SKILLS')) as ExplorerNode;
      const resources = await provider.getChildren(skillsNode);
      const auditNode = resources.find(r => r.label === 'audit') as ExplorerNode;
      const children = await provider.getChildren(auditNode);
      const dirNode = children.find(c => (c as ExplorerNode).nodeType === 'artifact-dir') as ExplorerNode;
      assert.ok(dirNode);

      const fileNodes = await provider.getChildren(dirNode);
      assert.strictEqual(fileNodes.length, 2, 'should return two file nodes');
      const fileLabels = fileNodes.map(f => f.label as string);
      assert.ok(fileLabels.includes('guide.md'));
      assert.ok(fileLabels.includes('patterns.md'));
      fileNodes.forEach(f => {
        assert.strictEqual((f as ExplorerNode).nodeType, 'artifact-file');
      });
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('artifact-file node has resourceUri and vscode.open command', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'skill',
        displayName: 'SKILLS',
        resources: [
          {
            name: 'audit',
            kind: 'skill',
            baseManifest: '/workspace/xcaf/skills/audit/skill.xcaf',
            overrides: [],
            artifactDirs: [
              { name: 'references', path: '/workspace/xcaf/skills/audit/references', files: ['guide.md'] },
            ],
          },
        ],
      },
    ];
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: skill\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(groups));
      const roots = await provider.getChildren();
      const skillsNode = roots[0] as ExplorerNode;
      const resources = await provider.getChildren(skillsNode);
      const auditNode = resources[0] as ExplorerNode;
      const children = await provider.getChildren(auditNode);
      const dirNode = children.find(c => (c as ExplorerNode).nodeType === 'artifact-dir') as ExplorerNode;
      const fileNodes = await provider.getChildren(dirNode);

      const fileNode = fileNodes[0] as ExplorerNode;
      assert.ok(fileNode.resourceUri, 'should have resourceUri');
      assert.strictEqual(fileNode.resourceUri.fsPath, '/workspace/xcaf/skills/audit/references/guide.md');
      assert.ok(fileNode.command, 'should have command');
      assert.strictEqual(fileNode.command.command, 'vscode.open');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('empty artifact-dir shows "(0 files)" and is not collapsible', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'skill',
        displayName: 'SKILLS',
        resources: [
          {
            name: 'audit',
            kind: 'skill',
            baseManifest: '/workspace/xcaf/skills/audit/skill.xcaf',
            overrides: [],
            artifactDirs: [
              { name: 'references', path: '/workspace/xcaf/skills/audit/references', files: [] },
            ],
          },
        ],
      },
    ];
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: skill\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(groups));
      const roots = await provider.getChildren();
      const skillsNode = roots[0] as ExplorerNode;
      const resources = await provider.getChildren(skillsNode);
      const auditNode = resources[0] as ExplorerNode;
      const children = await provider.getChildren(auditNode);
      const dirNodes = children.filter(c => (c as ExplorerNode).nodeType === 'artifact-dir');

      assert.strictEqual(dirNodes.length, 1);
      const dirNode = dirNodes[0] as ExplorerNode;
      assert.strictEqual(dirNode.label, 'references/ (0 files)');
      assert.strictEqual(dirNode.collapsibleState, vscode.TreeItemCollapsibleState.None);
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  test('artifact-dir with 1 file shows singular "file" not "files"', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'skill',
        displayName: 'SKILLS',
        resources: [
          {
            name: 'audit',
            kind: 'skill',
            baseManifest: '/workspace/xcaf/skills/audit/skill.xcaf',
            overrides: [],
            artifactDirs: [
              { name: 'references', path: '/workspace/xcaf/skills/audit/references', files: ['guide.md'] },
            ],
          },
        ],
      },
    ];
    const vscodeModule = require('vscode');
    const originalOpen = vscodeModule.workspace.openTextDocument;
    vscodeModule.workspace.openTextDocument = async (_uri: any) => ({
      getText: () => '---\nkind: skill\n---',
    });

    try {
      const provider = new ObjectExplorerProvider(makeModel(groups));
      const roots = await provider.getChildren();
      const skillsNode = roots[0] as ExplorerNode;
      const resources = await provider.getChildren(skillsNode);
      const auditNode = resources[0] as ExplorerNode;
      const children = await provider.getChildren(auditNode);
      const dirNodes = children.filter(c => (c as ExplorerNode).nodeType === 'artifact-dir');

      const dirNode = dirNodes[0] as ExplorerNode;
      assert.strictEqual(dirNode.label, 'references/ (1 file)');
    } finally {
      vscodeModule.workspace.openTextDocument = originalOpen;
    }
  });

  // ---------------------------------------------------------------------------
  // Scope-group tests
  // ---------------------------------------------------------------------------

  test('kind-group with scoped resources shows scope-group nodes', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'rule',
        displayName: 'RULES',
        resources: [
          {
            name: 'go-code-quality',
            kind: 'rule',
            scope: 'cli',
            baseManifest: '/workspace/xcaf/rules/cli/go-code-quality/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
          {
            name: 'api-conventions',
            kind: 'rule',
            scope: 'platform',
            baseManifest: '/workspace/xcaf/rules/platform/api-conventions/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
          {
            name: 'adr-governance',
            kind: 'rule',
            baseManifest: '/workspace/xcaf/rules/adr-governance/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
        ],
      },
    ];

    const provider = new ObjectExplorerProvider(makeModel(groups));
    const roots = await provider.getChildren();
    const rulesNode = roots.find(r => (r.label as string).startsWith('RULES')) as ExplorerNode;
    assert.ok(rulesNode);

    const children = await provider.getChildren(rulesNode);
    // Should have: cli/ scope-group, platform/ scope-group, adr-governance resource
    assert.strictEqual(children.length, 3);

    const scopeGroups = children.filter(c => (c as ExplorerNode).nodeType === 'scope-group');
    const resources = children.filter(c => (c as ExplorerNode).nodeType === 'resource');

    assert.strictEqual(scopeGroups.length, 2, 'should have 2 scope-group nodes');
    assert.strictEqual(resources.length, 1, 'should have 1 unscoped resource node');

    const scopeLabels = scopeGroups.map(s => s.label as string);
    assert.ok(scopeLabels.includes('cli/ (1)'));
    assert.ok(scopeLabels.includes('platform/ (1)'));

    assert.strictEqual(resources[0].label, 'adr-governance');
  });

  test('scope-group nodes are sorted alphabetically before unscoped resources', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'rule',
        displayName: 'RULES',
        resources: [
          { name: 'z-flat-rule', kind: 'rule', baseManifest: '/w/rule.xcaf', overrides: [], artifactDirs: [] },
          { name: 'b-scoped', kind: 'rule', scope: 'zzz', baseManifest: '/w/zzz/b-scoped/rule.xcaf', overrides: [], artifactDirs: [] },
          { name: 'a-scoped', kind: 'rule', scope: 'aaa', baseManifest: '/w/aaa/a-scoped/rule.xcaf', overrides: [], artifactDirs: [] },
        ],
      },
    ];

    const provider = new ObjectExplorerProvider(makeModel(groups));
    const roots = await provider.getChildren();
    const rulesNode = roots[0] as ExplorerNode;
    const children = await provider.getChildren(rulesNode);

    // aaa/ first, then zzz/, then z-flat-rule
    assert.strictEqual(children[0].label, 'aaa/ (1)');
    assert.strictEqual(children[1].label, 'zzz/ (1)');
    assert.strictEqual(children[2].label, 'z-flat-rule');
  });

  test('scope-group expansion returns resource nodes for that scope only', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'rule',
        displayName: 'RULES',
        resources: [
          {
            name: 'go-code-quality',
            kind: 'rule',
            scope: 'cli',
            baseManifest: '/workspace/xcaf/rules/cli/go-code-quality/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
          {
            name: 'open-source-standards',
            kind: 'rule',
            scope: 'cli',
            baseManifest: '/workspace/xcaf/rules/cli/open-source-standards/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
          {
            name: 'api-conventions',
            kind: 'rule',
            scope: 'platform',
            baseManifest: '/workspace/xcaf/rules/platform/api-conventions/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
        ],
      },
    ];

    const provider = new ObjectExplorerProvider(makeModel(groups));
    const roots = await provider.getChildren();
    const rulesNode = roots[0] as ExplorerNode;
    const kindChildren = await provider.getChildren(rulesNode);

    const cliGroup = kindChildren.find(c => (c.label as string).startsWith('cli/')) as ExplorerNode;
    assert.ok(cliGroup, 'should have cli/ scope-group');

    const cliResources = await provider.getChildren(cliGroup);
    assert.strictEqual(cliResources.length, 2, 'cli/ scope-group should have 2 resources');
    const cliNames = cliResources.map(r => r.label as string);
    assert.ok(cliNames.includes('go-code-quality'));
    assert.ok(cliNames.includes('open-source-standards'));

    // Verify resource nodes under scope-group are proper resource nodes
    cliResources.forEach(r => {
      assert.strictEqual((r as ExplorerNode).nodeType, 'resource');
    });
  });

  test('scope-group has Collapsed collapsible state', async () => {
    const groups: XcafKindGroup[] = [
      {
        kind: 'rule',
        displayName: 'RULES',
        resources: [
          {
            name: 'go-code-quality',
            kind: 'rule',
            scope: 'cli',
            baseManifest: '/workspace/xcaf/rules/cli/go-code-quality/rule.xcaf',
            overrides: [],
            artifactDirs: [],
          },
        ],
      },
    ];

    const provider = new ObjectExplorerProvider(makeModel(groups));
    const roots = await provider.getChildren();
    const rulesNode = roots[0] as ExplorerNode;
    const children = await provider.getChildren(rulesNode);

    const cliGroup = children.find(c => (c as ExplorerNode).nodeType === 'scope-group') as ExplorerNode;
    assert.ok(cliGroup);
    assert.strictEqual(cliGroup.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(cliGroup.contextValue, 'scope-group');
  });

  test('setModel updates the model so getChildren reflects new data', async () => {
    const provider = new ObjectExplorerProvider(makeModel([]));

    // Initially empty — returns the "no project detected" placeholder
    const emptyRoots = await provider.getChildren();
    assert.strictEqual(emptyRoots.length, 1);
    assert.ok((emptyRoots[0].label as string).includes('No xcaffold project detected'));

    // After setModel, getChildren returns real kind groups
    provider.setModel(makeModel(makeGroups()));
    provider.refresh();

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 3);
  });

  test('contextValue on ExplorerNode matches nodeType', async () => {
    const provider = new ObjectExplorerProvider(makeModel(makeGroups()));
    const roots = await provider.getChildren();

    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    assert.strictEqual(agentsNode.contextValue, 'kind-group');

    const resources = await provider.getChildren(agentsNode);
    const coderNode = resources.find(r => r.label === 'coder') as ExplorerNode;
    assert.strictEqual(coderNode.contextValue, 'resource');
  });

  // ---------------------------------------------------------------------------
  // CLI fallback tests
  // ---------------------------------------------------------------------------

  test('CLI fallback when model is empty: kind-group nodes appear from CLI output', async () => {
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

    const mockCli = {
      run: async (_args: string[], _cwd: string) => ({ stdout, stderr: '' }),
    };

    const provider = new ObjectExplorerProvider(makeModel([]), mockCli, '/workspace');
    const roots = await provider.getChildren();

    assert.ok(roots.length >= 2, 'should have kind-group nodes from CLI output');
    const labels = roots.map(r => r.label as string);
    assert.ok(labels.some(l => l.startsWith('AGENTS')), 'should have AGENTS group');
    assert.ok(labels.some(l => l.startsWith('SKILLS')), 'should have SKILLS group');
    roots.forEach(r => {
      assert.strictEqual((r as ExplorerNode).nodeType, 'kind-group');
    });
  });

  test('CLI fallback kind-group expansion shows simple resources with no children', async () => {
    const stdout = [
      'AGENTS  (2)',
      '  coder',
      '  reviewer',
    ].join('\n');

    const mockCli = {
      run: async (_args: string[], _cwd: string) => ({ stdout, stderr: '' }),
    };

    const provider = new ObjectExplorerProvider(makeModel([]), mockCli, '/workspace');
    const roots = await provider.getChildren();

    const agentsNode = roots.find(r => (r.label as string).startsWith('AGENTS')) as ExplorerNode;
    assert.ok(agentsNode, 'should have AGENTS group');

    const resources = await provider.getChildren(agentsNode);
    assert.strictEqual(resources.length, 2, 'should return 2 resource nodes');

    const names = resources.map(r => r.label as string);
    assert.ok(names.includes('coder'));
    assert.ok(names.includes('reviewer'));

    resources.forEach(r => {
      assert.strictEqual(
        (r as ExplorerNode).collapsibleState,
        vscode.TreeItemCollapsibleState.None,
        'fallback resources should not be expandable',
      );
    });
  });

  test('CLI fallback returns error node when CLI throws', async () => {
    const mockCli = {
      run: async (_args: string[], _cwd: string): Promise<{ stdout: string; stderr: string }> => {
        throw new Error('xcaffold not found');
      },
    };

    const provider = new ObjectExplorerProvider(makeModel([]), mockCli, '/workspace');
    const roots = await provider.getChildren();

    assert.strictEqual(roots.length, 1, 'should return exactly one error node');
    assert.ok((roots[0].label as string).includes('CLI Error'), 'error node label should include "CLI Error"');
  });

  test('model-driven mode takes priority over CLI: CLI not called when model has data', async () => {
    let cliCalled = false;
    const mockCli = {
      run: async (_args: string[], _cwd: string) => {
        cliCalled = true;
        return { stdout: '', stderr: '' };
      },
    };

    const provider = new ObjectExplorerProvider(makeModel(makeGroups()), mockCli, '/workspace');
    const roots = await provider.getChildren();

    assert.strictEqual(cliCalled, false, 'CLI should not be called when model has data');
    assert.strictEqual(roots.length, 3, 'should return model-driven kind groups');
    roots.forEach(r => {
      assert.strictEqual((r as ExplorerNode).nodeType, 'kind-group');
    });
  });
});
