import * as assert from 'assert';
import { parseValidateOutput } from '../diagnosticProvider';

suite('DiagnosticProvider', () => {
  test('parseValidateOutput returns empty array for empty stderr', () => {
    const diags = parseValidateOutput('', '/workspace/agent.xcf');
    assert.strictEqual(diags.length, 0);
  });

  test('parseValidateOutput parses line:col error format', () => {
    // xcaffold validate usually outputs: filename.xcf:LINE:COL: message
    const stderr = 'agent.xcf:5:3: unknown field "model-version"';
    const diags = parseValidateOutput(stderr, '/workspace/agent.xcf');
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].range.start.line, 4); // 0-indexed
    assert.ok(diags[0].message.includes('model-version'));
  });

  test('parseValidateOutput parses multi-line errors', () => {
    const stderr = [
      'agent.xcf:2:1: unknown field "badinput"',
      'agent.xcf:10:1: missing required field "name"',
    ].join('\n');
    const diags = parseValidateOutput(stderr, '/workspace/agent.xcf');
    assert.strictEqual(diags.length, 2);
    assert.strictEqual(diags[0].range.start.line, 1);
    assert.strictEqual(diags[1].range.start.line, 9);
  });
});
