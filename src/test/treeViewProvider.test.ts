import * as assert from 'assert';
import { parseListOutput } from '../treeViewProvider';

suite('TreeViewProvider', () => {
  test('parseListOutput parses xcaffold list output into grouped map', () => {
    // xcaffold list output format: KIND | NAME | DESCRIPTION
    const stdout = [
      'KIND | NAME | DESCRIPTION',
      '---- | ---- | -----------',
      'agent | coder | Primary coding assistant',
      'agent | reviewer | Security review specialist',
      'skill | audit | Security audit procedure',
    ].join('\n');

    const grouped = parseListOutput(stdout);
    assert.strictEqual(grouped.size, 2);
    assert.ok(grouped.has('agent'));
    assert.ok(grouped.has('skill'));
    
    const agents = grouped.get('agent')!;
    assert.strictEqual(agents.length, 2);
    assert.strictEqual(agents[0].name, 'coder');
    assert.strictEqual(agents[1].name, 'reviewer');
  });

  test('parseListOutput handles empty output', () => {
    const grouped = parseListOutput('KIND | NAME | DESCRIPTION\n---- | ---- | -----------');
    assert.strictEqual(grouped.size, 0);
  });
});
