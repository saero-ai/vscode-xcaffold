import * as assert from 'assert';
import { validateResourceName } from '../renameProvider';

suite('RenameProvider', () => {
  suite('validateResourceName', () => {
    test('accepts lowercase hyphenated name', () => {
      const result = validateResourceName('my-agent');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.reason, undefined);
    });

    test('accepts name with digits and hyphens', () => {
      const result = validateResourceName('vscode-test-dev');
      assert.strictEqual(result.valid, true);
    });

    test('accepts short alphanumeric name', () => {
      const result = validateResourceName('a1');
      assert.strictEqual(result.valid, true);
    });

    test('accepts single character name', () => {
      const result = validateResourceName('a');
      assert.strictEqual(result.valid, true);
    });

    test('rejects uppercase letters', () => {
      const result = validateResourceName('MyAgent');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason);
    });

    test('rejects underscores', () => {
      const result = validateResourceName('my_agent');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason);
    });

    test('rejects spaces', () => {
      const result = validateResourceName('my agent');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason);
    });

    test('rejects empty string', () => {
      const result = validateResourceName('');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, 'Name must not be empty');
    });

    test('rejects trailing hyphen', () => {
      const result = validateResourceName('123-');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason!.includes('hyphen'));
    });

    test('rejects leading hyphen', () => {
      const result = validateResourceName('-abc');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason!.includes('hyphen'));
    });
  });
});
