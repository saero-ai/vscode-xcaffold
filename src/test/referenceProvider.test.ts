import * as assert from 'assert';
import { findReferencesInText, TextReference } from '../referenceProvider';

suite('ReferenceProvider', () => {
  suite('findReferencesInText', () => {
    test('finds name in inline array', () => {
      const text = 'skills: [my-skill, other]';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].line, 0);
      assert.strictEqual(refs[0].startChar, 9);
      assert.strictEqual(refs[0].endChar, 17);
    });

    test('finds name in dash list', () => {
      const text = 'skills:\n  - my-skill\n  - other';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].line, 1);
      assert.strictEqual(refs[0].startChar, 4);
      assert.strictEqual(refs[0].endChar, 12);
    });

    test('finds name in name field', () => {
      const text = 'kind: skill\nname: my-skill\ndescription: a skill';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].line, 1);
      assert.strictEqual(refs[0].startChar, 6);
      assert.strictEqual(refs[0].endChar, 14);
    });

    test('does NOT match substrings', () => {
      const text = 'agents: [vscode-extension-dev]\nname: vscode-extension-dev';
      const refs = findReferencesInText(text, 'dev');
      assert.strictEqual(refs.length, 0);
    });

    test('does NOT match partial prefix', () => {
      const text = 'skills: [my-skill-extended]';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 0);
    });

    test('does NOT match in comment lines', () => {
      const text = '# my-skill is great\nskills: [other]';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 0);
    });

    test('skips indented comment lines', () => {
      const text = '  # reference my-skill here\nskills: [my-skill]';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].line, 1);
    });

    test('returns empty for no matches', () => {
      const text = 'kind: agent\nname: reviewer\nskills: [tdd]';
      const refs = findReferencesInText(text, 'nonexistent');
      assert.strictEqual(refs.length, 0);
    });

    test('returns empty for empty resource name', () => {
      const text = 'skills: [my-skill]';
      const refs = findReferencesInText(text, '');
      assert.strictEqual(refs.length, 0);
    });

    test('finds multiple matches in one file', () => {
      const text = [
        'kind: agent',
        'name: reviewer',
        'skills: [tdd, code-review]',
        'description: uses tdd for quality',
      ].join('\n');
      const refs = findReferencesInText(text, 'tdd');
      assert.strictEqual(refs.length, 2);
      assert.strictEqual(refs[0].line, 2);
      assert.strictEqual(refs[1].line, 3);
    });

    test('matches name surrounded by brackets', () => {
      const text = 'skills: [tdd]';
      const refs = findReferencesInText(text, 'tdd');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].startChar, 9);
      assert.strictEqual(refs[0].endChar, 12);
    });

    test('matches name surrounded by commas and spaces', () => {
      const text = 'skills: [first, tdd, last]';
      const refs = findReferencesInText(text, 'tdd');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].startChar, 16);
      assert.strictEqual(refs[0].endChar, 19);
    });

    test('matches quoted name', () => {
      const text = 'skills: ["my-skill"]';
      const refs = findReferencesInText(text, 'my-skill');
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].startChar, 10);
      assert.strictEqual(refs[0].endChar, 18);
    });
  });
});
