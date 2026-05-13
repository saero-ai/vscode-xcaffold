import * as assert from 'assert';
import { detectHoverTarget, formatFieldHover, HoverInfo } from '../hoverProvider';
import { SchemaField } from '../xcafSchema';

suite('HoverProvider', () => {
  suite('detectHoverTarget', () => {
    const frontmatterDoc = [
      '---',
      'kind: agent',
      'version: "1.0"',
      'name: reviewer',
      'description: A code reviewer',
      '---',
      'Body content here.',
    ].join('\n');

    test('extracts field name when hovering over YAML key', () => {
      const info = detectHoverTarget(frontmatterDoc, 2, 3);
      assert.strictEqual(info.inFrontmatter, true);
      assert.strictEqual(info.fieldName, 'version');
      assert.strictEqual(info.kindValue, null);
    });

    test('extracts field name for name key', () => {
      const info = detectHoverTarget(frontmatterDoc, 3, 1);
      assert.strictEqual(info.inFrontmatter, true);
      assert.strictEqual(info.fieldName, 'name');
      assert.strictEqual(info.kindValue, null);
    });

    test('extracts kind value when hovering after kind:', () => {
      const info = detectHoverTarget(frontmatterDoc, 1, 8);
      assert.strictEqual(info.inFrontmatter, true);
      assert.strictEqual(info.kindValue, 'agent');
      assert.strictEqual(info.fieldName, null);
    });

    test('extracts field name "kind" when hovering on the key itself', () => {
      const info = detectHoverTarget(frontmatterDoc, 1, 2);
      assert.strictEqual(info.inFrontmatter, true);
      assert.strictEqual(info.fieldName, 'kind');
      assert.strictEqual(info.kindValue, null);
    });

    test('returns inFrontmatter false when outside frontmatter', () => {
      const info = detectHoverTarget(frontmatterDoc, 6, 3);
      assert.strictEqual(info.inFrontmatter, false);
      assert.strictEqual(info.fieldName, null);
      assert.strictEqual(info.kindValue, null);
    });

    test('returns inFrontmatter false for delimiter line beyond end', () => {
      const doc = [
        '---',
        'kind: skill',
        '---',
        'Some body text.',
        'kind: fake',
      ].join('\n');
      const info = detectHoverTarget(doc, 4, 2);
      assert.strictEqual(info.inFrontmatter, false);
    });

    test('handles pure YAML format (project kind)', () => {
      const pureYaml = [
        'kind: project',
        'version: "1.0"',
        'name: my-project',
      ].join('\n');
      const info = detectHoverTarget(pureYaml, 1, 0);
      assert.strictEqual(info.inFrontmatter, true);
      assert.strictEqual(info.fieldName, 'version');
    });

    test('handles quoted kind value', () => {
      const doc = [
        '---',
        'kind: "skill"',
        'name: tdd',
        '---',
      ].join('\n');
      const info = detectHoverTarget(doc, 1, 8);
      assert.strictEqual(info.kindValue, 'skill');
    });

    test('returns null fieldName for line without colon', () => {
      const doc = [
        '---',
        'kind: agent',
        '  some orphan line',
        '---',
      ].join('\n');
      const info = detectHoverTarget(doc, 2, 5);
      assert.strictEqual(info.inFrontmatter, true);
      assert.strictEqual(info.fieldName, null);
      assert.strictEqual(info.kindValue, null);
    });

    test('returns empty result for out-of-range line', () => {
      const info = detectHoverTarget(frontmatterDoc, 99, 0);
      assert.strictEqual(info.inFrontmatter, false);
    });

    test('returns empty result for empty document', () => {
      const info = detectHoverTarget('', 0, 0);
      assert.strictEqual(info.inFrontmatter, false);
    });
  });

  suite('formatFieldHover', () => {
    test('formats a required field with group', () => {
      const field: SchemaField = {
        name: 'name',
        type: 'string',
        required: true,
        group: 'identity',
        description: 'The resource name',
      };
      const result = formatFieldHover(field);
      assert.ok(result.includes('**name**'));
      assert.ok(result.includes('`string`'));
      assert.ok(result.includes('`required`'));
      assert.ok(result.includes('The resource name'));
      assert.ok(result.includes('identity'));
    });

    test('formats an optional field without group', () => {
      const field: SchemaField = {
        name: 'model',
        type: 'string',
        required: false,
        group: '',
        description: 'LLM model to use',
      };
      const result = formatFieldHover(field);
      assert.ok(result.includes('**model**'));
      assert.ok(result.includes('`optional`'));
      assert.ok(result.includes('LLM model to use'));
      assert.ok(!result.includes('Group:'));
    });

    test('formats array type field', () => {
      const field: SchemaField = {
        name: 'tools',
        type: '[]string',
        required: false,
        group: 'behavior',
        description: 'Allowed tools',
      };
      const result = formatFieldHover(field);
      assert.ok(result.includes('`[]string`'));
      assert.ok(result.includes('behavior'));
    });
  });
});
