// src/test/statusDashViewProvider.test.ts
import * as assert from 'assert';
import {
  parseDeclaredTargets,
  parseStatusOutput,
  parseValidateSummary,
  StatusDashViewProvider,
  StatusInfo,
  ValidateSummary,
} from '../statusDashViewProvider';
import { DataSource } from '../webview/dataSource';
import { CliResult } from '../xcaffoldCli';

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

    test('parses header with blueprint name', () => {
      const stdout = [
        'xcaffold-vscode  .  blueprint: my-bp  .  last applied just now',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude            14   ok synced',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.projectName, 'xcaffold-vscode');
      assert.strictEqual(result.blueprint, 'my-bp');
      assert.strictEqual(result.lastApplied, 'just now');
      assert.strictEqual(result.providers.length, 1);
      assert.strictEqual(result.providers[0].name, 'claude');
    });

    test('header without blueprint has empty blueprint field', () => {
      const stdout = [
        'my-project  .  last applied 3 minutes ago',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude             8   ok synced',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.projectName, 'my-project');
      assert.strictEqual(result.blueprint, '');
      assert.strictEqual(result.lastApplied, '3 minutes ago');
    });

    test('empty output has empty blueprint field', () => {
      const result = parseStatusOutput('');
      assert.strictEqual(result.blueprint, '');
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

    test('stops at blank line after provider rows — Sources row not included', () => {
      const stdout = [
        'xcaffold-project  .  last applied 8 hours ago',
        '',
        '  PROVIDER       FILES   STATUS',
        '  antigravity      145   ok synced',
        '  claude           251   !! 2 modified',
        '',
        '  Sources  466 .xcaf files  .  179 changed since last apply',
      ].join('\n');

      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.providers.length, 2);
      assert.strictEqual(result.providers[0].name, 'antigravity');
      assert.strictEqual(result.providers[0].files, 145);
      assert.strictEqual(result.providers[1].name, 'claude');
      assert.strictEqual(result.providers[1].files, 251);
      assert.strictEqual(result.providers[1].status, '!! 2 modified');
    });

    test('sets state to synced for ok status', () => {
      const stdout = [
        'proj  .  last applied just now',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude            14   ok synced',
      ].join('\n');
      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.providers[0].state, 'synced');
    });

    test('sets state to drifted for !! status', () => {
      const stdout = [
        'proj  .  last applied just now',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude            14   !! 2 modified',
      ].join('\n');
      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.providers[0].state, 'drifted');
    });

    test('sets state to drifted for drift detected status', () => {
      const stdout = [
        'proj  .  last applied just now',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude            14   drift detected',
      ].join('\n');
      const result = parseStatusOutput(stdout);
      assert.strictEqual(result.providers[0].state, 'drifted');
    });
  });

  suite('parseDeclaredTargets', () => {
    test('extracts target names from project.xcaf content', () => {
      const content = [
        'kind: project',
        'version: "1.0"',
        'name: my-project',
        'targets:',
        '  - antigravity',
        '  - claude',
        '  - gemini',
      ].join('\n');
      const result = parseDeclaredTargets(content);
      assert.deepStrictEqual(result, ['antigravity', 'claude', 'gemini']);
    });

    test('returns empty array when no targets section', () => {
      const content = 'kind: project\nname: test\n';
      assert.deepStrictEqual(parseDeclaredTargets(content), []);
    });

    test('returns empty array for empty content', () => {
      assert.deepStrictEqual(parseDeclaredTargets(''), []);
    });

    test('stops parsing at next non-list field', () => {
      const content = [
        'targets:',
        '  - claude',
        '  - gemini',
        'vars:',
        '  key: value',
      ].join('\n');
      const result = parseDeclaredTargets(content);
      assert.deepStrictEqual(result, ['claude', 'gemini']);
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
      assert.deepStrictEqual(result.messages, [
        'agents/my-agent: missing required field "model"',
        'rules/bad-rule: invalid name format',
      ]);
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
      assert.deepStrictEqual(result.messages, [
        'deprecated field "allowed-tools" in agent',
        'unused skill reference',
      ]);
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
      assert.strictEqual(result.messages.length, 3);
    });

    test('returns zeros and empty messages for clean output', () => {
      const stdout = [
        'Validating project...',
        'ok agents/my-agent',
        'ok rules/my-rule',
        'ok skills/my-skill',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 0);
      assert.strictEqual(result.warnings, 0);
      assert.deepStrictEqual(result.messages, []);
    });

    test('returns zeros and empty messages for empty output', () => {
      const result = parseValidateSummary('');
      assert.strictEqual(result.errors, 0);
      assert.strictEqual(result.warnings, 0);
      assert.deepStrictEqual(result.messages, []);
    });

    test('handles error keyword in lines', () => {
      const stdout = [
        'error: failed to parse agents/broken.xcaf',
        'ok rules/my-rule',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 1);
      assert.strictEqual(result.warnings, 0);
      assert.deepStrictEqual(result.messages, [
        'error: failed to parse agents/broken.xcaf',
      ]);
    });

    test('** prefixed lines are warnings, not errors', () => {
      const stdout = [
        '  ok  syntax and schema',
        '  ok  skill directories',
        '  ok  structural checks',
        '  **  policies (skipped: compilation error)',
        '',
        'ok  Validation passed.  99 .xcaf files checked.',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 0);
      assert.strictEqual(result.warnings, 1);
      assert.deepStrictEqual(result.messages, [
        'policies (skipped: compilation error)',
      ]);
    });

    test('captures error messages from real validate output', () => {
      const stdout = [
        'xcaffold-project  .  last applied 8 hours ago',
        '',
        '  !!  syntax and schema',
        '',
        '!!  Validation failed: failed to merge config files',
        'duplicate agent ID "auth-specialist" found in agent.xcaf and agent.xcaf',
      ].join('\n');

      const result = parseValidateSummary(stdout);
      assert.strictEqual(result.errors, 2);
      assert.strictEqual(result.messages.length, 2);
      assert.ok(result.messages[0].includes('syntax and schema'));
      assert.ok(result.messages[1].includes('Validation failed'));
    });
  });

  suite('fetchStatusInfo — non-zero exit with valid stdout', () => {
    function createProvider(dataSource: DataSource): StatusDashViewProvider {
      const vscode = require('vscode');
      const fakeUri = vscode.Uri.file('/fake/extension');
      return new StatusDashViewProvider(fakeUri, dataSource, '/fake/workspace');
    }

    test('parses stdout attached to rejected error', async () => {
      const validStdout = [
        'my-project  .  last applied 2 minutes ago',
        '',
        '  PROVIDER       FILES   STATUS',
        '  claude            14   drift detected',
      ].join('\n');

      const ds: DataSource = {
        fetch: () => Promise.reject(Object.assign(new Error('exit code 1'), { stdout: validStdout })),
      };
      const provider = createProvider(ds);
      // Access private method via bracket notation for testing
      const info: StatusInfo = await (provider as any)['fetchStatusInfo']();
      assert.strictEqual(info.projectName, 'my-project');
      assert.strictEqual(info.lastApplied, '2 minutes ago');
      assert.strictEqual(info.providers.length, 1);
      assert.strictEqual(info.providers[0].name, 'claude');
      assert.strictEqual(info.providers[0].status, 'drift detected');
    });

    test('returns empty info when error has no stdout', async () => {
      const ds: DataSource = {
        fetch: () => Promise.reject(new Error('command not found')),
      };
      const provider = createProvider(ds);
      const info: StatusInfo = await (provider as any)['fetchStatusInfo']();
      assert.strictEqual(info.projectName, '');
      assert.strictEqual(info.providers.length, 0);
    });

    test('returns empty info when error stdout is empty string', async () => {
      const ds: DataSource = {
        fetch: () => Promise.reject(Object.assign(new Error('exit code 1'), { stdout: '   ' })),
      };
      const provider = createProvider(ds);
      const info: StatusInfo = await (provider as any)['fetchStatusInfo']();
      assert.strictEqual(info.projectName, '');
      assert.strictEqual(info.providers.length, 0);
    });
  });

  suite('fetchValidateSummary — non-zero exit with valid stdout', () => {
    function createProvider(dataSource: DataSource): StatusDashViewProvider {
      const vscode = require('vscode');
      const fakeUri = vscode.Uri.file('/fake/extension');
      return new StatusDashViewProvider(fakeUri, dataSource, '/fake/workspace');
    }

    test('parses validation output from rejected error', async () => {
      const validStdout = [
        '!! agents/broken: missing required field "model"',
        'warning: deprecated field in agent',
        'ok skills/good',
      ].join('\n');

      const ds: DataSource = {
        fetch: () => Promise.reject(Object.assign(new Error('exit code 1'), { stdout: validStdout })),
      };
      const provider = createProvider(ds);
      const summary: ValidateSummary = await (provider as any)['fetchValidateSummary']();
      assert.strictEqual(summary.errors, 1);
      assert.strictEqual(summary.warnings, 1);
    });

    test('returns zeros when error has no stdout', async () => {
      const ds: DataSource = {
        fetch: () => Promise.reject(new Error('command not found')),
      };
      const provider = createProvider(ds);
      const summary: ValidateSummary = await (provider as any)['fetchValidateSummary']();
      assert.strictEqual(summary.errors, 0);
      assert.strictEqual(summary.warnings, 0);
    });
  });
});
