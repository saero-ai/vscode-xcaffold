import * as assert from 'assert';
import * as path from 'path';
import {
  dirNameToKind,
  kindToDisplayName,
  parseOverrideFilename,
  scanXcafDirectory,
  FsAdapter,
  XcafProjectModel,
} from '../xcafProjectModel';

suite('xcafProjectModel', () => {
  suite('dirNameToKind', () => {
    test('agents -> agent', () => {
      assert.strictEqual(dirNameToKind('agents'), 'agent');
    });

    test('skills -> skill', () => {
      assert.strictEqual(dirNameToKind('skills'), 'skill');
    });

    test('memories -> memory', () => {
      assert.strictEqual(dirNameToKind('memories'), 'memory');
    });

    test('policies -> policy', () => {
      assert.strictEqual(dirNameToKind('policies'), 'policy');
    });

    test('mcp -> mcp', () => {
      assert.strictEqual(dirNameToKind('mcp'), 'mcp');
    });

    test('unknown directory -> undefined', () => {
      assert.strictEqual(dirNameToKind('random'), undefined);
    });

    test('rules -> rule', () => {
      assert.strictEqual(dirNameToKind('rules'), 'rule');
    });

    test('workflows -> workflow', () => {
      assert.strictEqual(dirNameToKind('workflows'), 'workflow');
    });

    test('blueprints -> blueprint', () => {
      assert.strictEqual(dirNameToKind('blueprints'), 'blueprint');
    });
  });

  suite('kindToDisplayName', () => {
    test('agent -> AGENTS', () => {
      assert.strictEqual(kindToDisplayName('agent'), 'AGENTS');
    });

    test('memory -> MEMORIES', () => {
      assert.strictEqual(kindToDisplayName('memory'), 'MEMORIES');
    });

    test('policy -> POLICIES', () => {
      assert.strictEqual(kindToDisplayName('policy'), 'POLICIES');
    });

    test('mcp -> MCP SERVERS', () => {
      assert.strictEqual(kindToDisplayName('mcp'), 'MCP SERVERS');
    });

    test('unknown kind falls back to uppercase + S', () => {
      assert.strictEqual(kindToDisplayName('unknown'), 'UNKNOWNS');
    });

    test('skill -> SKILLS', () => {
      assert.strictEqual(kindToDisplayName('skill'), 'SKILLS');
    });

    test('rule -> RULES', () => {
      assert.strictEqual(kindToDisplayName('rule'), 'RULES');
    });

    test('blueprint -> BLUEPRINTS', () => {
      assert.strictEqual(kindToDisplayName('blueprint'), 'BLUEPRINTS');
    });
  });

  suite('parseOverrideFilename', () => {
    test('agent.claude.xcaf with kind agent -> claude', () => {
      assert.strictEqual(parseOverrideFilename('agent.claude.xcaf', 'agent'), 'claude');
    });

    test('skill.gemini.xcaf with kind skill -> gemini', () => {
      assert.strictEqual(parseOverrideFilename('skill.gemini.xcaf', 'skill'), 'gemini');
    });

    test('agent.xcaf with kind agent -> undefined (base manifest, not override)', () => {
      assert.strictEqual(parseOverrideFilename('agent.xcaf', 'agent'), undefined);
    });

    test('readme.md with kind agent -> undefined (not .xcaf)', () => {
      assert.strictEqual(parseOverrideFilename('readme.md', 'agent'), undefined);
    });

    test('agent.claude.xcaf with kind skill -> undefined (kind mismatch)', () => {
      assert.strictEqual(parseOverrideFilename('agent.claude.xcaf', 'skill'), undefined);
    });

    test('rule.cursor.xcaf with kind rule -> cursor', () => {
      assert.strictEqual(parseOverrideFilename('rule.cursor.xcaf', 'rule'), 'cursor');
    });
  });

  suite('scanXcafDirectory', () => {
    // File=1, Directory=2 per vscode.FileType convention
    const FILE = 1;
    const DIR = 2;

    function makeMockFs(
      structure: Record<string, Array<[string, number]>>,
    ): FsAdapter {
      return {
        readDirectory: async (dirPath: string) => {
          const normalized = dirPath.replace(/\\/g, '/');
          const entries = structure[normalized];
          if (entries !== undefined) {
            return entries;
          }
          return [];
        },
      };
    }

    test('returns 3 kind groups sorted alphabetically', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [
          ['agents', DIR],
          ['skills', DIR],
          ['rules', DIR],
        ],
        '/workspace/xcaf/agents': [
          ['auth-specialist', DIR],
          ['simple-agent', DIR],
        ],
        '/workspace/xcaf/agents/auth-specialist': [
          ['agent.xcaf', FILE],
          ['agent.claude.xcaf', FILE],
          ['agent.gemini.xcaf', FILE],
        ],
        '/workspace/xcaf/agents/simple-agent': [
          ['agent.xcaf', FILE],
        ],
        '/workspace/xcaf/skills': [
          ['brainstorming', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming': [
          ['skill.xcaf', FILE],
          ['skill.claude.xcaf', FILE],
          ['references', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming/references': [
          ['canvas.md', FILE],
          ['intent.md', FILE],
        ],
        '/workspace/xcaf/rules': [
          ['my-rule', DIR],
        ],
        '/workspace/xcaf/rules/my-rule': [
          ['rule.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      assert.strictEqual(groups.length, 3);

      // Sorted alphabetically by kind: agent, rule, skill
      assert.strictEqual(groups[0].kind, 'agent');
      assert.strictEqual(groups[1].kind, 'rule');
      assert.strictEqual(groups[2].kind, 'skill');
    });

    test('agent kind has 2 resources sorted by name', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [
          ['agents', DIR],
          ['skills', DIR],
          ['rules', DIR],
        ],
        '/workspace/xcaf/agents': [
          ['simple-agent', DIR],
          ['auth-specialist', DIR],
        ],
        '/workspace/xcaf/agents/auth-specialist': [
          ['agent.xcaf', FILE],
          ['agent.claude.xcaf', FILE],
          ['agent.gemini.xcaf', FILE],
        ],
        '/workspace/xcaf/agents/simple-agent': [
          ['agent.xcaf', FILE],
        ],
        '/workspace/xcaf/skills': [
          ['brainstorming', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming': [
          ['skill.xcaf', FILE],
          ['skill.claude.xcaf', FILE],
          ['references', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming/references': [
          ['canvas.md', FILE],
          ['intent.md', FILE],
        ],
        '/workspace/xcaf/rules': [
          ['my-rule', DIR],
        ],
        '/workspace/xcaf/rules/my-rule': [
          ['rule.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const agentGroup = groups.find(g => g.kind === 'agent')!;
      assert.ok(agentGroup, 'agent group should exist');
      assert.strictEqual(agentGroup.resources.length, 2);
      // Resources sorted alphabetically
      assert.strictEqual(agentGroup.resources[0].name, 'auth-specialist');
      assert.strictEqual(agentGroup.resources[1].name, 'simple-agent');
    });

    test('auth-specialist has 2 overrides (claude and gemini)', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['agents', DIR]],
        '/workspace/xcaf/agents': [['auth-specialist', DIR]],
        '/workspace/xcaf/agents/auth-specialist': [
          ['agent.xcaf', FILE],
          ['agent.claude.xcaf', FILE],
          ['agent.gemini.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const agentGroup = groups.find(g => g.kind === 'agent')!;
      const resource = agentGroup.resources[0];
      assert.strictEqual(resource.name, 'auth-specialist');
      assert.strictEqual(resource.overrides.length, 2);

      const providers = resource.overrides.map(o => o.provider).sort();
      assert.deepStrictEqual(providers, ['claude', 'gemini']);
    });

    test('simple-agent has 0 overrides and 0 artifact dirs', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['agents', DIR]],
        '/workspace/xcaf/agents': [['simple-agent', DIR]],
        '/workspace/xcaf/agents/simple-agent': [
          ['agent.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const agentGroup = groups.find(g => g.kind === 'agent')!;
      const resource = agentGroup.resources[0];
      assert.strictEqual(resource.name, 'simple-agent');
      assert.strictEqual(resource.overrides.length, 0);
      assert.strictEqual(resource.artifactDirs.length, 0);
    });

    test('brainstorming skill has 1 override (claude) and 1 artifact dir (references with 2 files)', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['skills', DIR]],
        '/workspace/xcaf/skills': [['brainstorming', DIR]],
        '/workspace/xcaf/skills/brainstorming': [
          ['skill.xcaf', FILE],
          ['skill.claude.xcaf', FILE],
          ['references', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming/references': [
          ['canvas.md', FILE],
          ['intent.md', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const skillGroup = groups.find(g => g.kind === 'skill')!;
      const resource = skillGroup.resources[0];
      assert.strictEqual(resource.name, 'brainstorming');
      assert.strictEqual(resource.overrides.length, 1);
      assert.strictEqual(resource.overrides[0].provider, 'claude');
      assert.strictEqual(resource.artifactDirs.length, 1);
      assert.strictEqual(resource.artifactDirs[0].name, 'references');
      assert.strictEqual(resource.artifactDirs[0].files.length, 2);
      assert.ok(resource.artifactDirs[0].files.includes('canvas.md'));
      assert.ok(resource.artifactDirs[0].files.includes('intent.md'));
    });

    test('my-rule has 0 overrides and 0 artifact dirs', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['rules', DIR]],
        '/workspace/xcaf/rules': [['my-rule', DIR]],
        '/workspace/xcaf/rules/my-rule': [
          ['rule.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const ruleGroup = groups.find(g => g.kind === 'rule')!;
      const resource = ruleGroup.resources[0];
      assert.strictEqual(resource.name, 'my-rule');
      assert.strictEqual(resource.overrides.length, 0);
      assert.strictEqual(resource.artifactDirs.length, 0);
    });

    test('empty xcaf directory returns empty array', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      assert.deepStrictEqual(groups, []);
    });

    test('unknown top-level directory is skipped', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [
          ['random', DIR],
          ['agents', DIR],
        ],
        '/workspace/xcaf/agents': [['simple-agent', DIR]],
        '/workspace/xcaf/agents/simple-agent': [
          ['agent.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      assert.strictEqual(groups.length, 1);
      assert.strictEqual(groups[0].kind, 'agent');
    });

    test('resource dir with no base manifest is skipped', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['agents', DIR]],
        '/workspace/xcaf/agents': [
          ['no-manifest', DIR],
          ['has-manifest', DIR],
        ],
        '/workspace/xcaf/agents/no-manifest': [
          // Missing agent.xcaf — only has an override
          ['agent.claude.xcaf', FILE],
        ],
        '/workspace/xcaf/agents/has-manifest': [
          ['agent.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const agentGroup = groups.find(g => g.kind === 'agent')!;
      assert.ok(agentGroup, 'agent group should exist');
      assert.strictEqual(agentGroup.resources.length, 1);
      assert.strictEqual(agentGroup.resources[0].name, 'has-manifest');
    });

    test('override file path is constructed correctly', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['agents', DIR]],
        '/workspace/xcaf/agents': [['my-agent', DIR]],
        '/workspace/xcaf/agents/my-agent': [
          ['agent.xcaf', FILE],
          ['agent.cursor.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const agentGroup = groups.find(g => g.kind === 'agent')!;
      const resource = agentGroup.resources[0];
      assert.strictEqual(resource.overrides.length, 1);
      assert.strictEqual(resource.overrides[0].provider, 'cursor');
      assert.ok(
        resource.overrides[0].path.endsWith(path.join('my-agent', 'agent.cursor.xcaf')),
        `Expected path to end with my-agent/agent.cursor.xcaf, got: ${resource.overrides[0].path}`,
      );
    });

    test('kind groups have correct displayName', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [
          ['agents', DIR],
          ['memories', DIR],
        ],
        '/workspace/xcaf/agents': [['my-agent', DIR]],
        '/workspace/xcaf/agents/my-agent': [['agent.xcaf', FILE]],
        '/workspace/xcaf/memories': [['session', DIR]],
        '/workspace/xcaf/memories/session': [['memory.xcaf', FILE]],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const agentGroup = groups.find(g => g.kind === 'agent')!;
      const memoryGroup = groups.find(g => g.kind === 'memory')!;
      assert.strictEqual(agentGroup.displayName, 'AGENTS');
      assert.strictEqual(memoryGroup.displayName, 'MEMORIES');
    });

    test('scope directory: scoped rule has scope field set, flat rule has no scope', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['rules', DIR]],
        '/workspace/xcaf/rules': [
          ['my-rule', DIR],    // flat rule — contains rule.xcaf directly
          ['cli', DIR],        // scope directory — contains subdirs with rule.xcaf
        ],
        '/workspace/xcaf/rules/my-rule': [
          ['rule.xcaf', FILE],
        ],
        '/workspace/xcaf/rules/cli': [
          // No rule.xcaf here — this is a scope directory
          ['go-code-quality', DIR],
        ],
        '/workspace/xcaf/rules/cli/go-code-quality': [
          ['rule.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const ruleGroup = groups.find(g => g.kind === 'rule')!;
      assert.ok(ruleGroup, 'rule group should exist');
      assert.strictEqual(ruleGroup.resources.length, 2);

      const flatRule = ruleGroup.resources.find(r => r.name === 'my-rule');
      assert.ok(flatRule, 'flat rule should exist');
      assert.strictEqual(flatRule.scope, undefined);

      const scopedRule = ruleGroup.resources.find(r => r.name === 'go-code-quality');
      assert.ok(scopedRule, 'scoped rule should exist');
      assert.strictEqual(scopedRule.scope, 'cli');
      assert.ok(
        scopedRule.baseManifest.endsWith(path.join('go-code-quality', 'rule.xcaf')),
        `Expected baseManifest to end with go-code-quality/rule.xcaf, got: ${scopedRule.baseManifest}`,
      );
    });

    test('scope directory with multiple scopes produces resources in each scope', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['rules', DIR]],
        '/workspace/xcaf/rules': [
          ['cli', DIR],
          ['platform', DIR],
        ],
        '/workspace/xcaf/rules/cli': [
          ['go-code-quality', DIR],
          ['open-source-standards', DIR],
        ],
        '/workspace/xcaf/rules/cli/go-code-quality': [['rule.xcaf', FILE]],
        '/workspace/xcaf/rules/cli/open-source-standards': [['rule.xcaf', FILE]],
        '/workspace/xcaf/rules/platform': [
          ['api-conventions', DIR],
        ],
        '/workspace/xcaf/rules/platform/api-conventions': [['rule.xcaf', FILE]],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const ruleGroup = groups.find(g => g.kind === 'rule')!;
      assert.ok(ruleGroup, 'rule group should exist');
      assert.strictEqual(ruleGroup.resources.length, 3);

      const cliRules = ruleGroup.resources.filter(r => r.scope === 'cli');
      assert.strictEqual(cliRules.length, 2);

      const platformRules = ruleGroup.resources.filter(r => r.scope === 'platform');
      assert.strictEqual(platformRules.length, 1);
      assert.strictEqual(platformRules[0].name, 'api-conventions');
    });

    test('only 1-level deep files are read for artifact dirs', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['skills', DIR]],
        '/workspace/xcaf/skills': [['my-skill', DIR]],
        '/workspace/xcaf/skills/my-skill': [
          ['skill.xcaf', FILE],
          ['refs', DIR],
        ],
        '/workspace/xcaf/skills/my-skill/refs': [
          ['file1.md', FILE],
          ['subdir', DIR],  // subdir — should not recurse into it
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const skillGroup = groups.find(g => g.kind === 'skill')!;
      const resource = skillGroup.resources[0];
      assert.strictEqual(resource.artifactDirs.length, 1);
      // Only files (not directories) should appear in the files list
      assert.strictEqual(resource.artifactDirs[0].files.length, 1);
      assert.strictEqual(resource.artifactDirs[0].files[0], 'file1.md');
    });

    test('flat .xcaf files in kind directory are discovered as resources', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['code-quality.xcaf', FILE],
          ['documentation.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint');
      assert.ok(bpGroup, 'blueprint group should exist');
      assert.strictEqual(bpGroup.resources.length, 2);
      const names = bpGroup.resources.map(r => r.name).sort();
      assert.deepStrictEqual(names, ['code-quality', 'documentation']);
    });

    test('flat .xcaf resources have correct baseManifest and empty overrides/artifactDirs', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['code-quality.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      const resource = bpGroup.resources[0];
      assert.strictEqual(resource.name, 'code-quality');
      assert.strictEqual(resource.kind, 'blueprint');
      assert.ok(
        resource.baseManifest.endsWith(path.join('blueprints', 'code-quality.xcaf')),
        `Expected baseManifest to end with blueprints/code-quality.xcaf, got: ${resource.baseManifest}`,
      );
      assert.strictEqual(resource.overrides.length, 0);
      assert.strictEqual(resource.artifactDirs.length, 0);
    });

    test('override-style flat files (e.g. blueprint.claude.xcaf) are skipped', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['code-quality.xcaf', FILE],
          ['blueprint.claude.xcaf', FILE],  // override pattern — should be skipped
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.strictEqual(bpGroup.resources.length, 1);
      assert.strictEqual(bpGroup.resources[0].name, 'code-quality');
    });

    test('category subdirectory: flat .xcaf files in subdirs are discovered', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['category-a', DIR],
        ],
        '/workspace/xcaf/blueprints/category-a': [
          ['blueprint-one.xcaf', FILE],
          ['blueprint-two.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.ok(bpGroup, 'blueprint group should exist');
      assert.strictEqual(bpGroup.resources.length, 2);
      const names = bpGroup.resources.map(r => r.name).sort();
      assert.deepStrictEqual(names, ['blueprint-one', 'blueprint-two']);
    });

    test('category subdirectory: multiple category subdirs produce resources from each', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['category-a', DIR],
          ['category-b', DIR],
        ],
        '/workspace/xcaf/blueprints/category-a': [
          ['bp-one.xcaf', FILE],
        ],
        '/workspace/xcaf/blueprints/category-b': [
          ['bp-two.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.ok(bpGroup, 'blueprint group should exist');
      assert.strictEqual(bpGroup.resources.length, 2);
      const names = bpGroup.resources.map(r => r.name).sort();
      assert.deepStrictEqual(names, ['bp-one', 'bp-two']);
    });

    test('category subdirectory: mixed flat files at kind level and in category subdir', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['quick.xcaf', FILE],       // flat at kind level
          ['composed', DIR],          // category subdirectory
        ],
        '/workspace/xcaf/blueprints/composed': [
          ['full-stack.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.ok(bpGroup, 'blueprint group should exist');
      assert.strictEqual(bpGroup.resources.length, 2);
      const names = bpGroup.resources.map(r => r.name).sort();
      assert.deepStrictEqual(names, ['full-stack', 'quick']);
    });

    test('category subdirectory: works for any kind, not just blueprints', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['skills', DIR]],
        '/workspace/xcaf/skills': [
          ['utility', DIR],
        ],
        '/workspace/xcaf/skills/utility': [
          ['helper-skill.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const skillGroup = groups.find(g => g.kind === 'skill')!;
      assert.ok(skillGroup, 'skill group should exist');
      assert.strictEqual(skillGroup.resources.length, 1);
      assert.strictEqual(skillGroup.resources[0].name, 'helper-skill');
      assert.strictEqual(skillGroup.resources[0].kind, 'skill');
    });

    test('category subdirectory: override-style files are skipped', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['composed', DIR],
        ],
        '/workspace/xcaf/blueprints/composed': [
          ['full-stack.xcaf', FILE],
          ['blueprint.claude.xcaf', FILE],  // override pattern — should be skipped
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.strictEqual(bpGroup.resources.length, 1);
      assert.strictEqual(bpGroup.resources[0].name, 'full-stack');
    });

    test('category subdirectory: non-.xcaf files are ignored', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['composed', DIR],
        ],
        '/workspace/xcaf/blueprints/composed': [
          ['full-stack.xcaf', FILE],
          ['README.md', FILE],
          ['.gitkeep', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.strictEqual(bpGroup.resources.length, 1);
      assert.strictEqual(bpGroup.resources[0].name, 'full-stack');
    });

    test('non-.xcaf flat files in kind directory are ignored', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['blueprints', DIR]],
        '/workspace/xcaf/blueprints': [
          ['code-quality.xcaf', FILE],
          ['README.md', FILE],
          ['.gitkeep', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const bpGroup = groups.find(g => g.kind === 'blueprint')!;
      assert.strictEqual(bpGroup.resources.length, 1);
      assert.strictEqual(bpGroup.resources[0].name, 'code-quality');
    });

    test('mixed flat files and subdirectories in same kind directory', async () => {
      const xcafRoot = '/workspace/xcaf';
      const fs = makeMockFs({
        '/workspace/xcaf': [['policies', DIR]],
        '/workspace/xcaf/policies': [
          ['security.xcaf', FILE],        // flat file
          ['advanced-policy', DIR],       // directory-per-resource
        ],
        '/workspace/xcaf/policies/advanced-policy': [
          ['policy.xcaf', FILE],
        ],
      });

      const groups = await scanXcafDirectory(xcafRoot, fs);
      const policyGroup = groups.find(g => g.kind === 'policy')!;
      assert.ok(policyGroup, 'policy group should exist');
      assert.strictEqual(policyGroup.resources.length, 2);
      const names = policyGroup.resources.map(r => r.name).sort();
      assert.deepStrictEqual(names, ['advanced-policy', 'security']);
    });
  });

  suite('XcafProjectModel', () => {
    // File=1, Directory=2 per vscode.FileType convention
    const FILE = 1;
    const DIR = 2;

    function makeMockFs(
      structure: Record<string, Array<[string, number]>>,
    ): FsAdapter {
      return {
        readDirectory: async (dirPath: string) => {
          const normalized = dirPath.replace(/\\/g, '/');
          const entries = structure[normalized];
          if (entries !== undefined) {
            return entries;
          }
          return [];
        },
      };
    }

    const xcafRoot = '/workspace/xcaf';

    function makeFullFs(): FsAdapter {
      return makeMockFs({
        '/workspace/xcaf': [
          ['agents', DIR],
          ['skills', DIR],
          ['rules', DIR],
        ],
        '/workspace/xcaf/agents': [
          ['auth-specialist', DIR],
          ['simple-agent', DIR],
        ],
        '/workspace/xcaf/agents/auth-specialist': [
          ['agent.xcaf', FILE],
          ['agent.claude.xcaf', FILE],
          ['agent.gemini.xcaf', FILE],
        ],
        '/workspace/xcaf/agents/simple-agent': [
          ['agent.xcaf', FILE],
        ],
        '/workspace/xcaf/skills': [
          ['brainstorming', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming': [
          ['skill.xcaf', FILE],
          ['skill.claude.xcaf', FILE],
          ['references', DIR],
        ],
        '/workspace/xcaf/skills/brainstorming/references': [
          ['canvas.md', FILE],
          ['intent.md', FILE],
        ],
        '/workspace/xcaf/rules': [
          ['my-rule', DIR],
        ],
        '/workspace/xcaf/rules/my-rule': [
          ['rule.xcaf', FILE],
        ],
      });
    }

    test('getKinds() returns sorted kind groups (agent, rule, skill)', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const kinds = model.getKinds().map(g => g.kind);
      assert.deepStrictEqual(kinds, ['agent', 'rule', 'skill']);
    });

    test('getResources("agent") returns 2 resources', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const resources = model.getResources('agent');
      assert.strictEqual(resources.length, 2);
    });

    test('getResources("unknown") returns empty array', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const resources = model.getResources('unknown');
      assert.deepStrictEqual(resources, []);
    });

    test('getResource("agent", "auth-specialist") returns resource with 2 overrides', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const resource = model.getResource('agent', 'auth-specialist');
      assert.ok(resource, 'resource should exist');
      assert.strictEqual(resource.name, 'auth-specialist');
      assert.strictEqual(resource.overrides.length, 2);
    });

    test('getResource("agent", "nonexistent") returns undefined', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const resource = model.getResource('agent', 'nonexistent');
      assert.strictEqual(resource, undefined);
    });

    test('resolve("agent", "auth-specialist") returns entry with correct fileUri', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const entry = model.resolve('agent', 'auth-specialist');
      assert.ok(entry, 'entry should exist');
      assert.ok(
        entry.fileUri.endsWith(path.join('auth-specialist', 'agent.xcaf')),
        `Expected fileUri to end with auth-specialist/agent.xcaf, got: ${entry.fileUri}`,
      );
      assert.strictEqual(entry.kind, 'agent');
      assert.strictEqual(entry.name, 'auth-specialist');
      assert.strictEqual(entry.nameLine, 0);
    });

    test('resolve("agent", "nonexistent") returns undefined', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const entry = model.resolve('agent', 'nonexistent');
      assert.strictEqual(entry, undefined);
    });

    test('resolveByName("brainstorming") returns skill entry with correct fileUri', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const entry = model.resolveByName('brainstorming');
      assert.ok(entry, 'entry should exist');
      assert.ok(
        entry.fileUri.endsWith(path.join('brainstorming', 'skill.xcaf')),
        `Expected fileUri to end with brainstorming/skill.xcaf, got: ${entry.fileUri}`,
      );
      assert.strictEqual(entry.kind, 'skill');
      assert.strictEqual(entry.name, 'brainstorming');
      assert.strictEqual(entry.nameLine, 0);
    });

    test('resolveByName("nonexistent") returns undefined', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const entry = model.resolveByName('nonexistent');
      assert.strictEqual(entry, undefined);
    });

    test('allEntries() returns 4 entries (one per resource base manifest)', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const entries = model.allEntries();
      assert.strictEqual(entries.length, 4);
    });

    test('allEntries() entries each have nameLine: 0', async () => {
      const model = await XcafProjectModel.scan(xcafRoot, makeFullFs());
      const entries = model.allEntries();
      for (const entry of entries) {
        assert.strictEqual(entry.nameLine, 0);
      }
    });

    test('constructor with empty groups produces empty model', () => {
      const model = new XcafProjectModel([]);
      assert.deepStrictEqual(model.getKinds(), []);
      assert.deepStrictEqual(model.getResources('agent'), []);
      assert.strictEqual(model.getResource('agent', 'foo'), undefined);
      assert.strictEqual(model.resolve('agent', 'foo'), undefined);
      assert.strictEqual(model.resolveByName('foo'), undefined);
      assert.deepStrictEqual(model.allEntries(), []);
    });
  });
});
