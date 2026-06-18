import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  XCAFFOLD_COMMANDS,
  fetchProviderTargets,
  fetchProviderInfo,
  buildApplyArgs,
  parseApplyLine,
  parseApplyOutput,
  parseApplyEventLine,
  parseProviderNamesFromStatus,
  ApplyOptions,
} from '../commandProvider';
import { ApplyProviderEvent, ApplySummaryEvent } from '../cliTypes';

interface PkgCommand {
  command: string;
  title: string;
}

suite('CommandProvider', () => {
  test('XCAFFOLD_COMMANDS defines all required command IDs', () => {
    const ids = XCAFFOLD_COMMANDS.map(c => c.id);
    assert.ok(ids.includes('xcaffold.apply'));
    assert.ok(ids.includes('xcaffold.validate'));
    assert.ok(ids.includes('xcaffold.status'));
    assert.ok(ids.includes('xcaffold.list'));
    assert.ok(ids.includes('xcaffold.import'));
  });
});

suite('fetchProviderTargets', () => {
  test('returns providers from status JSON', async () => {
    const mockCli = {
      run: async () => ({
        stdout: JSON.stringify({
          project: 'test',
          blueprint: 'default',
          lastApplied: '',
          providers: [
            { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 0, lastApplied: '', outputDir: '.claude' },
            { name: 'cursor', displayLabel: 'Cursor', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 5, driftCount: 0, lastApplied: '', outputDir: '.cursor' },
            { name: 'gemini', displayLabel: 'Gemini', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 3, driftCount: 0, lastApplied: '', outputDir: '.gemini' },
          ],
          sources: { total: 10, changed: 0 },
        }),
      }),
    };
    const targets = await fetchProviderTargets(mockCli, '/workspace');
    assert.strictEqual(targets[0], 'All Providers');
    assert.strictEqual(targets.length, 4);
    assert.ok(targets.includes('claude'));
    assert.ok(targets.includes('cursor'));
    assert.ok(targets.includes('gemini'));
  });

  test('returns only All Providers on CLI error', async () => {
    const mockCli = {
      run: async () => { throw new Error('CLI not found'); },
    };
    const targets = await fetchProviderTargets(mockCli, '/workspace');
    assert.deepStrictEqual(targets, ['All Providers']);
  });

  test('returns only All Providers for empty providers', async () => {
    const mockCli = {
      run: async () => ({
        stdout: JSON.stringify({
          project: 'test', blueprint: '', lastApplied: '',
          providers: [], sources: { total: 0, changed: 0 },
        }),
      }),
    };
    const targets = await fetchProviderTargets(mockCli, '/workspace');
    assert.deepStrictEqual(targets, ['All Providers']);
  });

  test('appends (deprecated) to deprecated providers', async () => {
    const mockCli = {
      run: async () => ({
        stdout: JSON.stringify({
          project: 'test', blueprint: '', lastApplied: '',
          providers: [
            { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 0, lastApplied: '', outputDir: '.claude' },
            { name: 'antigravity', displayLabel: 'Antigravity', status: 'deprecated', deprecatedBy: 'antigravity2', sunsetDate: '', fileCount: 5, driftCount: 0, lastApplied: '', outputDir: '.antigravity' },
          ],
          sources: { total: 0, changed: 0 },
        }),
      }),
    };
    const targets = await fetchProviderTargets(mockCli, '/workspace');
    assert.ok(targets.includes('claude'));
    assert.ok(targets.includes('antigravity (deprecated)'));
    assert.ok(!targets.includes('antigravity'));
  });

  test('falls back to text parsing when --json not supported', async () => {
    const mockCli = {
      run: async (args: string[]) => {
        if (args.includes('--json')) {
          throw new Error('unknown flag: --json');
        }
        return {
          stdout: [
            'my-project  .  last applied 5 minutes ago',
            '',
            '  PROVIDER       FILES   STATUS',
            '  claude            30   ok synced',
            '  antigravity       29   ok synced',
            '',
            '  Sources  21 .xcaf files',
          ].join('\n'),
        };
      },
    };
    const targets = await fetchProviderTargets(mockCli, '/workspace');
    assert.deepStrictEqual(targets, ['All Providers', 'claude', 'antigravity']);
  });
});

suite('parseProviderNamesFromStatus', () => {
  test('parses provider names from text status output', () => {
    const stdout = [
      'my-project  .  last applied 5 minutes ago',
      '',
      '  PROVIDER       FILES   STATUS',
      '  claude            30   ok synced',
      '  antigravity       29   ok synced',
      '',
      '  Sources  21 .xcaf files',
    ].join('\n');
    const names = parseProviderNamesFromStatus(stdout);
    assert.deepStrictEqual(names, ['claude', 'antigravity']);
  });

  test('returns empty array for empty output', () => {
    assert.deepStrictEqual(parseProviderNamesFromStatus(''), []);
  });
});

suite('Target-filtered apply', () => {
  test('buildApplyArgs returns apply for All Providers', () => {
    const args = buildApplyArgs('All Providers');
    assert.deepStrictEqual(args, ['apply']);
  });

  test('buildApplyArgs returns --target flag for specific provider', () => {
    const args = buildApplyArgs('claude');
    assert.deepStrictEqual(args, ['apply', '--target', 'claude']);
  });

  test('buildApplyArgs returns --target flag for gemini', () => {
    const args = buildApplyArgs('gemini');
    assert.deepStrictEqual(args, ['apply', '--target', 'gemini']);
  });

  test('strips (deprecated) suffix from provider name', () => {
    const args = buildApplyArgs('antigravity (deprecated)');
    assert.deepStrictEqual(args, ['apply', '--target', 'antigravity']);
  });
});

suite('Tree context menu commands', () => {
  interface PkgMenuItem {
    command: string;
    when: string;
    group: string;
  }

  interface PkgJson {
    contributes: {
      commands: PkgCommand[];
      menus: {
        'view/item/context': PkgMenuItem[];
      };
    };
  }

  let pkg: PkgJson;

  suiteSetup(() => {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PkgJson;
  });

  const CONTEXT_COMMANDS = [
    'xcaffold.openResource',
    'xcaffold.findReferences',
    'xcaffold.newResource',
    'xcaffold.deleteResource',
  ];

  test('package.json defines all tree context menu commands', () => {
    const ids = pkg.contributes.commands.map((c) => c.command);
    for (const cmd of CONTEXT_COMMANDS) {
      assert.ok(ids.includes(cmd), `Missing command: ${cmd}`);
    }
  });

  test('openResource menu item targets resource, override, and artifact-file nodes', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.openResource');
    assert.ok(entry, 'openResource menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == resource || viewItem == override || viewItem == artifact-file');
    assert.strictEqual(entry.group, 'navigation@1');
  });

  test('findReferences menu item targets resource', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.findReferences');
    assert.ok(entry, 'findReferences menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == resource');
    assert.strictEqual(entry.group, 'xcaffold@3');
  });

  test('deleteResource menu item targets resource with high group number', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.deleteResource');
    assert.ok(entry, 'deleteResource menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == resource');
    assert.strictEqual(entry.group, 'xcaffold@9');
  });

  test('newResource menu item targets kind-group in navigation group', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.newResource');
    assert.ok(entry, 'newResource menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == kind-group');
    assert.strictEqual(entry.group, 'navigation@1');
  });

  test('resource context menu has correct ordering', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const resourceItems = items.filter(
      (m) => m.when === 'viewItem == resource',
    );
    const groups = resourceItems.map((m) => m.group);
    assert.ok(
      groups.includes('xcaffold@9'),
      'Delete should have high group number',
    );
  });
});

suite('parseApplyLine', () => {
  test('extracts provider and file count from ok line', () => {
    const line = '  ok  Apply complete. 14 files written to .claude/';
    const result = parseApplyLine(line);
    assert.deepStrictEqual(result, { provider: 'claude', fileCount: 14 });
  });

  test('extracts provider from cursor output', () => {
    const line = '  ok  Apply complete. 8 files written to .cursor/';
    const result = parseApplyLine(line);
    assert.deepStrictEqual(result, { provider: 'cursor', fileCount: 8 });
  });

  test('extracts provider from gemini output', () => {
    const line = '  ok  Apply complete. 3 files written to .gemini/';
    const result = parseApplyLine(line);
    assert.deepStrictEqual(result, { provider: 'gemini', fileCount: 3 });
  });

  test('handles single file written', () => {
    const line = '  ok  Apply complete. 1 file written to .copilot/';
    const result = parseApplyLine(line);
    assert.deepStrictEqual(result, { provider: 'copilot', fileCount: 1 });
  });

  test('handles antigravity provider', () => {
    const line = '  ok  Apply complete. 5 files written to .antigravity/';
    const result = parseApplyLine(line);
    assert.deepStrictEqual(result, { provider: 'antigravity', fileCount: 5 });
  });

  test('returns null for non-matching line', () => {
    const line = 'xcaffold-vscode  .  claude  .  applied just now';
    assert.strictEqual(parseApplyLine(line), null);
  });

  test('returns null for empty string', () => {
    assert.strictEqual(parseApplyLine(''), null);
  });

  test('returns null for header line', () => {
    assert.strictEqual(parseApplyLine('  PROVIDER  FILES  STATUS'), null);
  });
});

suite('parseApplyOutput', () => {
  test('parses multi-provider output', () => {
    const stdout = [
      'xcaffold-vscode  .  claude  .  applied just now',
      '',
      '  ok  Apply complete. 14 files written to .claude/',
      '',
      'xcaffold-vscode  .  cursor  .  applied just now',
      '',
      '  ok  Apply complete. 8 files written to .cursor/',
    ].join('\n');

    const results = parseApplyOutput(stdout);
    assert.strictEqual(results.length, 2);
    assert.deepStrictEqual(results[0], { provider: 'claude', fileCount: 14 });
    assert.deepStrictEqual(results[1], { provider: 'cursor', fileCount: 8 });
  });

  test('returns empty array for output with no completions', () => {
    const stdout = 'xcaffold-vscode  .  claude  .  applied just now\n';
    const results = parseApplyOutput(stdout);
    assert.strictEqual(results.length, 0);
  });

  test('returns empty array for empty string', () => {
    assert.deepStrictEqual(parseApplyOutput(''), []);
  });

  test('parses single-provider output', () => {
    const stdout = '  ok  Apply complete. 14 files written to .claude/\n';
    const results = parseApplyOutput(stdout);
    assert.strictEqual(results.length, 1);
    assert.deepStrictEqual(results[0], { provider: 'claude', fileCount: 14 });
  });
});

suite('Registry commands', () => {
  test('package.json defines all registry commands', () => {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const ids = pkg.contributes.commands.map((c: PkgCommand) => c.command);
    const expected = [
      'xcaffold.registryList',
      'xcaffold.registryAdd',
      'xcaffold.registryRemove',
      'xcaffold.registryPrune',
      'xcaffold.registryInfo',
    ];
    for (const cmd of expected) {
      assert.ok(ids.includes(cmd), `Missing command: ${cmd}`);
    }
  });
});

suite('parseApplyEventLine', () => {
  test('parses valid provider event', () => {
    const line = '{"event":"provider","provider":"claude","displayLabel":"Claude Code","fileCount":12,"outputDir":".claude"}';
    const result = parseApplyEventLine(line);
    assert.ok(result);
    assert.strictEqual(result!.event, 'provider');
    const pe = result as ApplyProviderEvent;
    assert.strictEqual(pe.provider, 'claude');
    assert.strictEqual(pe.fileCount, 12);
  });

  test('parses valid summary event', () => {
    const line = '{"event":"summary","totalProviders":2,"totalFiles":20,"duration":"1.23s"}';
    const result = parseApplyEventLine(line);
    assert.ok(result);
    assert.strictEqual(result!.event, 'summary');
    const se = result as ApplySummaryEvent;
    assert.strictEqual(se.totalProviders, 2);
    assert.strictEqual(se.totalFiles, 20);
  });

  test('returns null for non-JSON line', () => {
    const line = '  ok  Apply complete. 14 files written to .claude/';
    assert.strictEqual(parseApplyEventLine(line), null);
  });

  test('returns null for empty line', () => {
    assert.strictEqual(parseApplyEventLine(''), null);
  });

  test('returns null for JSON without event field', () => {
    const line = '{"foo":"bar"}';
    assert.strictEqual(parseApplyEventLine(line), null);
  });

  test('parses NDJSON stream correctly', () => {
    const lines = [
      '{"event":"provider","provider":"claude","displayLabel":"Claude Code","fileCount":12,"outputDir":".claude"}',
      '{"event":"provider","provider":"cursor","displayLabel":"Cursor","fileCount":8,"outputDir":".cursor"}',
      '{"event":"summary","totalProviders":2,"totalFiles":20,"duration":"0.45s"}',
    ];
    const events = lines.map(l => parseApplyEventLine(l)).filter(Boolean);
    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[0]!.event, 'provider');
    assert.strictEqual(events[1]!.event, 'provider');
    assert.strictEqual(events[2]!.event, 'summary');
  });
});

suite('fetchProviderInfo', () => {
  test('returns provider info with deprecation data', async () => {
    const mockCli = {
      run: async () => ({
        stdout: JSON.stringify({
          project: 'test', blueprint: '', lastApplied: '',
          providers: [
            { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 0, lastApplied: '', outputDir: '.claude' },
            { name: 'antigravity', displayLabel: 'Antigravity', status: 'deprecated', deprecatedBy: 'antigravity2', sunsetDate: '', fileCount: 5, driftCount: 0, lastApplied: '', outputDir: '.antigravity' },
          ],
          sources: { total: 0, changed: 0 },
        }),
      }),
    };
    const info = await fetchProviderInfo(mockCli, '/workspace');
    assert.strictEqual(info.length, 2);
    assert.strictEqual(info[0].deprecated, false);
    assert.strictEqual(info[0].deprecatedBy, '');
    assert.strictEqual(info[1].deprecated, true);
    assert.strictEqual(info[1].deprecatedBy, 'antigravity2');
  });

  test('excludes sunset providers', async () => {
    const mockCli = {
      run: async () => ({
        stdout: JSON.stringify({
          project: 'test', blueprint: '', lastApplied: '',
          providers: [
            { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 0, lastApplied: '', outputDir: '.claude' },
            { name: 'old-provider', displayLabel: 'Old', status: 'sunset', deprecatedBy: 'claude', sunsetDate: '2026-01-01', fileCount: 0, driftCount: 0, lastApplied: '', outputDir: '.old' },
          ],
          sources: { total: 0, changed: 0 },
        }),
      }),
    };
    const info = await fetchProviderInfo(mockCli, '/workspace');
    assert.strictEqual(info.length, 1);
    assert.strictEqual(info[0].name, 'claude');
  });

  test('returns empty array on CLI error', async () => {
    const mockCli = {
      run: async () => { throw new Error('CLI not found'); },
    };
    const info = await fetchProviderInfo(mockCli, '/workspace');
    assert.deepStrictEqual(info, []);
  });
});

suite('buildApplyArgs global scope', () => {
  test('includes --global when globalScope is true', () => {
    const args = buildApplyArgs('claude', { globalScope: true });
    assert.ok(args.includes('--global'));
    assert.deepStrictEqual(args, ['apply', '--target', 'claude', '--global']);
  });

  test('omits --global when globalScope is false', () => {
    const args = buildApplyArgs('claude', { globalScope: false });
    assert.ok(!args.includes('--global'));
  });

  test('omits --global when options not provided', () => {
    const args = buildApplyArgs('claude');
    assert.ok(!args.includes('--global'));
  });

  test('includes --global for All Providers', () => {
    const args = buildApplyArgs('All Providers', { globalScope: true });
    assert.deepStrictEqual(args, ['apply', '--global']);
  });
});

suite('package.json defines toggleGlobalScope command', () => {
  test('toggleGlobalScope command is registered', () => {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const ids = pkg.contributes.commands.map((c: { command: string }) => c.command);
    assert.ok(ids.includes('xcaffold.toggleGlobalScope'), 'Missing toggleGlobalScope command');
  });
});

suite('fetchProviderTargets sunset filtering', () => {
  test('excludes sunset providers from target list', async () => {
    const mockCli = {
      run: async () => ({
        stdout: JSON.stringify({
          project: 'test', blueprint: '', lastApplied: '',
          providers: [
            { name: 'claude', displayLabel: 'Claude Code', status: 'active', deprecatedBy: '', sunsetDate: '', fileCount: 8, driftCount: 0, lastApplied: '', outputDir: '.claude' },
            { name: 'old-provider', displayLabel: 'Old', status: 'sunset', deprecatedBy: '', sunsetDate: '2026-01-01', fileCount: 0, driftCount: 0, lastApplied: '', outputDir: '.old' },
          ],
          sources: { total: 0, changed: 0 },
        }),
      }),
    };
    const targets = await fetchProviderTargets(mockCli, '/workspace');
    assert.ok(targets.includes('claude'));
    assert.ok(!targets.includes('old-provider'));
    assert.strictEqual(targets.length, 2); // All Providers + claude
  });
});

suite('buildApplyArgs CLI flags', () => {
  test('includes --blueprint when set', () => {
    const args = buildApplyArgs('claude', { blueprint: 'production' });
    assert.ok(args.includes('--blueprint'));
    assert.ok(args.includes('production'));
  });

  test('includes --output-dir when set', () => {
    const args = buildApplyArgs('claude', { outputDir: './out' });
    assert.ok(args.includes('--output-dir'));
    assert.ok(args.includes('./out'));
  });

  test('includes --project when set', () => {
    const args = buildApplyArgs('claude', { project: 'my-project' });
    assert.ok(args.includes('--project'));
    assert.ok(args.includes('my-project'));
  });

  test('includes --var-file when set', () => {
    const args = buildApplyArgs('claude', { varFile: 'vars.yaml' });
    assert.ok(args.includes('--var-file'));
    assert.ok(args.includes('vars.yaml'));
  });

  test('omits flags when values are undefined', () => {
    const args = buildApplyArgs('claude', {});
    assert.ok(!args.includes('--blueprint'));
    assert.ok(!args.includes('--output-dir'));
    assert.ok(!args.includes('--project'));
    assert.ok(!args.includes('--var-file'));
  });

  test('combines multiple flags', () => {
    const args = buildApplyArgs('claude', {
      globalScope: true,
      blueprint: 'staging',
      outputDir: './dist',
    });
    assert.ok(args.includes('--global'));
    assert.ok(args.includes('--blueprint'));
    assert.ok(args.includes('staging'));
    assert.ok(args.includes('--output-dir'));
    assert.ok(args.includes('./dist'));
  });
});
