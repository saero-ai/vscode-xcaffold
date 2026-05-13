import * as assert from 'assert';
import {
  renderTemplate,
  supportsVariant,
  supportedVariants,
  TemplateParams,
} from '../resourceTemplates';
import { KNOWN_KINDS, FALLBACK_SCHEMAS } from '../xcafSchema';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Extract the YAML frontmatter block (between the two --- delimiters). */
function extractFrontmatter(content: string): string {
  const lines = content.split('\n');
  const openIdx = lines.indexOf('---');
  if (openIdx === -1) return '';
  const closeIdx = lines.indexOf('---', openIdx + 1);
  if (closeIdx === -1) return '';
  return lines.slice(openIdx + 1, closeIdx).join('\n');
}

/** Extract the body section (everything after the closing ---). */
function extractBody(content: string): string {
  const lines = content.split('\n');
  const openIdx = lines.indexOf('---');
  if (openIdx === -1) return '';
  const closeIdx = lines.indexOf('---', openIdx + 1);
  if (closeIdx === -1) return '';
  return lines.slice(closeIdx + 1).join('\n');
}

/** Check whether frontmatter contains a given field line. */
function hasFrontmatterField(content: string, field: string): boolean {
  const fm = extractFrontmatter(content);
  return fm.split('\n').some((line) => line.startsWith(`${field}:`));
}

const DEFAULT_PARAMS: TemplateParams = { name: 'test-resource' };

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

suite('resourceTemplates', () => {
  suite('supportsVariant', () => {
    test('all known kinds support minimal', () => {
      for (const kind of KNOWN_KINDS) {
        assert.strictEqual(
          supportsVariant(kind, 'minimal'),
          true,
          `${kind} should support minimal`,
        );
      }
    });

    test('agent, skill, rule, workflow support full', () => {
      const fullKinds = ['agent', 'skill', 'rule', 'workflow'];
      for (const kind of fullKinds) {
        assert.strictEqual(
          supportsVariant(kind, 'full'),
          true,
          `${kind} should support full`,
        );
      }
    });

    test('minimal-only kinds do not support full', () => {
      const minimalOnly = [
        'mcp', 'project', 'settings', 'hooks',
        'global', 'policy', 'blueprint',
      ];
      for (const kind of minimalOnly) {
        assert.strictEqual(
          supportsVariant(kind, 'full'),
          false,
          `${kind} should not support full`,
        );
      }
    });

    test('unknown kind returns false for both variants', () => {
      assert.strictEqual(supportsVariant('unknown', 'minimal'), false);
      assert.strictEqual(supportsVariant('unknown', 'full'), false);
    });
  });

  suite('supportedVariants', () => {
    test('returns [minimal, full] for full-capable kinds', () => {
      assert.deepStrictEqual(supportedVariants('agent'), ['minimal', 'full']);
    });

    test('returns [minimal] for minimal-only kinds', () => {
      assert.deepStrictEqual(supportedVariants('mcp'), ['minimal']);
    });

    test('returns empty array for unknown kind', () => {
      assert.deepStrictEqual(supportedVariants('unknown'), []);
    });
  });

  suite('renderTemplate — structure', () => {
    test('output starts with --- delimiter', () => {
      const output = renderTemplate('agent', 'minimal', DEFAULT_PARAMS);
      assert.ok(output.startsWith('---\n'));
    });

    test('output has closing --- delimiter', () => {
      const output = renderTemplate('agent', 'minimal', DEFAULT_PARAMS);
      const lines = output.split('\n');
      const closeIdx = lines.indexOf('---', 1);
      assert.ok(closeIdx > 0, 'should have a closing --- delimiter');
    });

    test('output ends with a newline', () => {
      const output = renderTemplate('agent', 'minimal', DEFAULT_PARAMS);
      assert.ok(output.endsWith('\n'));
    });

    test('throws for unknown kind', () => {
      assert.throws(
        () => renderTemplate('unknown', 'minimal', DEFAULT_PARAMS),
        /Unknown kind: unknown/,
      );
    });

    test('throws for unsupported variant', () => {
      assert.throws(
        () => renderTemplate('mcp', 'full', DEFAULT_PARAMS),
        /does not support variant "full"/,
      );
    });
  });

  suite('renderTemplate — identity fields', () => {
    test('all minimal templates contain kind field', () => {
      for (const kind of KNOWN_KINDS) {
        const output = renderTemplate(kind, 'minimal', DEFAULT_PARAMS);
        assert.ok(
          hasFrontmatterField(output, 'kind'),
          `${kind} minimal should have kind field`,
        );
        const fm = extractFrontmatter(output);
        assert.ok(
          fm.includes(`kind: ${kind}`),
          `${kind} minimal should have kind: ${kind}`,
        );
      }
    });

    test('all minimal templates contain quoted version', () => {
      for (const kind of KNOWN_KINDS) {
        const output = renderTemplate(kind, 'minimal', DEFAULT_PARAMS);
        const fm = extractFrontmatter(output);
        assert.ok(
          fm.includes('version: "1.0"'),
          `${kind} minimal should have version: "1.0"`,
        );
      }
    });

    test('templates with name field contain provided name', () => {
      const params: TemplateParams = { name: 'my-custom-agent' };
      const output = renderTemplate('agent', 'minimal', params);
      const fm = extractFrontmatter(output);
      assert.ok(fm.includes('name: my-custom-agent'));
    });

    test('global kind does not include name or description', () => {
      const output = renderTemplate('global', 'minimal', DEFAULT_PARAMS);
      assert.strictEqual(hasFrontmatterField(output, 'name'), false);
      assert.strictEqual(hasFrontmatterField(output, 'description'), false);
    });

    test('description uses provided value when given', () => {
      const params: TemplateParams = {
        name: 'my-agent',
        description: 'My custom agent',
      };
      const output = renderTemplate('agent', 'minimal', params);
      const fm = extractFrontmatter(output);
      assert.ok(fm.includes('description: My custom agent'));
    });

    test('description uses default when not provided', () => {
      const output = renderTemplate('agent', 'minimal', { name: 'x' });
      const fm = extractFrontmatter(output);
      assert.ok(fm.includes('description: A brief description'));
    });
  });

  suite('renderTemplate — minimal vs full', () => {
    test('minimal templates do NOT contain behavior fields', () => {
      const behaviorKinds = ['agent', 'skill', 'rule', 'workflow'];
      for (const kind of behaviorKinds) {
        const output = renderTemplate(kind, 'minimal', DEFAULT_PARAMS);
        const fields = FALLBACK_SCHEMAS.get(kind) ?? [];
        const behaviorFields = fields.filter((f) => f.group === 'behavior');
        for (const bf of behaviorFields) {
          assert.strictEqual(
            hasFrontmatterField(output, bf.name),
            false,
            `${kind} minimal should NOT have ${bf.name}`,
          );
        }
      }
    });

    test('full templates contain all behavior fields', () => {
      const fullKinds = ['agent', 'skill', 'rule', 'workflow'];
      for (const kind of fullKinds) {
        const output = renderTemplate(kind, 'full', DEFAULT_PARAMS);
        const fields = FALLBACK_SCHEMAS.get(kind) ?? [];
        const behaviorFields = fields.filter((f) => f.group === 'behavior');
        for (const bf of behaviorFields) {
          assert.ok(
            hasFrontmatterField(output, bf.name),
            `${kind} full should have ${bf.name}`,
          );
        }
      }
    });

    test('agent full template has tools and model', () => {
      const output = renderTemplate('agent', 'full', DEFAULT_PARAMS);
      assert.ok(hasFrontmatterField(output, 'tools'));
      assert.ok(hasFrontmatterField(output, 'model'));
    });

    test('skill full template has allowed-tools and activation', () => {
      const output = renderTemplate('skill', 'full', DEFAULT_PARAMS);
      assert.ok(hasFrontmatterField(output, 'allowed-tools'));
      assert.ok(hasFrontmatterField(output, 'activation'));
    });

    test('rule full template has activation and always-apply', () => {
      const output = renderTemplate('rule', 'full', DEFAULT_PARAMS);
      assert.ok(hasFrontmatterField(output, 'activation'));
      assert.ok(hasFrontmatterField(output, 'always-apply'));
    });

    test('workflow full template has targets', () => {
      const output = renderTemplate('workflow', 'full', DEFAULT_PARAMS);
      assert.ok(hasFrontmatterField(output, 'targets'));
    });
  });

  suite('renderTemplate — body section', () => {
    test('agent body contains instruction placeholder', () => {
      const output = renderTemplate('agent', 'minimal', DEFAULT_PARAMS);
      const body = extractBody(output);
      assert.ok(body.includes('# Agent instructions go here'));
    });

    test('skill body contains instruction placeholder', () => {
      const output = renderTemplate('skill', 'minimal', DEFAULT_PARAMS);
      const body = extractBody(output);
      assert.ok(body.includes('# Skill instructions go here'));
    });

    test('rule body contains content placeholder', () => {
      const output = renderTemplate('rule', 'minimal', DEFAULT_PARAMS);
      const body = extractBody(output);
      assert.ok(body.includes('# Rule content goes here'));
    });

    test('workflow body contains steps placeholder', () => {
      const output = renderTemplate('workflow', 'minimal', DEFAULT_PARAMS);
      const body = extractBody(output);
      assert.ok(body.includes('# Workflow steps go here'));
    });
  });

  suite('renderTemplate — all kinds minimal coverage', () => {
    for (const kind of KNOWN_KINDS) {
      test(`${kind} minimal template renders without error`, () => {
        const output = renderTemplate(kind, 'minimal', DEFAULT_PARAMS);
        assert.ok(output.length > 0);
        assert.ok(output.startsWith('---\n'));
      });
    }
  });

  suite('renderTemplate — full variant field values', () => {
    test('agent full has specific tool list entries', () => {
      const output = renderTemplate('agent', 'full', DEFAULT_PARAMS);
      assert.ok(output.includes('  - Read'));
      assert.ok(output.includes('  - Write'));
      assert.ok(output.includes('  - Bash'));
    });

    test('agent full has model value', () => {
      const output = renderTemplate('agent', 'full', DEFAULT_PARAMS);
      assert.ok(output.includes('model: sonnet'));
    });

    test('rule full has always-apply as false', () => {
      const output = renderTemplate('rule', 'full', DEFAULT_PARAMS);
      assert.ok(output.includes('always-apply: false'));
    });

    test('workflow full has target entries', () => {
      const output = renderTemplate('workflow', 'full', DEFAULT_PARAMS);
      assert.ok(output.includes('  - claude'));
      assert.ok(output.includes('  - cursor'));
    });
  });
});
