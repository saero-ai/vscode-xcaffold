import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  XCAFFOLD_COMMANDS,
  PROVIDER_TARGETS,
  buildApplyArgs,
  parseApplyLine,
  parseApplyOutput,
} from '../commandProvider';

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

suite('Target-filtered apply', () => {
  test('PROVIDER_TARGETS includes all supported providers', () => {
    assert.ok(PROVIDER_TARGETS.includes('claude'));
    assert.ok(PROVIDER_TARGETS.includes('cursor'));
    assert.ok(PROVIDER_TARGETS.includes('copilot'));
    assert.ok(PROVIDER_TARGETS.includes('gemini'));
    assert.ok(PROVIDER_TARGETS.includes('antigravity'));
  });

  test('PROVIDER_TARGETS has All Providers as first element', () => {
    assert.strictEqual(PROVIDER_TARGETS[0], 'All Providers');
  });

  test('buildApplyArgs returns bare apply for All Providers', () => {
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
});

suite('Tree context menu commands', () => {
  interface PkgCommand {
    command: string;
    title: string;
  }

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

  test('openResource menu item targets resource-item in navigation group', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.openResource');
    assert.ok(entry, 'openResource menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == resource-item');
    assert.strictEqual(entry.group, 'navigation@1');
  });

  test('findReferences menu item targets resource-item', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.findReferences');
    assert.ok(entry, 'findReferences menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == resource-item');
    assert.strictEqual(entry.group, 'xcaffold@3');
  });

  test('deleteResource menu item targets resource-item with high group number', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.deleteResource');
    assert.ok(entry, 'deleteResource menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == resource-item');
    assert.strictEqual(entry.group, 'xcaffold@9');
  });

  test('newResource menu item targets kind-group in navigation group', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const entry = items.find((m) => m.command === 'xcaffold.newResource');
    assert.ok(entry, 'newResource menu entry missing');
    assert.strictEqual(entry.when, 'viewItem == kind-group');
    assert.strictEqual(entry.group, 'navigation@1');
  });

  test('resource-item context menu has correct ordering', () => {
    const items = pkg.contributes.menus['view/item/context'];
    const resourceItems = items.filter(
      (m) => m.when === 'viewItem == resource-item',
    );
    const groups = resourceItems.map((m) => m.group);
    assert.ok(
      groups.includes('navigation@1'),
      'Open File should be in navigation group',
    );
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
