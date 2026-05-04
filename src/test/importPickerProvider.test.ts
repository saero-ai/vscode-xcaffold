import * as assert from 'assert';
import {
  buildImportArgs,
  createPickerItems,
} from '../importPickerProvider';
import { ProviderDirEntry } from '../initWizardProvider';

suite('ImportPickerProvider', () => {
  suite('createPickerItems', () => {
    test('creates labeled items from detected provider dirs', () => {
      const detected: ProviderDirEntry[] = [
        { name: '.claude', label: 'Claude Code' },
        { name: '.gemini', label: 'Gemini CLI' },
      ];

      const items = createPickerItems(detected);
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[0].label, 'Claude Code');
      assert.strictEqual(items[0].detail, '.claude/');
      assert.strictEqual(items[1].label, 'Gemini CLI');
      assert.strictEqual(items[1].detail, '.gemini/');
    });

    test('returns empty array for no detected providers', () => {
      const items = createPickerItems([]);
      assert.strictEqual(items.length, 0);
    });
  });

  suite('buildImportArgs', () => {
    test('returns bare import for empty selection', () => {
      const args = buildImportArgs([]);
      assert.deepStrictEqual(args, ['import']);
    });

    test('returns import with --provider for single selection', () => {
      const args = buildImportArgs(['.claude']);
      assert.deepStrictEqual(args, ['import', '--provider', 'claude']);
    });

    test('returns import with --provider for multiple selections', () => {
      const args = buildImportArgs(['.claude', '.gemini']);
      assert.deepStrictEqual(args, [
        'import',
        '--provider', 'claude',
        '--provider', 'gemini',
      ]);
    });

    test('strips leading dot from directory name for provider flag', () => {
      const args = buildImportArgs(['.cursor']);
      assert.deepStrictEqual(args, ['import', '--provider', 'cursor']);
    });

    test('handles .github -> copilot provider mapping', () => {
      const args = buildImportArgs(['.github']);
      assert.deepStrictEqual(args, ['import', '--provider', 'copilot']);
    });

    test('handles .agents -> agents provider mapping', () => {
      const args = buildImportArgs(['.agents']);
      assert.deepStrictEqual(args, ['import', '--provider', 'agents']);
    });
  });
});
