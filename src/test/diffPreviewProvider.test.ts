import * as assert from 'assert';
import {
  parseDryRunOutput,
  makeTempDirName,
} from '../diffPreviewProvider';

suite('DiffPreviewProvider', () => {
  suite('makeTempDirName', () => {
    test('starts with xcaffold-diff- prefix', () => {
      const name = makeTempDirName();
      assert.ok(name.startsWith('xcaffold-diff-'));
    });

    test('includes random suffix', () => {
      const a = makeTempDirName();
      const b = makeTempDirName();
      assert.notStrictEqual(a, b);
    });

    test('contains no path separators', () => {
      const name = makeTempDirName();
      assert.ok(!name.includes('/'));
      assert.ok(!name.includes('\\'));
    });
  });

  suite('parseDryRunOutput', () => {
    test('extracts changed file paths from dry-run stdout', () => {
      const stdout = [
        'Dry run: would write 3 files',
        '  .claude/agents/reviewer.md',
        '  .claude/rules/secure-coding.md',
        '  .cursor/agents/reviewer.md',
      ].join('\n');

      const files = parseDryRunOutput(stdout);
      assert.strictEqual(files.length, 3);
      assert.ok(files.includes('.claude/agents/reviewer.md'));
      assert.ok(files.includes('.claude/rules/secure-coding.md'));
      assert.ok(files.includes('.cursor/agents/reviewer.md'));
    });

    test('returns empty array for no-change output', () => {
      const stdout = 'Dry run: no changes detected\n';
      const files = parseDryRunOutput(stdout);
      assert.strictEqual(files.length, 0);
    });

    test('handles JSON format output', () => {
      const stdout = JSON.stringify({
        files: [
          { path: '.claude/agents/reviewer.md', action: 'write' },
          { path: '.claude/rules/secure-coding.md', action: 'write' },
        ],
      });

      const files = parseDryRunOutput(stdout);
      assert.strictEqual(files.length, 2);
      assert.ok(files.includes('.claude/agents/reviewer.md'));
    });

    test('handles empty stdout', () => {
      const files = parseDryRunOutput('');
      assert.strictEqual(files.length, 0);
    });

    test('handles stdout with only header line', () => {
      const stdout = 'Dry run: would write 0 files\n';
      const files = parseDryRunOutput(stdout);
      assert.strictEqual(files.length, 0);
    });
  });
});
