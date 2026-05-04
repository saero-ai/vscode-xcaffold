import * as assert from 'assert';
import { detectKindLines, buildCodeLenses } from '../codeLensProvider';

suite('CodeLensProvider', () => {
  suite('detectKindLines', () => {
    test('finds kind: line in frontmatter format', () => {
      const lines = [
        '---',
        'kind: agent',
        'version: "1.0"',
        'name: reviewer',
        '---',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, [{ line: 1, kind: 'agent' }]);
    });

    test('finds kind: line in pure YAML format', () => {
      const lines = [
        'kind: project',
        'version: "1.0"',
        'name: my-project',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, [{ line: 0, kind: 'project' }]);
    });

    test('returns empty array when no kind: line exists', () => {
      const lines = [
        '---',
        'version: "1.0"',
        'name: reviewer',
        '---',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, []);
    });

    test('ignores kind: inside body (after second ---)', () => {
      const lines = [
        '---',
        'kind: agent',
        'version: "1.0"',
        '---',
        'Use kind: skill for skills.',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, [{ line: 1, kind: 'agent' }]);
    });

    test('handles kind: with extra whitespace', () => {
      const lines = [
        '---',
        'kind:   workflow  ',
        '---',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, [{ line: 1, kind: 'workflow' }]);
    });

    test('ignores commented-out kind: lines', () => {
      const lines = [
        '---',
        '# kind: agent',
        'kind: skill',
        '---',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, [{ line: 2, kind: 'skill' }]);
    });

    test('ignores indented kind: lines (nested YAML)', () => {
      const lines = [
        '---',
        'kind: project',
        'agents:',
        '  reviewer:',
        '    kind: agent',
        '---',
      ];
      const result = detectKindLines(lines);
      assert.deepStrictEqual(result, [{ line: 1, kind: 'project' }]);
    });
  });

  suite('buildCodeLenses', () => {
    test('returns two CodeLens per kind: line (Apply and Validate)', () => {
      const kindLines = [{ line: 1, kind: 'agent' }];
      const lenses = buildCodeLenses(kindLines);
      assert.strictEqual(lenses.length, 2);
    });

    test('Apply CodeLens targets xcaffold.apply command', () => {
      const kindLines = [{ line: 3, kind: 'skill' }];
      const lenses = buildCodeLenses(kindLines);
      const applyLens = lenses.find((l: any) => l.command?.title === 'Apply');
      assert.ok(applyLens, 'Apply CodeLens must exist');
      assert.strictEqual(applyLens!.command!.command, 'xcaffold.apply');
    });

    test('Validate CodeLens targets xcaffold.validate command', () => {
      const kindLines = [{ line: 3, kind: 'skill' }];
      const lenses = buildCodeLenses(kindLines);
      const validateLens = lenses.find((l: any) => l.command?.title === 'Validate');
      assert.ok(validateLens, 'Validate CodeLens must exist');
      assert.strictEqual(validateLens!.command!.command, 'xcaffold.validate');
    });

    test('CodeLens range starts at the kind: line', () => {
      const kindLines = [{ line: 5, kind: 'rule' }];
      const lenses = buildCodeLenses(kindLines);
      for (const lens of lenses) {
        // Range is a mock class that has start/end with line/character properties
        assert.strictEqual((lens.range.start as any).line, 5);
        assert.strictEqual((lens.range.start as any).character, 0);
      }
    });

    test('returns empty array for no kind lines', () => {
      const lenses = buildCodeLenses([]);
      assert.deepStrictEqual(lenses, []);
    });
  });
});
