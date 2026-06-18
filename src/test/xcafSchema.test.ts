import * as assert from 'assert';
import {
  parseSchemaOutput,
  XcafSchemaCache,
  KNOWN_KINDS,
  FALLBACK_SCHEMAS,
  SchemaField,
} from '../xcafSchema';

suite('xcafSchema', () => {
  suite('parseSchemaOutput', () => {
    test('parses JSON format with fields array', () => {
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
            name: 'tools',
            type: '[]string',
            required: false,
            group: 'behavior',
            description: 'Allowed tools',
          },
        ],
      });

      const fields = parseSchemaOutput(stdout);
      assert.strictEqual(fields.length, 2);
      assert.strictEqual(fields[0].name, 'name');
      assert.strictEqual(fields[0].required, true);
      assert.strictEqual(fields[0].group, 'identity');
      assert.strictEqual(fields[1].type, '[]string');
    });

    test('parses text format with Fields: header', () => {
      const stdout = [
        'Kind: agent',
        '',
        'Fields:',
        '  name          string    required  identity   Agent name',
        '  model         string    optional  behavior   LLM model',
      ].join('\n');

      const fields = parseSchemaOutput(stdout);
      assert.strictEqual(fields.length, 2);
      assert.strictEqual(fields[0].name, 'name');
      assert.strictEqual(fields[0].type, 'string');
      assert.strictEqual(fields[0].required, true);
      assert.strictEqual(fields[1].required, false);
      assert.strictEqual(fields[1].group, 'behavior');
    });

    test('returns empty array for empty input', () => {
      assert.deepStrictEqual(parseSchemaOutput(''), []);
    });

    test('returns empty array for whitespace-only input', () => {
      assert.deepStrictEqual(parseSchemaOutput('   \n  \n  '), []);
    });

    test('returns empty array for invalid JSON without Fields header', () => {
      assert.deepStrictEqual(parseSchemaOutput('not json, not tabular'), []);
    });

    test('defaults missing fields in JSON to safe values', () => {
      const stdout = JSON.stringify({
        fields: [{ name: 'bare' }],
      });

      const fields = parseSchemaOutput(stdout);
      assert.strictEqual(fields.length, 1);
      assert.strictEqual(fields[0].type, 'string');
      assert.strictEqual(fields[0].required, false);
      assert.strictEqual(fields[0].group, '');
      assert.strictEqual(fields[0].description, '');
    });
  });

  suite('XcafSchemaCache', () => {
    function makeCliRunner(responses: Map<string, string>) {
      return async (args: string[], _cwd: string) => {
        const kind = args[2]; // ['help', '--xcaf', <kind>, ...]
        const stdout = responses.get(kind);
        if (stdout === undefined) {
          throw new Error(`CLI failed for kind: ${kind}`);
        }
        return { stdout };
      };
    }

    test('getSchema returns cached data after loadAll', async () => {
      const responses = new Map<string, string>();
      responses.set('agent', JSON.stringify({
        fields: [
          { name: 'name', type: 'string', required: true, group: 'identity', description: 'Agent name' },
        ],
      }));

      const cache = new XcafSchemaCache(makeCliRunner(responses));
      await cache.loadAll('/workspace');

      const schema = cache.getSchema('agent');
      assert.ok(schema);
      assert.strictEqual(schema.kind, 'agent');
      assert.strictEqual(schema.fields.length, 1);
      assert.strictEqual(schema.fields[0].name, 'name');
    });

    test('getSchema returns fallback when CLI fails', async () => {
      // All CLI calls throw
      const failRunner = async () => {
        throw new Error('CLI not found');
      };

      const cache = new XcafSchemaCache(failRunner);
      await cache.loadAll('/workspace');

      const schema = cache.getSchema('agent');
      assert.ok(schema, 'agent should have fallback');
      assert.ok(schema.fields.length > 0, 'fallback should have fields');

      const fallback = FALLBACK_SCHEMAS.get('agent')!;
      assert.deepStrictEqual(schema.fields, fallback);
    });

    test('getSchema returns fallback fields for all known kinds when CLI fails', async () => {
      const failRunner = async () => {
        throw new Error('CLI not found');
      };

      const cache = new XcafSchemaCache(failRunner);
      await cache.loadAll('/workspace');

      for (const kind of KNOWN_KINDS) {
        const schema = cache.getSchema(kind);
        assert.ok(schema, `${kind} should be cached`);
        assert.ok(schema.fields.length > 0, `${kind} should have fallback fields`);
      }
    });

    test('getSchema returns undefined for unknown kind', async () => {
      const cache = new XcafSchemaCache(async () => ({ stdout: '' }));
      await cache.loadAll('/workspace');

      assert.strictEqual(cache.getSchema('nonexistent'), undefined);
    });

    test('getField finds a field by name', async () => {
      const responses = new Map<string, string>();
      responses.set('skill', JSON.stringify({
        fields: [
          { name: 'name', type: 'string', required: true, group: 'identity', description: 'Skill name' },
          { name: 'allowed-tools', type: '[]string', required: false, group: 'behavior', description: 'Tools' },
        ],
      }));

      const cache = new XcafSchemaCache(makeCliRunner(responses));
      await cache.loadAll('/workspace');

      const field = cache.getField('skill', 'allowed-tools');
      assert.ok(field);
      assert.strictEqual(field.name, 'allowed-tools');
      assert.strictEqual(field.type, '[]string');
    });

    test('getField returns undefined for missing field', async () => {
      const cache = new XcafSchemaCache(async () => ({ stdout: '' }));
      await cache.loadAll('/workspace');

      assert.strictEqual(cache.getField('agent', 'nonexistent'), undefined);
    });

    test('getField returns undefined for unknown kind', async () => {
      const cache = new XcafSchemaCache(async () => ({ stdout: '' }));
      await cache.loadAll('/workspace');

      assert.strictEqual(cache.getField('unknown', 'name'), undefined);
    });

    test('getAllKinds returns the known kinds list', () => {
      const cache = new XcafSchemaCache(async () => ({ stdout: '' }));
      const kinds = cache.getAllKinds();
      assert.deepStrictEqual(kinds, [...KNOWN_KINDS]);
    });

    test('loadAll never throws even when all CLI calls fail', async () => {
      const failRunner = async () => {
        throw new Error('total failure');
      };

      const cache = new XcafSchemaCache(failRunner);
      // Should not throw
      await cache.loadAll('/workspace');

      // Every known kind should have an entry (some with empty fields)
      for (const kind of KNOWN_KINDS) {
        assert.ok(cache.getSchema(kind), `${kind} should be cached`);
      }
    });
  });

  suite('KNOWN_KINDS and FALLBACK_SCHEMAS completeness', () => {
    test('KNOWN_KINDS includes context', () => {
      assert.ok(KNOWN_KINDS.includes('context'));
    });

    test('KNOWN_KINDS includes memory', () => {
      assert.ok(KNOWN_KINDS.includes('memory'));
    });

    test('KNOWN_KINDS includes template', () => {
      assert.ok(KNOWN_KINDS.includes('template'));
    });

    test('KNOWN_KINDS has 14 entries', () => {
      assert.strictEqual(KNOWN_KINDS.length, 14);
    });

    test('FALLBACK_SCHEMAS has context', () => {
      assert.ok(FALLBACK_SCHEMAS.has('context'));
      assert.ok(FALLBACK_SCHEMAS.get('context')!.length > 0);
    });

    test('FALLBACK_SCHEMAS has memory', () => {
      assert.ok(FALLBACK_SCHEMAS.has('memory'));
      assert.ok(FALLBACK_SCHEMAS.get('memory')!.length > 0);
    });

    test('FALLBACK_SCHEMAS has template', () => {
      assert.ok(FALLBACK_SCHEMAS.has('template'));
      assert.ok(FALLBACK_SCHEMAS.get('template')!.length > 0);
    });

    test('skill schema has paths field', () => {
      const skillSchema = FALLBACK_SCHEMAS.get('skill')!;
      const pathsField = skillSchema.find((f) => f.name === 'paths');
      assert.ok(pathsField, 'skill schema should have paths field');
      assert.strictEqual(pathsField?.type, '[]string');
    });

    test('skill schema has metadata field', () => {
      const skillSchema = FALLBACK_SCHEMAS.get('skill')!;
      const metadataField = skillSchema.find((f) => f.name === 'metadata');
      assert.ok(metadataField, 'skill schema should have metadata field');
      assert.strictEqual(metadataField?.type, 'map');
    });

    test('skill schema has disable-model-invocation field', () => {
      const skillSchema = FALLBACK_SCHEMAS.get('skill')!;
      const disableField = skillSchema.find((f) => f.name === 'disable-model-invocation');
      assert.ok(disableField, 'skill schema should have disable-model-invocation field');
      assert.strictEqual(disableField?.type, 'bool');
    });
  });
});
