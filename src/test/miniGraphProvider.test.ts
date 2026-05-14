// src/test/miniGraphProvider.test.ts
import * as assert from 'assert';
import {
  extractNeighborhood,
  buildEmptyStateHtml,
} from '../miniGraphProvider';
import type { GraphNode, GraphEdge } from '../webview/graphWebview';

suite('extractNeighborhood', () => {
  const nodes: GraphNode[] = [
    { id: 'agent:a', kind: 'agent', label: 'a' },
    { id: 'rule:r1', kind: 'rule', label: 'r1' },
    { id: 'rule:r2', kind: 'rule', label: 'r2' },
    { id: 'skill:s1', kind: 'skill', label: 's1' },
    { id: 'hook:h1', kind: 'hook', label: 'h1' },
    { id: 'agent:b', kind: 'agent', label: 'b' },
  ];

  const edges: GraphEdge[] = [
    { from: 'agent:a', to: 'rule:r1', label: 'rule' },
    { from: 'agent:a', to: 'skill:s1', label: 'skill' },
    { from: 'agent:b', to: 'rule:r2', label: 'rule' },
    { from: 'hook:h1', to: 'agent:a', label: 'hook' },
  ];

  test('includes center node and outgoing neighbors', () => {
    const result = extractNeighborhood(nodes, edges, 'agent:a');

    assert.strictEqual(result.centerNodeId, 'agent:a');
    const ids = result.nodes.map((n) => n.id).sort();
    // agent:a -> rule:r1, agent:a -> skill:s1, hook:h1 -> agent:a
    assert.deepStrictEqual(ids, [
      'agent:a',
      'hook:h1',
      'rule:r1',
      'skill:s1',
    ]);
  });

  test('includes center node and incoming neighbors', () => {
    // rule:r1 has one incoming edge from agent:a
    const result = extractNeighborhood(nodes, edges, 'rule:r1');

    assert.strictEqual(result.centerNodeId, 'rule:r1');
    const ids = result.nodes.map((n) => n.id).sort();
    assert.deepStrictEqual(ids, ['agent:a', 'rule:r1']);
    assert.strictEqual(result.edges.length, 1);
    assert.strictEqual(result.edges[0].from, 'agent:a');
    assert.strictEqual(result.edges[0].to, 'rule:r1');
  });

  test('handles center node with both incoming and outgoing edges', () => {
    // agent:a has outgoing to rule:r1, skill:s1 and incoming from hook:h1
    const result = extractNeighborhood(nodes, edges, 'agent:a');

    assert.strictEqual(result.edges.length, 3);

    const outgoing = result.edges.filter(
      (e) => e.from === 'agent:a',
    );
    const incoming = result.edges.filter(
      (e) => e.to === 'agent:a',
    );
    assert.strictEqual(outgoing.length, 2);
    assert.strictEqual(incoming.length, 1);
  });

  test('returns only center node when isolated (no edges)', () => {
    const result = extractNeighborhood(nodes, edges, 'agent:b');

    // agent:b has one outgoing edge to rule:r2
    const ids = result.nodes.map((n) => n.id).sort();
    assert.deepStrictEqual(ids, ['agent:b', 'rule:r2']);
    assert.strictEqual(result.edges.length, 1);
  });

  test('returns only center node with no edges when truly isolated', () => {
    const isolatedNodes: GraphNode[] = [
      { id: 'agent:lonely', kind: 'agent', label: 'lonely' },
      { id: 'rule:other', kind: 'rule', label: 'other' },
    ];
    const isolatedEdges: GraphEdge[] = [];

    const result = extractNeighborhood(
      isolatedNodes,
      isolatedEdges,
      'agent:lonely',
    );

    assert.strictEqual(result.nodes.length, 1);
    assert.strictEqual(result.nodes[0].id, 'agent:lonely');
    assert.strictEqual(result.edges.length, 0);
  });

  test('returns empty data when center node is not in graph', () => {
    const result = extractNeighborhood(
      nodes,
      edges,
      'agent:nonexistent',
    );

    assert.strictEqual(result.nodes.length, 0);
    assert.strictEqual(result.edges.length, 0);
    assert.strictEqual(result.centerNodeId, 'agent:nonexistent');
  });

  test('preserves centerNodeId in result', () => {
    const result = extractNeighborhood(nodes, edges, 'skill:s1');
    assert.strictEqual(result.centerNodeId, 'skill:s1');
  });

  test('does not include transitive neighbors', () => {
    // skill:s1 is connected to agent:a
    // agent:a is connected to rule:r1 and hook:h1
    // But from skill:s1 perspective, only agent:a is 1-hop
    const result = extractNeighborhood(nodes, edges, 'skill:s1');

    const ids = result.nodes.map((n) => n.id).sort();
    assert.deepStrictEqual(ids, ['agent:a', 'skill:s1']);
    // rule:r1 and hook:h1 should NOT be included (they are 2-hop)
    assert.ok(
      !ids.includes('rule:r1'),
      'transitive neighbor rule:r1 must not be included',
    );
    assert.ok(
      !ids.includes('hook:h1'),
      'transitive neighbor hook:h1 must not be included',
    );
  });

  test('handles empty node list', () => {
    const result = extractNeighborhood([], edges, 'agent:a');
    assert.strictEqual(result.nodes.length, 0);
    assert.strictEqual(result.edges.length, 0);
  });

  test('handles empty edge list with existing node', () => {
    const result = extractNeighborhood(nodes, [], 'agent:a');
    assert.strictEqual(result.nodes.length, 1);
    assert.strictEqual(result.nodes[0].id, 'agent:a');
    assert.strictEqual(result.edges.length, 0);
  });
});

suite('buildEmptyStateHtml', () => {
  const nonce = 'test-nonce-abc123';

  test('renders placeholder message without full graph link', () => {
    const html = buildEmptyStateHtml(
      'No dependency data available.',
      false,
      nonce,
    );
    assert.ok(
      html.includes('placeholder'),
      'should use placeholder CSS class',
    );
    assert.ok(
      html.includes('No dependency data available.'),
      'should contain the message text',
    );
    assert.ok(
      !html.includes('fullGraphLink'),
      'should not contain the full graph link',
    );
    assert.ok(
      !html.includes('openFullGraph'),
      'should not contain openFullGraph message',
    );
  });

  test('renders placeholder message with full graph link', () => {
    const html = buildEmptyStateHtml(
      'my-agent has no dependencies.',
      true,
      nonce,
    );
    assert.ok(
      html.includes('placeholder'),
      'should use placeholder CSS class',
    );
    assert.ok(
      html.includes('my-agent has no dependencies.'),
      'should contain the message text',
    );
    assert.ok(
      html.includes('fullGraphLink'),
      'should contain the full graph link element',
    );
    assert.ok(
      html.includes('View full graph'),
      'should contain the link text',
    );
    assert.ok(
      html.includes('openFullGraph'),
      'should post openFullGraph command',
    );
  });

  test('escapes HTML in the message text', () => {
    const html = buildEmptyStateHtml(
      '<script>alert("xss")</script>',
      false,
      nonce,
    );
    assert.ok(
      !html.includes('<script>alert'),
      'should not contain unescaped script tag',
    );
    assert.ok(
      html.includes('&lt;script&gt;'),
      'should escape angle brackets',
    );
  });

  test('includes nonce on script tag when link is shown', () => {
    const html = buildEmptyStateHtml('Test message.', true, nonce);
    assert.ok(
      html.includes(`nonce="${nonce}"`),
      'script tag should contain the nonce',
    );
  });
});
