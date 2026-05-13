import * as assert from 'assert';
import { detectCompletionContext, CompletionContext } from '../completionProvider';

suite('CompletionProvider', () => {
  suite('detectCompletionContext', () => {
    const agentDoc = [
      '---',
      'kind: agent',
      'version: "1.0"',
      'name: reviewer',
      'tools: [Read, Edit]',
      'always-apply: true',
      '',
      '---',
      'Body content here.',
    ].join('\n');

    test('detects kind-value after "kind: "', () => {
      const doc = '---\nkind: \nname: test\n---';
      const ctx = detectCompletionContext(doc, 1, 6);
      assert.strictEqual(ctx.contextType, 'kind-value');
      assert.strictEqual(ctx.inFrontmatter, true);
    });

    test('detects kind-value with partial text', () => {
      const doc = '---\nkind: ag\nname: test\n---';
      const ctx = detectCompletionContext(doc, 1, 8);
      assert.strictEqual(ctx.contextType, 'kind-value');
    });

    test('detects version-value after "version: "', () => {
      const doc = '---\nkind: agent\nversion: \nname: test\n---';
      const ctx = detectCompletionContext(doc, 2, 9);
      assert.strictEqual(ctx.contextType, 'version-value');
      assert.strictEqual(ctx.inFrontmatter, true);
    });

    test('detects field-name on empty line in frontmatter', () => {
      const ctx = detectCompletionContext(agentDoc, 6, 0);
      assert.strictEqual(ctx.contextType, 'field-name');
      assert.strictEqual(ctx.inFrontmatter, true);
      assert.strictEqual(ctx.currentKind, 'agent');
    });

    test('detects field-name when typing a partial key', () => {
      const doc = '---\nkind: agent\ndes\n---';
      const ctx = detectCompletionContext(doc, 2, 3);
      assert.strictEqual(ctx.contextType, 'field-name');
      assert.strictEqual(ctx.currentKind, 'agent');
    });

    test('detects tool-value inside tools array', () => {
      const doc = '---\nkind: agent\ntools: [Read, \n---';
      const ctx = detectCompletionContext(doc, 2, 14);
      assert.strictEqual(ctx.contextType, 'tool-value');
      assert.strictEqual(ctx.inFrontmatter, true);
    });

    test('detects tool-value inside allowed-tools array', () => {
      const doc = '---\nkind: skill\nallowed-tools: [Read, \n---';
      const ctx = detectCompletionContext(doc, 2, 21);
      assert.strictEqual(ctx.contextType, 'tool-value');
    });

    test('returns inFrontmatter false outside frontmatter', () => {
      const ctx = detectCompletionContext(agentDoc, 8, 0);
      assert.strictEqual(ctx.inFrontmatter, false);
      assert.strictEqual(ctx.contextType, 'unknown');
    });

    test('returns inFrontmatter false before opening delimiter', () => {
      const ctx = detectCompletionContext(agentDoc, 0, 0);
      assert.strictEqual(ctx.inFrontmatter, false);
    });

    test('returns inFrontmatter false when no frontmatter exists', () => {
      const doc = 'Just some text\nwithout frontmatter';
      const ctx = detectCompletionContext(doc, 0, 5);
      assert.strictEqual(ctx.inFrontmatter, false);
    });

    test('extracts currentKind from frontmatter', () => {
      const doc = '---\nkind: skill\nname: tdd\n\n---';
      const ctx = detectCompletionContext(doc, 3, 0);
      assert.strictEqual(ctx.currentKind, 'skill');
    });

    test('currentKind is null when no kind line exists', () => {
      const doc = '---\nversion: "1.0"\nname: test\n\n---';
      const ctx = detectCompletionContext(doc, 3, 0);
      assert.strictEqual(ctx.currentKind, null);
    });

    test('linePrefix contains text before cursor', () => {
      const doc = '---\nkind: agent\ntools: [Read\n---';
      const ctx = detectCompletionContext(doc, 2, 8);
      assert.strictEqual(ctx.linePrefix, 'tools: [');
    });

    test('body line is not field-name context', () => {
      const doc = '---\nkind: agent\nname: test\n---\nSome body text';
      const ctx = detectCompletionContext(doc, 4, 5);
      assert.strictEqual(ctx.inFrontmatter, false);
      assert.notStrictEqual(ctx.contextType, 'field-name');
    });

    test('closing delimiter line is not in frontmatter', () => {
      const doc = '---\nkind: agent\nname: test\n---';
      const ctx = detectCompletionContext(doc, 3, 0);
      assert.strictEqual(ctx.inFrontmatter, false);
    });

    test('unknown context for value after non-boolean field', () => {
      const doc = '---\nkind: agent\nname: \n---';
      const ctx = detectCompletionContext(doc, 2, 6);
      // "name: " prefix — not kind, not version, not tools, not empty
      assert.strictEqual(ctx.contextType, 'unknown');
    });
  });
});
