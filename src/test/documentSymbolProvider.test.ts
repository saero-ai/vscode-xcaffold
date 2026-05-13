import './setup';
import * as assert from 'assert';
import { extractDocumentSymbols, DocumentSymbolInfo } from '../documentSymbolProvider';

suite('DocumentSymbolProvider', () => {
  suite('extractDocumentSymbols', () => {
    test('extracts resource, properties, and body sections from frontmatter+body file', () => {
      const text = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: my-agent',
        'description: "Does stuff"',
        'tools: [Read, Write]',
        '---',
        '# Agent Title',
        '',
        '## Role',
        'Content here...',
        '',
        '## Scope',
        'Content here...',
      ].join('\n');

      const result = extractDocumentSymbols(text);

      assert.strictEqual(result.length, 1);

      const resource = result[0];
      assert.strictEqual(resource.name, 'my-agent');
      assert.strictEqual(resource.detail, 'agent');
      assert.strictEqual(resource.kind, 'resource');
      assert.strictEqual(resource.range.startLine, 0);
      assert.strictEqual(resource.range.endLine, 13);

      const children = resource.children!;
      assert.ok(children.length > 0, 'resource must have children');

      // Properties: kind, version, name, description, tools — with values as detail
      const properties = children.filter((c) => c.kind === 'property');
      assert.strictEqual(properties.length, 5);
      assert.strictEqual(properties[0].name, 'kind');
      assert.strictEqual(properties[0].detail, 'agent');
      assert.strictEqual(properties[1].name, 'version');
      assert.strictEqual(properties[1].detail, '1.0');
      assert.strictEqual(properties[2].name, 'name');
      assert.strictEqual(properties[2].detail, 'my-agent');
      assert.strictEqual(properties[3].name, 'description');
      assert.strictEqual(properties[3].detail, 'Does stuff');
      assert.strictEqual(properties[4].name, 'tools');
      assert.strictEqual(properties[4].detail, '[Read, Write]');

      // Body sections: Role, Scope
      const sections = children.filter((c) => c.kind === 'section');
      assert.strictEqual(sections.length, 2);
      assert.strictEqual(sections[0].name, 'Role');
      assert.strictEqual(sections[1].name, 'Scope');
    });

    test('extracts resource and properties from pure YAML file (no --- delimiters)', () => {
      const text = [
        'kind: project',
        'version: "1.0"',
        'name: my-project',
        'agents: [reviewer]',
      ].join('\n');

      const result = extractDocumentSymbols(text);

      assert.strictEqual(result.length, 1);

      const resource = result[0];
      assert.strictEqual(resource.name, 'my-project');
      assert.strictEqual(resource.detail, 'project');
      assert.strictEqual(resource.kind, 'resource');

      const properties = resource.children!.filter((c) => c.kind === 'property');
      assert.strictEqual(properties.length, 4);
      assert.strictEqual(properties[0].name, 'kind');
      assert.strictEqual(properties[0].detail, 'project');
      assert.strictEqual(properties[1].detail, '1.0');
      assert.strictEqual(properties[2].detail, 'my-project');
      assert.strictEqual(properties[3].name, 'agents');
      assert.strictEqual(properties[3].detail, '[reviewer]');

      // No body sections in pure YAML
      const sections = resource.children!.filter((c) => c.kind === 'section');
      assert.strictEqual(sections.length, 0);
    });

    test('returns empty array for empty file', () => {
      const result = extractDocumentSymbols('');
      assert.deepStrictEqual(result, []);
    });

    test('returns empty array for file with only body (no frontmatter)', () => {
      const text = [
        '# Just a heading',
        '',
        '## Section One',
        'Some content',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      assert.deepStrictEqual(result, []);
    });

    test('returns empty array for frontmatter without name field', () => {
      const text = [
        '---',
        'kind: agent',
        'version: "1.0"',
        '---',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      assert.deepStrictEqual(result, []);
    });

    test('children are nested under the resource symbol', () => {
      const text = [
        '---',
        'kind: skill',
        'name: tdd',
        '---',
        '',
        '## Steps',
        'Do the thing.',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      assert.strictEqual(result.length, 1);

      const resource = result[0];
      assert.strictEqual(resource.kind, 'resource');
      assert.ok(resource.children, 'resource must have children array');
      assert.ok(resource.children!.length > 0, 'resource must have at least one child');

      // Verify no top-level non-resource symbols
      for (const sym of result) {
        assert.strictEqual(sym.kind, 'resource');
      }

      // Children include both properties and sections
      const childKinds = resource.children!.map((c) => c.kind);
      assert.ok(childKinds.includes('property'), 'must have property children');
      assert.ok(childKinds.includes('section'), 'must have section children');
    });

    test('property ranges point to their respective lines', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        'tools: [Read]',
        '---',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      const properties = result[0].children!.filter((c) => c.kind === 'property');

      assert.strictEqual(properties[0].name, 'kind');
      assert.strictEqual(properties[0].range.startLine, 1);

      assert.strictEqual(properties[1].name, 'name');
      assert.strictEqual(properties[1].range.startLine, 2);

      assert.strictEqual(properties[2].name, 'tools');
      assert.strictEqual(properties[2].range.startLine, 3);
    });

    test('section ranges span from heading to next heading', () => {
      const text = [
        '---',
        'kind: agent',
        'name: reviewer',
        '---',
        '',
        '## Role',
        'Role content line 1',
        'Role content line 2',
        '',
        '## Scope',
        'Scope content',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      const sections = result[0].children!.filter((c) => c.kind === 'section');

      assert.strictEqual(sections[0].name, 'Role');
      assert.strictEqual(sections[0].range.startLine, 5);
      assert.strictEqual(sections[0].range.endLine, 8);

      assert.strictEqual(sections[1].name, 'Scope');
      assert.strictEqual(sections[1].range.startLine, 9);
      assert.strictEqual(sections[1].range.endLine, 10);
    });

    test('handles unclosed frontmatter gracefully', () => {
      const text = [
        '---',
        'kind: agent',
        'name: broken',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      assert.deepStrictEqual(result, []);
    });

    test('resource detail is empty string when kind field is absent', () => {
      const text = [
        '---',
        'name: no-kind-resource',
        'version: "1.0"',
        '---',
      ].join('\n');

      const result = extractDocumentSymbols(text);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].detail, '');
    });
  });
});
