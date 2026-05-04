import * as assert from 'assert';
import {
  extractWordAt,
  detectReferenceContext,
  resolveDefinition,
  ReferenceContext,
} from '../definitionProvider';
import { XcfIndex } from '../xcfIndex';

suite('DefinitionProvider', () => {
  suite('extractWordAt', () => {
    test('extracts unquoted word under cursor', () => {
      const line = 'skills: [tdd, code-review]';
      const result = extractWordAt(line, 10);
      assert.strictEqual(result, 'tdd');
    });

    test('extracts hyphenated word', () => {
      const line = 'skills: [tdd, code-review]';
      const result = extractWordAt(line, 18);
      assert.strictEqual(result, 'code-review');
    });

    test('extracts double-quoted word', () => {
      const line = 'skills: ["my-skill", other]';
      const result = extractWordAt(line, 12);
      assert.strictEqual(result, 'my-skill');
    });

    test('extracts single-quoted word', () => {
      const line = "rules: ['secure-coding']";
      const result = extractWordAt(line, 12);
      assert.strictEqual(result, 'secure-coding');
    });

    test('returns empty string for whitespace position', () => {
      const line = 'skills: [tdd, code-review]';
      const result = extractWordAt(line, 13);
      assert.strictEqual(result, '');
    });

    test('returns empty string for bracket position', () => {
      const line = 'skills: [tdd]';
      const result = extractWordAt(line, 8);
      assert.strictEqual(result, '');
    });
  });

  suite('detectReferenceContext', () => {
    test('detects skills: array context', () => {
      const lines = [
        '---',
        'kind: agent',
        'name: reviewer',
        'skills: [tdd, code-review]',
        '---',
      ];
      const result = detectReferenceContext(lines, 3);
      assert.deepStrictEqual(result, { refKind: 'skill' });
    });

    test('detects rules: array context', () => {
      const lines = [
        '---',
        'kind: project',
        'name: my-project',
        'rules: [secure-coding, naming]',
        '---',
      ];
      const result = detectReferenceContext(lines, 3);
      assert.deepStrictEqual(result, { refKind: 'rule' });
    });

    test('detects agents: array context', () => {
      const lines = [
        '---',
        'kind: project',
        'name: my-project',
        'agents: [reviewer, developer]',
        '---',
      ];
      const result = detectReferenceContext(lines, 3);
      assert.deepStrictEqual(result, { refKind: 'agent' });
    });

    test('returns null for non-reference line', () => {
      const lines = [
        '---',
        'kind: agent',
        'name: reviewer',
        'description: "A code reviewer"',
        '---',
      ];
      const result = detectReferenceContext(lines, 3);
      assert.strictEqual(result, null);
    });

    test('detects multi-line YAML array (dash syntax)', () => {
      const lines = [
        '---',
        'skills:',
        '  - tdd',
        '  - code-review',
        '---',
      ];
      const result = detectReferenceContext(lines, 2);
      assert.deepStrictEqual(result, { refKind: 'skill' });
    });

    test('detects multi-line YAML array on continuation line', () => {
      const lines = [
        '---',
        'skills:',
        '  - tdd',
        '  - code-review',
        '---',
      ];
      const result = detectReferenceContext(lines, 3);
      assert.deepStrictEqual(result, { refKind: 'skill' });
    });
  });

  suite('resolveDefinition', () => {
    test('resolves skill reference via xcfIndex', () => {
      const index = new XcfIndex();
      index.setEntry({
        kind: 'SKILLS',
        name: 'tdd',
        fileUri: '/workspace/xcf/skills/tdd.xcf',
        nameLine: 3,
      });

      const lines = [
        '---',
        'kind: agent',
        'name: reviewer',
        'skills: [tdd]',
        '---',
      ];
      const result = resolveDefinition(index, lines, 3, 10);
      assert.ok(result, 'should resolve to a location');
      assert.strictEqual(result!.uri, '/workspace/xcf/skills/tdd.xcf');
      assert.strictEqual(result!.line, 3);
    });

    test('resolves agent reference with uppercase index key', () => {
      const index = new XcfIndex();
      index.setEntry({
        kind: 'AGENTS',
        name: 'developer',
        fileUri: '/workspace/xcf/agents/developer.xcf',
        nameLine: 2,
      });

      const lines = [
        'kind: project',
        'agents: [developer]',
      ];
      const result = resolveDefinition(index, lines, 1, 10);
      assert.ok(result, 'should resolve to a location');
      assert.strictEqual(result!.uri, '/workspace/xcf/agents/developer.xcf');
    });

    test('falls back to resolveByName when kind-specific lookup misses', () => {
      const index = new XcfIndex();
      index.setEntry({
        kind: 'SKILLS',
        name: 'tdd',
        fileUri: '/workspace/xcf/skills/tdd.xcf',
        nameLine: 3,
      });

      // Cursor on a word that happens to be on a non-reference line
      // but we still attempt resolveByName as fallback
      const lines = [
        'kind: agent',
        'name: reviewer',
        'description: "uses tdd"',
      ];
      const result = resolveDefinition(index, lines, 2, 20);
      assert.ok(result, 'should resolve via fallback');
      assert.strictEqual(result!.uri, '/workspace/xcf/skills/tdd.xcf');
    });

    test('returns null when word not found in index', () => {
      const index = new XcfIndex();

      const lines = [
        'kind: agent',
        'skills: [nonexistent]',
      ];
      const result = resolveDefinition(index, lines, 1, 10);
      assert.strictEqual(result, null);
    });

    test('returns null when cursor is on empty position', () => {
      const index = new XcfIndex();

      const lines = ['skills: [tdd]'];
      const result = resolveDefinition(index, lines, 0, 7);
      assert.strictEqual(result, null);
    });
  });
});
