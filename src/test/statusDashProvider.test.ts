// src/test/statusDashProvider.test.ts
import * as assert from 'assert';
import {
  parseStatusDashOutput,
  parseStatusJSON,
  parseStatusOutput,
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

  suite('parseStatusJSON', () => {
    test('parses valid StatusJSON with 2 providers', () => {
      const fixture = JSON.stringify({
        project: 'my-project',
        blueprint: 'default',
        lastApplied: '2026-06-17T10:00:00+08:00',
        providers: [
          {
            name: 'claude',
            displayLabel: 'Claude Code',
            status: 'active',
            deprecatedBy: '',
            sunsetDate: '',
            fileCount: 12,
            driftCount: 2,
            lastApplied: '2026-06-17T10:00:00+08:00',
            outputDir: '.claude',
          },
          {
            name: 'cursor',
            displayLabel: 'Cursor',
            status: 'active',
            deprecatedBy: '',
            sunsetDate: '',
            fileCount: 5,
            driftCount: 0,
            lastApplied: '2026-06-16T08:00:00+08:00',
            outputDir: '.cursor',
          },
        ],
        sources: { total: 24, changed: 3 },
      });
      const providers = parseStatusJSON(fixture);
      assert.strictEqual(providers.length, 2);
      assert.strictEqual(providers[0].name, 'claude');
      assert.strictEqual(providers[0].status, 'active');
      assert.strictEqual(providers[0].fileCount, 12);
      assert.strictEqual(providers[0].drift, true);  // driftCount > 0
      assert.strictEqual(providers[1].name, 'cursor');
      assert.strictEqual(providers[1].drift, false);  // driftCount === 0
    });

    test('throws on malformed JSON', () => {
      assert.throws(() => parseStatusJSON('not json'));
    });

    test('returns empty array for empty providers', () => {
      const fixture = JSON.stringify({
        project: 'test',
        blueprint: '',
        lastApplied: '',
        providers: [],
        sources: { total: 0, changed: 0 },
      });
      const providers = parseStatusJSON(fixture);
      assert.strictEqual(providers.length, 0);
    });

    test('includes deprecatedBy for deprecated provider', () => {
      const fixture = JSON.stringify({
        project: 'test', blueprint: '', lastApplied: '',
        providers: [
          { name: 'antigravity', displayLabel: 'Antigravity', status: 'deprecated', deprecatedBy: 'antigravity2', sunsetDate: '', fileCount: 5, driftCount: 0, lastApplied: '', outputDir: '.antigravity' },
        ],
        sources: { total: 0, changed: 0 },
      });
      const providers = parseStatusJSON(fixture);
      assert.strictEqual(providers[0].status, 'deprecated');
      assert.strictEqual(providers[0].deprecatedBy, 'antigravity2');
    });

    test('active provider has no deprecatedBy', () => {
      const fixture = JSON.stringify({
        project: 'test', blueprint: '', lastApplied: '',
        providers: [
          { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 0, lastApplied: '', outputDir: '.claude' },
        ],
        sources: { total: 0, changed: 0 },
      });
      const providers = parseStatusJSON(fixture);
      assert.strictEqual(providers[0].deprecatedBy, undefined);
    });
  });

  suite('parseStatusOutput', () => {
    test('uses JSON parser for valid JSON input', () => {
      const fixture = JSON.stringify({
        project: 'test',
        blueprint: 'default',
        lastApplied: '',
        providers: [
          {
            name: 'claude',
            displayLabel: 'Claude Code',
            status: 'active',
            deprecatedBy: '',
            sunsetDate: '',
            fileCount: 8,
            driftCount: 0,
            lastApplied: '2026-06-17T10:00:00+08:00',
            outputDir: '.claude',
          },
        ],
        sources: { total: 10, changed: 1 },
      });
      const providers = parseStatusOutput(fixture);
      assert.strictEqual(providers.length, 1);
      assert.strictEqual(providers[0].name, 'claude');
    });

    test('falls back to text parser for non-JSON input', () => {
      const textOutput = [
        'Provider: claude',
        '  Status: synced',
        '  Last applied: 2026-05-04T12:00:00Z',
        '  Files: 8',
        '  Drift: clean',
      ].join('\n');
      const providers = parseStatusOutput(textOutput);
      assert.strictEqual(providers.length, 1);
      assert.strictEqual(providers[0].name, 'claude');
    });

    test('maps driftCount > 0 to drift true via JSON path', () => {
      const fixture = JSON.stringify({
        project: 'test',
        blueprint: 'default',
        lastApplied: '',
        providers: [
          { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 1, lastApplied: '2026-06-17T10:00:00+08:00', outputDir: '.claude' },
        ],
        sources: { total: 10, changed: 1 },
      });
      const providers = parseStatusOutput(fixture);
      assert.strictEqual(providers[0].drift, true);
    });
  });
});
