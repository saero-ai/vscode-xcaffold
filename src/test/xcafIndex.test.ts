import * as assert from 'assert';
import { XcafIndex, XcafEntry, parseFrontmatter } from '../xcafIndex';
import { XcafProjectModel, XcafKindGroup } from '../xcafProjectModel';

suite('XcafIndex', () => {
  suite('parseFrontmatter', () => {
    test('extracts kind and name from valid frontmatter', () => {
      const content = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: reviewer',
        'description: "Code reviewer"',
        '---',
        'You are a code reviewer.',
      ].join('\n');

      const result = parseFrontmatter(content);
      assert.deepStrictEqual(result, {
        kind: 'agent',
        name: 'reviewer',
        nameLine: 3,
      });
    });

    test('returns null for content without frontmatter delimiters', () => {
      const content = 'kind: agent\nname: reviewer';
      const result = parseFrontmatter(content);
      assert.strictEqual(result, null);
    });

    test('returns null when kind is missing', () => {
      const content = [
        '---',
        'name: reviewer',
        'version: "1.0"',
        '---',
      ].join('\n');

      const result = parseFrontmatter(content);
      assert.strictEqual(result, null);
    });

    test('returns null when name is missing', () => {
      const content = [
        '---',
        'kind: agent',
        'version: "1.0"',
        '---',
      ].join('\n');

      const result = parseFrontmatter(content);
      assert.strictEqual(result, null);
    });

    test('handles quoted name values', () => {
      const content = [
        '---',
        'kind: skill',
        'version: "1.0"',
        'name: "my-skill"',
        '---',
      ].join('\n');

      const result = parseFrontmatter(content);
      assert.deepStrictEqual(result, {
        kind: 'skill',
        name: 'my-skill',
        nameLine: 3,
      });
    });

    test('handles single-quoted name values', () => {
      const content = [
        '---',
        "kind: rule",
        "version: '1.0'",
        "name: 'secure-coding'",
        '---',
      ].join('\n');

      const result = parseFrontmatter(content);
      assert.deepStrictEqual(result, {
        kind: 'rule',
        name: 'secure-coding',
        nameLine: 3,
      });
    });

    test('handles pure YAML format without frontmatter delimiters for project kind', () => {
      const content = [
        'kind: project',
        'version: "1.0"',
        'name: my-project',
      ].join('\n');

      const result = parseFrontmatter(content);
      assert.deepStrictEqual(result, {
        kind: 'project',
        name: 'my-project',
        nameLine: 2,
      });
    });
  });

  suite('XcafIndex', () => {
    test('resolve returns undefined for unknown entry', () => {
      const index = new XcafIndex();
      const entry = index.resolve('agent', 'nonexistent');
      assert.strictEqual(entry, undefined);
    });

    test('setEntry and resolve round-trip', () => {
      const index = new XcafIndex();
      const entry: XcafEntry = {
        kind: 'agent',
        name: 'reviewer',
        fileUri: '/workspace/xcaf/agents/reviewer.xcaf',
        nameLine: 3,
      };
      index.setEntry(entry);

      const result = index.resolve('agent', 'reviewer');
      assert.deepStrictEqual(result, entry);
    });

    test('removeByUri removes all entries for a file', () => {
      const index = new XcafIndex();
      index.setEntry({
        kind: 'agent',
        name: 'reviewer',
        fileUri: '/workspace/xcaf/agents/reviewer.xcaf',
        nameLine: 3,
      });
      index.removeByUri('/workspace/xcaf/agents/reviewer.xcaf');

      const result = index.resolve('agent', 'reviewer');
      assert.strictEqual(result, undefined);
    });

    test('resolveByName returns first match across kinds', () => {
      const index = new XcafIndex();
      index.setEntry({
        kind: 'skill',
        name: 'tdd',
        fileUri: '/workspace/xcaf/skills/tdd.xcaf',
        nameLine: 3,
      });

      const result = index.resolveByName('tdd');
      assert.ok(result);
      assert.strictEqual(result!.kind, 'skill');
    });

    test('clear removes all entries', () => {
      const index = new XcafIndex();
      index.setEntry({
        kind: 'agent',
        name: 'reviewer',
        fileUri: '/workspace/xcaf/agents/reviewer.xcaf',
        nameLine: 3,
      });
      index.clear();

      const result = index.resolve('agent', 'reviewer');
      assert.strictEqual(result, undefined);
    });
  });

  suite('XcafIndex with model', () => {
    function makeModel(): XcafProjectModel {
      const groups: XcafKindGroup[] = [
        {
          kind: 'agent',
          displayName: 'AGENTS',
          resources: [
            {
              name: 'auth-specialist',
              kind: 'agent',
              baseManifest: '/workspace/xcaf/agents/auth-specialist/agent.xcaf',
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
              name: 'brainstorming',
              kind: 'skill',
              baseManifest: '/workspace/xcaf/skills/brainstorming/skill.xcaf',
              overrides: [],
              artifactDirs: [],
            },
          ],
        },
      ];
      return new XcafProjectModel(groups);
    }

    test('resolve delegates to model after setModel', () => {
      const index = new XcafIndex();
      index.setModel(makeModel());

      const result = index.resolve('agent', 'auth-specialist');
      assert.ok(result);
      assert.strictEqual(result!.kind, 'agent');
      assert.strictEqual(result!.name, 'auth-specialist');
      assert.strictEqual(result!.fileUri, '/workspace/xcaf/agents/auth-specialist/agent.xcaf');
    });

    test('resolveByName delegates to model after setModel', () => {
      const index = new XcafIndex();
      index.setModel(makeModel());

      const result = index.resolveByName('brainstorming');
      assert.ok(result);
      assert.strictEqual(result!.kind, 'skill');
      assert.strictEqual(result!.name, 'brainstorming');
    });

    test('allEntries delegates to model after setModel', () => {
      const index = new XcafIndex();
      index.setModel(makeModel());

      const entries = index.allEntries();
      assert.strictEqual(entries.length, 2);
      const names = entries.map(e => e.name).sort();
      assert.deepStrictEqual(names, ['auth-specialist', 'brainstorming']);
    });

    test('setEntry is a no-op in model mode', () => {
      const index = new XcafIndex();
      index.setModel(makeModel());

      // Try to add an entry — it should not appear in allEntries
      index.setEntry({
        kind: 'rule',
        name: 'new-rule',
        fileUri: '/workspace/xcaf/rules/new-rule/rule.xcaf',
        nameLine: 1,
      });

      const entries = index.allEntries();
      assert.strictEqual(entries.length, 2, 'setEntry should be no-op in model mode');
      const found = entries.find(e => e.name === 'new-rule');
      assert.strictEqual(found, undefined);
    });

    test('removeByUri is a no-op in model mode', () => {
      const index = new XcafIndex();
      index.setModel(makeModel());

      index.removeByUri('/workspace/xcaf/agents/auth-specialist/agent.xcaf');

      // Model entries should still be there
      const result = index.resolve('agent', 'auth-specialist');
      assert.ok(result, 'removeByUri should be no-op in model mode');
    });

    test('clear is a no-op in model mode', () => {
      const index = new XcafIndex();
      index.setModel(makeModel());

      index.clear();

      const entries = index.allEntries();
      assert.strictEqual(entries.length, 2, 'clear should be no-op in model mode');
    });
  });
});
