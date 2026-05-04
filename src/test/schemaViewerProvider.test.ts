import * as assert from 'assert';
import {
  parseSchemaOutput,
  SchemaField,
  groupFieldsByGroup,
} from '../schemaViewerProvider';

suite('SchemaViewerProvider', () => {
  suite('parseSchemaOutput', () => {
    test('parses JSON format schema', () => {
      const stdout = JSON.stringify({
        kind: 'agent',
        fields: [
          {
            name: 'name',
            type: 'string',
            required: true,
            group: 'identity',
            description: 'Agent name',
          },
          {
            name: 'model',
            type: 'string',
            required: false,
            group: 'behavior',
            description: 'LLM model to use',
          },
          {
            name: 'tools',
            type: '[]string',
            required: false,
            group: 'behavior',
            description: 'Allowed tools',
          },
        ],
      });

      const fields = parseSchemaOutput(stdout);
      assert.strictEqual(fields.length, 3);
      assert.strictEqual(fields[0].name, 'name');
      assert.strictEqual(fields[0].required, true);
      assert.strictEqual(fields[1].group, 'behavior');
    });

    test('parses text format schema', () => {
      const stdout = [
        'Kind: agent',
        '',
        'Fields:',
        '  name          string    required  identity   Agent name',
        '  model         string    optional  behavior   LLM model to use',
        '  tools         []string  optional  behavior   Allowed tools',
      ].join('\n');

      const fields = parseSchemaOutput(stdout);
      assert.strictEqual(fields.length, 3);
      assert.strictEqual(fields[0].name, 'name');
      assert.strictEqual(fields[0].type, 'string');
      assert.strictEqual(fields[0].required, true);
      assert.strictEqual(fields[1].required, false);
    });

    test('returns empty array for empty output', () => {
      const fields = parseSchemaOutput('');
      assert.strictEqual(fields.length, 0);
    });
  });

  suite('groupFieldsByGroup', () => {
    test('groups fields by group name', () => {
      const fields: SchemaField[] = [
        { name: 'name', type: 'string', required: true, group: 'identity', description: 'Name' },
        { name: 'description', type: 'string', required: false, group: 'identity', description: 'Desc' },
        { name: 'model', type: 'string', required: false, group: 'behavior', description: 'Model' },
      ];

      const grouped = groupFieldsByGroup(fields);
      assert.strictEqual(grouped.size, 2);
      assert.strictEqual(grouped.get('identity')!.length, 2);
      assert.strictEqual(grouped.get('behavior')!.length, 1);
    });

    test('handles fields without a group', () => {
      const fields: SchemaField[] = [
        { name: 'name', type: 'string', required: true, group: '', description: 'Name' },
      ];

      const grouped = groupFieldsByGroup(fields);
      assert.strictEqual(grouped.size, 1);
      assert.ok(grouped.has(''));
    });

    test('returns empty map for empty fields', () => {
      const grouped = groupFieldsByGroup([]);
      assert.strictEqual(grouped.size, 0);
    });
  });
});
