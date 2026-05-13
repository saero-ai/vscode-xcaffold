import * as assert from 'assert';
import {
  buildResourcePath,
  buildVariantChoices,
  validateName,
} from '../newResourceProvider';

suite('newResourceProvider', () => {
  suite('buildResourcePath', () => {
    test('returns canonical xcaf directory layout', () => {
      const result = buildResourcePath('/workspace', 'agent', 'my-agent');
      assert.strictEqual(
        result,
        '/workspace/xcaf/agent/my-agent/my-agent.xcaf',
      );
    });

    test('handles nested workspace root', () => {
      const result = buildResourcePath(
        '/home/user/project',
        'skill',
        'code-review',
      );
      assert.strictEqual(
        result,
        '/home/user/project/xcaf/skill/code-review/code-review.xcaf',
      );
    });

    test('handles single-character name', () => {
      const result = buildResourcePath('/ws', 'rule', 'a');
      assert.strictEqual(result, '/ws/xcaf/rule/a/a.xcaf');
    });

    test('handles all primary kinds', () => {
      const kinds = ['agent', 'skill', 'rule', 'workflow'];
      for (const kind of kinds) {
        const result = buildResourcePath('/ws', kind, 'test');
        assert.ok(
          result.includes(`/xcaf/${kind}/test/test.xcaf`),
          `path for ${kind} should follow layout`,
        );
      }
    });
  });

  suite('buildVariantChoices', () => {
    test('agent has Minimal, Full, and From Existing', () => {
      const choices = buildVariantChoices('agent');
      const labels = choices.map((c) => c.label);
      assert.deepStrictEqual(labels, ['Minimal', 'Full', 'From Existing']);
    });

    test('skill has Minimal, Full, and From Existing', () => {
      const choices = buildVariantChoices('skill');
      const labels = choices.map((c) => c.label);
      assert.deepStrictEqual(labels, ['Minimal', 'Full', 'From Existing']);
    });

    test('rule has Minimal, Full, and From Existing', () => {
      const choices = buildVariantChoices('rule');
      const labels = choices.map((c) => c.label);
      assert.deepStrictEqual(labels, ['Minimal', 'Full', 'From Existing']);
    });

    test('workflow has Minimal, Full, and From Existing', () => {
      const choices = buildVariantChoices('workflow');
      const labels = choices.map((c) => c.label);
      assert.deepStrictEqual(labels, ['Minimal', 'Full', 'From Existing']);
    });

    test('mcp has only Minimal and From Existing', () => {
      const choices = buildVariantChoices('mcp');
      const labels = choices.map((c) => c.label);
      assert.deepStrictEqual(labels, ['Minimal', 'From Existing']);
    });

    test('hooks has only Minimal and From Existing', () => {
      const choices = buildVariantChoices('hooks');
      const labels = choices.map((c) => c.label);
      assert.deepStrictEqual(labels, ['Minimal', 'From Existing']);
    });

    test('variant values are correct for full-capable kind', () => {
      const choices = buildVariantChoices('agent');
      assert.strictEqual(choices[0].variant, 'minimal');
      assert.strictEqual(choices[1].variant, 'full');
      assert.strictEqual(choices[2].variant, 'existing');
    });

    test('variant values are correct for minimal-only kind', () => {
      const choices = buildVariantChoices('mcp');
      assert.strictEqual(choices[0].variant, 'minimal');
      assert.strictEqual(choices[1].variant, 'existing');
    });

    test('unknown kind returns only From Existing', () => {
      const choices = buildVariantChoices('nonexistent');
      assert.strictEqual(choices.length, 1);
      assert.strictEqual(choices[0].label, 'From Existing');
    });
  });

  suite('validateName', () => {
    test('returns undefined for valid lowercase name', () => {
      assert.strictEqual(validateName('my-agent'), undefined);
    });

    test('returns undefined for single character', () => {
      assert.strictEqual(validateName('a'), undefined);
    });

    test('returns undefined for name with digits', () => {
      assert.strictEqual(validateName('agent-v2'), undefined);
    });

    test('returns error string for empty name', () => {
      const result = validateName('');
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    test('returns error string for leading hyphen', () => {
      const result = validateName('-bad');
      assert.ok(typeof result === 'string');
      assert.ok(result.includes('hyphen'));
    });

    test('returns error string for trailing hyphen', () => {
      const result = validateName('bad-');
      assert.ok(typeof result === 'string');
      assert.ok(result.includes('hyphen'));
    });

    test('returns error string for uppercase letters', () => {
      const result = validateName('MyAgent');
      assert.ok(typeof result === 'string');
    });

    test('returns error string for spaces', () => {
      const result = validateName('my agent');
      assert.ok(typeof result === 'string');
    });

    test('returns error string for underscores', () => {
      const result = validateName('my_agent');
      assert.ok(typeof result === 'string');
    });

    test('returns error string for dots', () => {
      const result = validateName('my.agent');
      assert.ok(typeof result === 'string');
    });
  });
});
