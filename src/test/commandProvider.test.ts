import * as assert from 'assert';
import {
  XCAFFOLD_COMMANDS,
  PROVIDER_TARGETS,
  buildApplyArgs,
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
