import * as assert from 'assert';
import { XCAFFOLD_COMMANDS } from '../commandProvider';

suite('CommandProvider', () => {
  test('XCAFFOLD_COMMANDS defines all required command IDs', () => {
    const ids = XCAFFOLD_COMMANDS.map(c => c.id);
    assert.ok(ids.includes('xcaffold.apply'));
    assert.ok(ids.includes('xcaffold.validate'));
    assert.ok(ids.includes('xcaffold.status'));
    assert.ok(ids.includes('xcaffold.list'));
    assert.ok(ids.includes('xcaffold.graph'));
    assert.ok(ids.includes('xcaffold.import'));
  });
});
