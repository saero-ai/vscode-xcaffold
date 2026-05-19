// src/test/statusDashProvider.test.ts
import * as assert from 'assert';
import {
  parseStatusDashOutput,
  ProviderStatus,
  driftIcon,
} from '../statusDashProvider';

suite('StatusDashProvider', () => {
  suite('parseStatusDashOutput', () => {
    test('parses text format with provider blocks', () => {
      const stdout = [
        'xcaffold status',
        '',
        'Provider: claude',
        '  Status: synced',
        '  Last applied: 2026-05-04T12:00:00Z',
        '  Files: 8',
        '  Drift: clean',
        '',
        'Provider: cursor',
        '  Status: drifted',
        '  Last applied: 2026-05-03T10:00:00Z',
        '  Files: 5',
        '  Drift: drifted',
      ].join('\n');

      const providers = parseStatusDashOutput(stdout);
      assert.strictEqual(providers.length, 2);
      assert.strictEqual(providers[0].name, 'claude');
      assert.strictEqual(providers[0].status, 'synced');
      assert.strictEqual(providers[0].fileCount, 8);
      assert.strictEqual(providers[0].drift, false);
      assert.strictEqual(providers[1].name, 'cursor');
      assert.strictEqual(providers[1].drift, true);
    });

    test('returns empty array for empty output', () => {
      const providers = parseStatusDashOutput('');
      assert.strictEqual(providers.length, 0);
    });
  });

  suite('driftIcon', () => {
    test('returns check for no drift', () => {
      assert.strictEqual(driftIcon(false), '✓');
    });

    test('returns warning for drift', () => {
      assert.strictEqual(driftIcon(true), '⚠');
    });
  });
});
