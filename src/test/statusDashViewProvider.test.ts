// src/test/statusDashViewProvider.test.ts
import * as assert from 'assert';
import {
  parseStatusOutput,
  parseValidateSummary,
  StatusInfo,
  ValidateSummary,
} from '../statusDashViewProvider';

suite('StatusDashViewProvider', () => {
  suite('parseStatusOutput', () => {
    test('parses standard tabular output', () => {
      const stdout = [
        'xcaffold-project  .  last applied just now',
        '',
        '  PROVIDER       FILES   STATUS',
        '  antigravity       12   ok synced',
        '  claude            14   ok synced',
        '  gemini            14   ok synced',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.projectName, 'xcaffold-project');
      assert.strictEqual(result.lastApplied, 'just now');
      assert.strictEqual(result.providers.length, 3);

      assert.strictEqual(result.providers[0].name, 'antigravity');
      assert.strictEqual(result.providers[0].files, 12);
      assert.strictEqual(result.providers[0].status, 'ok synced');

      assert.strictEqual(result.providers[1].name, 'claude');
      assert.strictEqual(result.providers[1].files, 14);

      assert.strictEqual(result.providers[2].name, 'gemini');
      assert.strictEqual(result.providers[2].files, 14);
    });

    test('parses output with timestamp', () => {
      const stdout = [
        'my-project  .  last applied 3 minutes ago',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude             8   ok synced',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.projectName, 'my-project');
      assert.strictEqual(result.lastApplied, '3 minutes ago');
      assert.strictEqual(result.providers.length, 1);
      assert.strictEqual(result.providers[0].name, 'claude');
      assert.strictEqual(result.providers[0].files, 8);
    });

    test('returns empty info for empty output', () => {
      const result = parseStatusOutput('');
      assert.strictEqual(result.projectName, '');
      assert.strictEqual(result.lastApplied, '');
      assert.strictEqual(result.providers.length, 0);
    });

    test('returns empty info for whitespace-only output', () => {
      const result = parseStatusOutput('   \n  \n  ');
      assert.strictEqual(result.projectName, '');
      assert.strictEqual(result.lastApplied, '');
      assert.strictEqual(result.providers.length, 0);
    });

    test('handles header line without provider table', () => {
      const stdout = 'my-project  .  last applied never';
      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.projectName, 'my-project');
      assert.strictEqual(result.lastApplied, 'never');
      assert.strictEqual(result.providers.length, 0);
    });

    test('handles malformed first line gracefully', () => {
      const stdout = 'some unexpected output format';
      const result = parseStatusOutput(stdout);
      // Falls back to using the line as project name
      assert.strictEqual(result.projectName, 'some unexpected output format');
      assert.strictEqual(result.lastApplied, '');
    });

    test('handles single provider row', () => {
      const stdout = [
        'test-proj  .  last applied 1 hour ago',
        '',
        '  PROVIDER       FILES   STATUS',
        '  cursor             3   outdated',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.providers.length, 1);
      assert.strictEqual(result.providers[0].name, 'cursor');
      assert.strictEqual(result.providers[0].files, 3);
      assert.strictEqual(result.providers[0].status, 'outdated');
    });
  });

  suite('parseValidateSummary', () => {
    test('counts errors from lines with !!', () => {
      const stdout = [
        'Validating project...',
        '!! agents/my-agent: missing required field "model"',
        '!! rules/bad-rule: invalid name format',
        'ok skills/my-skill',
        'ok hooks/pre-commit',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 2);
      assert.strictEqual(result.warnings, 0);
    });

    test('counts warnings from lines with warn keyword', () => {
      const stdout = [
        'Validating project...',
        'ok agents/my-agent',
        'warning: deprecated field "allowed-tools" in agent',
        'warn: unused skill reference',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 0);
      assert.strictEqual(result.warnings, 2);
    });

    test('counts both errors and warnings', () => {
      const stdout = [
        '!! agents/broken: parse error',
        'warning: unused import',
        '!! rules/bad: invalid syntax',
        'ok skills/good',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 2);
      assert.strictEqual(result.warnings, 1);
    });

    test('returns zeros for clean output', () => {
      const stdout = [
        'Validating project...',
        'ok agents/my-agent',
        'ok rules/my-rule',
        'ok skills/my-skill',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 0);
      assert.strictEqual(result.warnings, 0);
    });

    test('returns zeros for empty output', () => {
      const result = parseValidateSummary('');
      assert.strictEqual(result.errors, 0);
      assert.strictEqual(result.warnings, 0);
    });

    test('handles error keyword in lines', () => {
      const stdout = [
        'error: failed to parse agents/broken.xcaf',
        'ok rules/my-rule',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 1);
      assert.strictEqual(result.warnings, 0);
    });
  });
});
