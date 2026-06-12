import * as assert from 'assert';
import { parseVersion, isVersionSatisfied, getCliNotFoundMessage, INSTALL_GUIDE_URL } from '../versionCheck';

suite('Version Check', () => {
  suite('parseVersion', () => {
    test('parses standard semver', () => {
      const v = parseVersion('0.5.0');
      assert.deepStrictEqual(v, { major: 0, minor: 5, patch: 0 });
    });

    test('parses version with v prefix', () => {
      const v = parseVersion('v1.2.3');
      assert.deepStrictEqual(v, { major: 1, minor: 2, patch: 3 });
    });

    test('parses version from multi-line output', () => {
      const v = parseVersion('xcaffold version 0.7.1\nbuilt 2026-05-01');
      assert.deepStrictEqual(v, { major: 0, minor: 7, patch: 1 });
    });

    test('returns null for unparseable input', () => {
      assert.strictEqual(parseVersion('not a version'), null);
      assert.strictEqual(parseVersion(''), null);
    });
  });

  suite('getCliNotFoundMessage', () => {
    test('includes install methods and the installation guide', () => {
      const message = getCliNotFoundMessage('0.5.0');

      assert.ok(message.includes('xcaffold binary was not found on PATH'));
      assert.ok(message.includes('brew install saero-ai/tap/xcaffold'));
      assert.ok(message.includes('go install github.com/saero-ai/xcaffold@latest'));
      assert.ok(message.includes(INSTALL_GUIDE_URL));
    });
  });

  suite('isVersionSatisfied', () => {
    test('returns true when version meets minimum', () => {
      assert.strictEqual(
        isVersionSatisfied({ major: 0, minor: 5, patch: 0 }, '0.5.0'),
        true
      );
      assert.strictEqual(
        isVersionSatisfied({ major: 1, minor: 0, patch: 0 }, '0.5.0'),
        true
      );
      assert.strictEqual(
        isVersionSatisfied({ major: 0, minor: 6, patch: 0 }, '0.5.0'),
        true
      );
    });

    test('returns false when version is below minimum', () => {
      assert.strictEqual(
        isVersionSatisfied({ major: 0, minor: 4, patch: 9 }, '0.5.0'),
        false
      );
      assert.strictEqual(
        isVersionSatisfied({ major: 0, minor: 0, patch: 1 }, '0.5.0'),
        false
      );
    });

    test('handles patch-level comparison', () => {
      assert.strictEqual(
        isVersionSatisfied({ major: 0, minor: 5, patch: 1 }, '0.5.0'),
        true
      );
      assert.strictEqual(
        isVersionSatisfied({ major: 0, minor: 5, patch: 0 }, '0.5.1'),
        false
      );
    });
  });
});
