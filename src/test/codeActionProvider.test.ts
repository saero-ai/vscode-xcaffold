import * as assert from 'assert';
import {
  levenshtein,
  findClosestField,
  computeQuickFixes,
  QuickFixAction,
} from '../codeActionProvider';

suite('CodeActionProvider', () => {
  // ----------------------------------------------------------------
  // levenshtein
  // ----------------------------------------------------------------
  suite('levenshtein', () => {
    test('identical strings have distance 0', () => {
      assert.strictEqual(levenshtein('tools', 'tools'), 0);
    });

    test('single substitution', () => {
      assert.strictEqual(levenshtein('tools', 'tolls'), 1);
    });

    test('multiple differences', () => {
      assert.strictEqual(levenshtein('tools', 'model'), 4);
    });

    test('empty vs non-empty', () => {
      assert.strictEqual(levenshtein('', 'abc'), 3);
    });

    test('non-empty vs empty', () => {
      assert.strictEqual(levenshtein('abc', ''), 3);
    });

    test('both empty', () => {
      assert.strictEqual(levenshtein('', ''), 0);
    });

    test('single character difference', () => {
      assert.strictEqual(levenshtein('cat', 'car'), 1);
    });

    test('insertion needed', () => {
      assert.strictEqual(levenshtein('tool', 'tools'), 1);
    });

    test('deletion needed', () => {
      assert.strictEqual(levenshtein('tools', 'tool'), 1);
    });
  });

  // ----------------------------------------------------------------
  // findClosestField
  // ----------------------------------------------------------------
  suite('findClosestField', () => {
    const validFields = ['tools', 'model', 'name', 'description', 'version'];

    test('returns closest match within default distance', () => {
      const result = findClosestField('tols', validFields);
      assert.strictEqual(result, 'tools');
    });

    test('returns exact match at distance 0', () => {
      const result = findClosestField('name', validFields);
      assert.strictEqual(result, 'name');
    });

    test('returns undefined when no match is close enough', () => {
      const result = findClosestField('xyz', validFields);
      assert.strictEqual(result, undefined);
    });

    test('returns undefined for empty valid fields list', () => {
      const result = findClosestField('tools', []);
      assert.strictEqual(result, undefined);
    });

    test('respects custom maxDistance', () => {
      // 'tols' -> 'tools' is distance 1, so maxDistance=0 should reject
      const result = findClosestField('tols', validFields, 0);
      assert.strictEqual(result, undefined);
    });

    test('picks closest when multiple candidates exist', () => {
      // 'nme' -> 'name' is distance 1, 'model' is distance 4
      const result = findClosestField('nme', validFields);
      assert.strictEqual(result, 'name');
    });

    test('handles hyphenated field names', () => {
      const fields = ['allowed-tools', 'always-apply', 'activation'];
      const result = findClosestField('allowed-tool', fields);
      assert.strictEqual(result, 'allowed-tools');
    });
  });

  // ----------------------------------------------------------------
  // computeQuickFixes
  // ----------------------------------------------------------------
  suite('computeQuickFixes', () => {
    const agentSchema = [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Agent name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Description' },
      { name: 'tools', type: '[]string', required: false, group: 'behavior', description: 'Allowed tools' },
      { name: 'model', type: 'string', required: false, group: 'behavior', description: 'LLM model' },
    ];

    // -- quote-version -----------------------------------------------
    test('suggests quoting unquoted version number', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: 1.0',
        'name: test',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 2, agentSchema);
      const quoteAction = fixes.find((f) => f.kind === 'quote-version');
      assert.ok(quoteAction, 'should produce a quote-version action');
      assert.strictEqual(quoteAction!.title, 'Quote version number');
      assert.strictEqual(quoteAction!.edit.newText, '"1.0"');
    });

    test('suggests quoting integer version', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: 2',
        'name: test',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 2, agentSchema);
      const quoteAction = fixes.find((f) => f.kind === 'quote-version');
      assert.ok(quoteAction, 'should produce a quote-version action');
      assert.strictEqual(quoteAction!.edit.newText, '"2"');
    });

    test('does not suggest quoting already-quoted version', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 2, agentSchema);
      const quoteAction = fixes.find((f) => f.kind === 'quote-version');
      assert.strictEqual(quoteAction, undefined);
    });

    // -- fix-field ---------------------------------------------------
    test('suggests fixing unknown field name', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        'tols: [Read]',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 4, agentSchema);
      const fixAction = fixes.find((f) => f.kind === 'fix-field');
      assert.ok(fixAction, 'should produce a fix-field action');
      assert.ok(fixAction!.title.includes('tols'));
      assert.ok(fixAction!.title.includes('tools'));
      assert.strictEqual(fixAction!.edit.newText, 'tools');
    });

    test('does not suggest fix for valid field name', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        'tools: [Read]',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 4, agentSchema);
      const fixAction = fixes.find((f) => f.kind === 'fix-field');
      assert.strictEqual(fixAction, undefined);
    });

    test('does not suggest fix when field is too far from any valid name', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        'xyzabc: value',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 4, agentSchema);
      const fixAction = fixes.find((f) => f.kind === 'fix-field');
      assert.strictEqual(fixAction, undefined);
    });

    // -- add-field ---------------------------------------------------
    test('suggests adding missing required field', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        '---',
      ].join('\n');
      // Line 1 is inside frontmatter
      const fixes = computeQuickFixes(doc, 1, agentSchema);
      const addActions = fixes.filter((f) => f.kind === 'add-field');
      assert.ok(addActions.length > 0, 'should suggest adding missing fields');
      const nameAction = addActions.find((a) => a.title.includes('name'));
      assert.ok(nameAction, 'should suggest adding "name" field');
    });

    test('does not suggest adding fields when all required are present', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: my-agent',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 1, agentSchema);
      const addActions = fixes.filter((f) => f.kind === 'add-field');
      assert.strictEqual(addActions.length, 0);
    });

    // -- outside frontmatter -----------------------------------------
    test('returns no actions outside frontmatter', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        '---',
        'Body content here',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 5, agentSchema);
      assert.strictEqual(fixes.length, 0);
    });

    test('returns no actions on delimiter line', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        '---',
      ].join('\n');
      // Line 0 is the opening ---
      const fixes = computeQuickFixes(doc, 0, agentSchema);
      assert.strictEqual(fixes.length, 0);
    });

    test('returns no actions when no frontmatter exists', () => {
      const doc = 'Just some plain text\nwithout frontmatter';
      const fixes = computeQuickFixes(doc, 0, agentSchema);
      assert.strictEqual(fixes.length, 0);
    });

    // -- pure YAML format (no --- delimiters) ------------------------
    test('handles pure YAML format without --- delimiters', () => {
      const doc = [
        'kind: agent',
        'version: 1.0',
        'name: test',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 1, agentSchema);
      const quoteAction = fixes.find((f) => f.kind === 'quote-version');
      assert.ok(quoteAction, 'should detect unquoted version in pure YAML');
    });

    // -- edit positions -----------------------------------------------
    test('quote-version edit targets the correct range', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: 1.0',
        'name: test',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 2, agentSchema);
      const quoteAction = fixes.find((f) => f.kind === 'quote-version');
      assert.ok(quoteAction);
      // 'version: ' is 9 chars, '1.0' is 3 chars
      assert.strictEqual(quoteAction!.edit.range!.start, 9);
      assert.strictEqual(quoteAction!.edit.range!.end, 12);
    });

    test('fix-field edit targets the field name range', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: test',
        'tols: [Read]',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 4, agentSchema);
      const fixAction = fixes.find((f) => f.kind === 'fix-field');
      assert.ok(fixAction);
      assert.strictEqual(fixAction!.edit.range!.start, 0);
      assert.strictEqual(fixAction!.edit.range!.end, 4); // 'tols' is 4 chars
    });

    test('add-field edit inserts before closing delimiter', () => {
      const doc = [
        '---',
        'kind: agent',
        'version: "1.0"',
        '---',
      ].join('\n');
      const fixes = computeQuickFixes(doc, 1, agentSchema);
      const addAction = fixes.find((f) => f.kind === 'add-field');
      assert.ok(addAction);
      // Closing delimiter is line 3, so insertion should be at line 3
      assert.strictEqual(addAction!.edit.line, 3);
    });
  });
});
