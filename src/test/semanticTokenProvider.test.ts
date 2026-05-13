import * as assert from 'assert';
import {
  computeSemanticTokens,
  SemanticToken,
  XCAF_TOKEN_TYPES,
} from '../semanticTokenProvider';

/** Helper: look up token-type index by name. */
function typeIndex(name: typeof XCAF_TOKEN_TYPES[number]): number {
  return XCAF_TOKEN_TYPES.indexOf(name);
}

suite('SemanticTokenProvider', () => {
  suite('computeSemanticTokens', () => {
    // ── Schema field maps used across tests ──────────────────────

    const agentFields = new Map<string, { required: boolean }>([
      ['kind', { required: true }],
      ['version', { required: true }],
      ['name', { required: true }],
      ['description', { required: false }],
      ['tools', { required: false }],
      ['model', { required: false }],
    ]);

    const noopResolve = (): boolean => false;

    // ── 1. Kind token ────────────────────────────────────────────

    test('emits xcafKind token on "agent" value', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        '---',
      ].join('\n');

      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      const kindTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafKind'),
      );
      assert.strictEqual(kindTokens.length, 1);
      assert.strictEqual(kindTokens[0].line, 1);
      assert.strictEqual(kindTokens[0].startChar, 6); // "kind: " = 6 chars
      assert.strictEqual(kindTokens[0].length, 5); // "agent"
    });

    test('emits xcafKind for all known kinds', () => {
      const kinds = ['skill', 'rule', 'workflow', 'mcp', 'project'];
      for (const k of kinds) {
        const text = `---\nkind: ${k}\nname: test\n---`;
        const tokens = computeSemanticTokens(text, new Map(), noopResolve);
        const kindTokens = tokens.filter(
          (t) => t.tokenType === typeIndex('xcafKind'),
        );
        assert.strictEqual(
          kindTokens.length,
          1,
          `Expected xcafKind token for kind "${k}"`,
        );
      }
    });

    test('does not emit xcafKind for unknown kind value', () => {
      const text = '---\nkind: banana\nname: test\n---';
      const tokens = computeSemanticTokens(text, new Map(), noopResolve);
      const kindTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafKind'),
      );
      assert.strictEqual(kindTokens.length, 0);
    });

    // ── 2. Required field token ──────────────────────────────────

    test('emits xcafFieldRequired on required field name', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        '---',
      ].join('\n');

      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      const reqTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafFieldRequired'),
      );
      // "name" is required (and "version" is missing, so only "name")
      assert.ok(reqTokens.length >= 1, 'At least one required field token');
      const nameToken = reqTokens.find((t) => t.line === 2);
      assert.ok(nameToken, 'Required token on name line');
      assert.strictEqual(nameToken.startChar, 0);
      assert.strictEqual(nameToken.length, 4); // "name"
    });

    // ── 3. Optional field token ──────────────────────────────────

    test('emits xcafFieldOptional on optional field name', () => {
      const text = [
        '---',
        'kind: agent',
        'model: sonnet',
        '---',
      ].join('\n');

      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      const optTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafFieldOptional'),
      );
      assert.strictEqual(optTokens.length, 1);
      assert.strictEqual(optTokens[0].line, 2);
      assert.strictEqual(optTokens[0].startChar, 0);
      assert.strictEqual(optTokens[0].length, 5); // "model"
    });

    // ── 4. Resource reference token ──────────────────────────────

    test('emits xcafResourceRef when value resolves to a resource', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        'model: my-model',
        '---',
      ].join('\n');

      const resolveRef = (name: string): boolean => name === 'my-model';
      const tokens = computeSemanticTokens(text, agentFields, resolveRef);

      const refTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafResourceRef'),
      );
      assert.strictEqual(refTokens.length, 1);
      assert.strictEqual(refTokens[0].line, 3);
      assert.strictEqual(refTokens[0].length, 8); // "my-model"
    });

    test('does not emit xcafResourceRef when value does not resolve', () => {
      const text = [
        '---',
        'kind: agent',
        'model: unknown-thing',
        '---',
      ].join('\n');

      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      const refTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafResourceRef'),
      );
      assert.strictEqual(refTokens.length, 0);
    });

    // ── 5. Body content produces no tokens ───────────────────────

    test('does not emit tokens for body content', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        '---',
        'This is body content.',
        'name: should-not-match',
        'kind: also-not-matched',
      ].join('\n');

      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      // All tokens must be within lines 1-2 (frontmatter)
      for (const token of tokens) {
        assert.ok(
          token.line >= 1 && token.line <= 2,
          `Token at line ${token.line} is outside frontmatter`,
        );
      }
    });

    // ── 6. Empty input ───────────────────────────────────────────

    test('returns empty array for empty input', () => {
      const tokens = computeSemanticTokens('', new Map(), noopResolve);
      assert.strictEqual(tokens.length, 0);
    });

    test('returns empty array for text without frontmatter', () => {
      const text = 'Just some text\nwithout frontmatter';
      const tokens = computeSemanticTokens(text, new Map(), noopResolve);
      assert.strictEqual(tokens.length, 0);
    });

    test('returns empty array for unclosed frontmatter', () => {
      const text = '---\nkind: agent\nname: test';
      const tokens = computeSemanticTokens(text, new Map(), noopResolve);
      assert.strictEqual(tokens.length, 0);
    });

    // ── 7. Line numbers and character offsets ────────────────────

    test('token offsets are correct for indented fields', () => {
      const text = [
        '---',
        'kind: agent',
        '  name: reviewer',
        '---',
      ].join('\n');

      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      const nameToken = tokens.find(
        (t) =>
          t.line === 2 &&
          t.tokenType === typeIndex('xcafFieldRequired'),
      );
      assert.ok(nameToken, 'Should find required token on indented name');
      assert.strictEqual(nameToken.startChar, 2); // 2 spaces indent
      assert.strictEqual(nameToken.length, 4); // "name"
    });

    test('kind value token has correct offset with quoted value', () => {
      const text = '---\nkind: "agent"\nname: test\n---';
      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      const kindTokens = tokens.filter(
        (t) => t.tokenType === typeIndex('xcafKind'),
      );
      assert.strictEqual(kindTokens.length, 1);
      // The token covers the quoted value including quotes
      assert.strictEqual(kindTokens[0].line, 1);
      assert.strictEqual(kindTokens[0].startChar, 6); // after "kind: "
      assert.strictEqual(kindTokens[0].length, 7); // '"agent"'
    });

    // ── 8. Both field and ref tokens on same line ────────────────

    test('emits both field and ref token on the same line', () => {
      const text = [
        '---',
        'kind: agent',
        'model: my-agent',
        '---',
      ].join('\n');

      const resolveRef = (name: string): boolean => name === 'my-agent';
      const tokens = computeSemanticTokens(text, agentFields, resolveRef);

      const line2Tokens = tokens.filter((t) => t.line === 2);
      const types = line2Tokens.map((t) => t.tokenType);
      assert.ok(
        types.includes(typeIndex('xcafFieldOptional')),
        'Should have optional field token on line 2',
      );
      assert.ok(
        types.includes(typeIndex('xcafResourceRef')),
        'Should have resource ref token on line 2',
      );
    });

    // ── 9. No schema means no field tokens ───────────────────────

    test('emits no field tokens when schema is empty', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        'model: sonnet',
        '---',
      ].join('\n');

      const tokens = computeSemanticTokens(text, new Map(), noopResolve);

      const fieldTokens = tokens.filter(
        (t) =>
          t.tokenType === typeIndex('xcafFieldRequired') ||
          t.tokenType === typeIndex('xcafFieldOptional'),
      );
      assert.strictEqual(fieldTokens.length, 0);
    });

    // ── 10. "kind" key is not emitted as a field token ───────────

    test('does not emit field token on the "kind" key itself', () => {
      const text = '---\nkind: agent\nname: test\n---';
      const tokens = computeSemanticTokens(text, agentFields, noopResolve);

      // No field token should be on line 1 (the kind line)
      const line1FieldTokens = tokens.filter(
        (t) =>
          t.line === 1 &&
          (t.tokenType === typeIndex('xcafFieldRequired') ||
            t.tokenType === typeIndex('xcafFieldOptional')),
      );
      assert.strictEqual(
        line1FieldTokens.length,
        0,
        'kind key should not get a field token',
      );
    });
  });
});
