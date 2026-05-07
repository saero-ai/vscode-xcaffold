import * as assert from 'assert';
import { filterDiagnosticsForFile } from '../commandProvider';

suite('File-level validate', () => {
  suite('filterDiagnosticsForFile', () => {
    test('returns only diagnostics matching the active file basename', () => {
      const output = [
        'reviewer.xcaf:3:1: unknown field "invalid-field"',
        'my-skill.xcaf:5:1: missing required field "name"',
        'reviewer.xcaf:7:10: value must be a string',
      ].join('\n');

      const filtered = filterDiagnosticsForFile(output, '/workspace/xcaf/agents/reviewer.xcaf');
      assert.strictEqual(filtered.length, 2);
      assert.ok(filtered[0].message.includes('unknown field'));
      assert.ok(filtered[1].message.includes('value must be a string'));
    });

    test('returns empty array when no diagnostics match the file', () => {
      const output = 'other.xcaf:1:1: some error';
      const filtered = filterDiagnosticsForFile(output, '/workspace/xcaf/agents/reviewer.xcaf');
      assert.strictEqual(filtered.length, 0);
    });

    test('returns empty array for empty output', () => {
      const filtered = filterDiagnosticsForFile('', '/workspace/xcaf/agents/reviewer.xcaf');
      assert.strictEqual(filtered.length, 0);
    });

    test('returns fallback diagnostic for validation-failed without line info', () => {
      const output = 'Validation failed: reviewer.xcaf has errors';
      const filtered = filterDiagnosticsForFile(output, '/workspace/xcaf/agents/reviewer.xcaf');
      assert.strictEqual(filtered.length, 1);
      assert.ok(filtered[0].message.includes('Validation failed'));
    });

    test('handles path with special regex characters', () => {
      const output = 'my+skill.xcaf:2:1: bad field';
      const filtered = filterDiagnosticsForFile(output, '/workspace/my+skill.xcaf');
      assert.strictEqual(filtered.length, 1);
    });
  });
});
