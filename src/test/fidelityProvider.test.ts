import * as assert from 'assert';
import {
  parseFidelityOutput,
  FidelityEntry,
  scoreToClass,
} from '../fidelityProvider';

suite('FidelityProvider', () => {
  suite('parseFidelityOutput (JSON)', () => {
    test('parses JSON format output', () => {
      const stdout = JSON.stringify({
        providers: [
          { provider: 'claude', score: 95, notes: 'Full support' },
          { provider: 'cursor', score: 72, notes: 'Missing hooks' },
          { provider: 'copilot', score: 58, notes: 'Limited agents' },
        ],
      });

      const entries = parseFidelityOutput(stdout);
      assert.strictEqual(entries.length, 3);
      assert.strictEqual(entries[0].provider, 'claude');
      assert.strictEqual(entries[0].score, 95);
      assert.strictEqual(entries[1].score, 72);
      assert.strictEqual(entries[2].score, 58);
    });
  });

  suite('parseFidelityOutput (text fallback)', () => {
    test('parses text table output', () => {
      const stdout = [
        'Provider    Score  Notes',
        '--------    -----  -----',
        'claude        95%  Full support',
        'cursor        72%  Missing hooks',
        'copilot       58%  Limited agents',
      ].join('\n');

      const entries = parseFidelityOutput(stdout);
      assert.strictEqual(entries.length, 3);
      assert.strictEqual(entries[0].provider, 'claude');
      assert.strictEqual(entries[0].score, 95);
      assert.strictEqual(entries[0].notes, 'Full support');
    });

    test('returns empty array for empty output', () => {
      const entries = parseFidelityOutput('');
      assert.strictEqual(entries.length, 0);
    });

    test('handles output with only header lines', () => {
      const stdout = 'Provider    Score  Notes\n--------    -----  -----\n';
      const entries = parseFidelityOutput(stdout);
      assert.strictEqual(entries.length, 0);
    });
  });

  suite('scoreToClass', () => {
    test('returns green for score >= 90', () => {
      assert.strictEqual(scoreToClass(90), 'badge-green');
      assert.strictEqual(scoreToClass(100), 'badge-green');
      assert.strictEqual(scoreToClass(95), 'badge-green');
    });

    test('returns yellow for score >= 70 and < 90', () => {
      assert.strictEqual(scoreToClass(70), 'badge-yellow');
      assert.strictEqual(scoreToClass(89), 'badge-yellow');
      assert.strictEqual(scoreToClass(75), 'badge-yellow');
    });

    test('returns red for score < 70', () => {
      assert.strictEqual(scoreToClass(69), 'badge-red');
      assert.strictEqual(scoreToClass(0), 'badge-red');
      assert.strictEqual(scoreToClass(50), 'badge-red');
    });
  });
});
