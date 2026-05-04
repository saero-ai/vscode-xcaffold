import * as assert from 'assert';
import {
  KNOWN_PROVIDER_DIRS,
  detectProviderDirs,
  buildInitArgs,
} from '../initWizardProvider';

suite('InitWizardProvider', () => {
  suite('KNOWN_PROVIDER_DIRS', () => {
    test('includes all supported provider directories', () => {
      const names = KNOWN_PROVIDER_DIRS.map((d) => d.name);
      assert.ok(names.includes('.claude'));
      assert.ok(names.includes('.cursor'));
      assert.ok(names.includes('.github'));
      assert.ok(names.includes('.gemini'));
      assert.ok(names.includes('.agents'));
    });

    test('each entry has a provider label', () => {
      for (const entry of KNOWN_PROVIDER_DIRS) {
        assert.ok(entry.label, `${entry.name} must have a label`);
        assert.ok(entry.name, `entry must have a name`);
      }
    });
  });

  suite('detectProviderDirs', () => {
    test('returns matching entries for existing dirs', () => {
      const existingDirs = ['.claude', '.gemini'];
      const result = detectProviderDirs(existingDirs);
      assert.strictEqual(result.length, 2);
      assert.ok(result.some((r) => r.name === '.claude'));
      assert.ok(result.some((r) => r.name === '.gemini'));
    });

    test('returns empty for no matches', () => {
      const result = detectProviderDirs([]);
      assert.strictEqual(result.length, 0);
    });

    test('ignores unknown directories', () => {
      const result = detectProviderDirs(['.vscode', '.idea', '.claude']);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, '.claude');
    });
  });

  suite('buildInitArgs', () => {
    test('returns bare init when no options provided', () => {
      const args = buildInitArgs();
      assert.deepStrictEqual(args, ['init']);
    });

    test('returns init with --force when force is true', () => {
      const args = buildInitArgs({ force: true });
      assert.deepStrictEqual(args, ['init', '--force']);
    });

    test('returns bare init when force is false', () => {
      const args = buildInitArgs({ force: false });
      assert.deepStrictEqual(args, ['init']);
    });
  });
});
