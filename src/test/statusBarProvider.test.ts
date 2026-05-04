import * as assert from 'assert';
import { parseStatusOutput, formatStatusText } from '../statusBarProvider';

suite('StatusBarProvider', () => {
  suite('parseStatusOutput', () => {
    test('parses clean status with timestamp', () => {
      const stdout = [
        'xcaffold status',
        '',
        'Project: my-project',
        'Last applied: 2026-05-04T12:30:00Z',
        'Drift: Clean',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.lastApplied, '2026-05-04T12:30:00Z');
      assert.strictEqual(result.drift, 'Clean');
    });

    test('parses drifted status', () => {
      const stdout = [
        'xcaffold status',
        '',
        'Project: my-project',
        'Last applied: 2026-05-04T10:00:00Z',
        'Drift: Drifted',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.drift, 'Drifted');
    });

    test('returns Unknown drift for missing drift line', () => {
      const stdout = 'xcaffold status\n\nProject: my-project';
      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.drift, 'Unknown');
      assert.strictEqual(result.lastApplied, null);
    });

    test('returns Unknown drift for empty output', () => {
      const result = parseStatusOutput('');
      assert.strictEqual(result.drift, 'Unknown');
      assert.strictEqual(result.lastApplied, null);
    });
  });

  suite('formatStatusText', () => {
    test('formats full status with version, timestamp, and drift', () => {
      const text = formatStatusText('0.9.0', '2026-05-04T12:30:00Z', 'Clean');
      assert.strictEqual(text, 'xcaffold: v0.9.0 | Last: 2026-05-04T12:30:00Z | Clean');
    });

    test('formats status with unknown last applied', () => {
      const text = formatStatusText('0.9.0', null, 'Unknown');
      assert.strictEqual(text, 'xcaffold: v0.9.0 | Last: n/a | Unknown');
    });

    test('formats status with null version', () => {
      const text = formatStatusText(null, null, 'Unknown');
      assert.strictEqual(text, 'xcaffold: v? | Last: n/a | Unknown');
    });
  });
});
