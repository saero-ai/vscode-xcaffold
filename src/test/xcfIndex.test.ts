import * as assert from 'assert';
import { XcfIndex, XcfEntry, parseFrontmatter } from '../xcfIndex';

suite('XcfIndex', () => {
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

  suite('XcfIndex', () => {
    test('resolve returns undefined for unknown entry', () => {
      const index = new XcfIndex();
      const entry = index.resolve('agent', 'nonexistent');
      assert.strictEqual(entry, undefined);
    });

    test('setEntry and resolve round-trip', () => {
      const index = new XcfIndex();
      const entry: XcfEntry = {
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
      const index = new XcfIndex();
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
      const index = new XcfIndex();
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
      const index = new XcfIndex();
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
});
