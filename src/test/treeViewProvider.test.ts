import * as assert from 'assert';
import { parseListOutput } from '../treeViewProvider';

suite('TreeViewProvider', () => {
  test('parseListOutput parses real xcaffold list output into grouped map', () => {
    // Real xcaffold list output format
    const stdout = [
      'xcaffold  ·  2 agents  ·  1 skills',
      '',
      'AGENTS  (2)',
      '  coder',
      '  reviewer',
      '',
      'SKILLS  (1)',
      '  audit',
    ].join('\n');

    const grouped = parseListOutput(stdout);
    assert.strictEqual(grouped.size, 2);
    assert.ok(grouped.has('AGENTS'));
    assert.ok(grouped.has('SKILLS'));
    
    const agents = grouped.get('AGENTS')!;
    assert.strictEqual(agents.length, 2);
    assert.strictEqual(agents[0], 'coder');
    assert.strictEqual(agents[1], 'reviewer');
  });

  test('parseListOutput handles empty output', () => {
    const grouped = parseListOutput('xcaffold  ·  0 agents\n\nAGENTS  (0)');
    assert.strictEqual(grouped.size, 1); // Group exists but is empty
    assert.strictEqual(grouped.get('AGENTS')?.length, 0);
  });
});
