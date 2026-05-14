import * as assert from 'assert';
import {
  computeRefCounts,
  KIND_COLORS,
  nodeRadius,
  kindColor,
  parseNodeId,
} from '../webview/graphWebview';

suite('GraphProvider HTML', () => {
  test('HTML must not contain CDN script tags', () => {
    const fs = require('fs');
    const path = require('path');
    // Check both graphProvider.ts and graphWebview.ts
    const graphProviderSrc = fs.readFileSync(
      path.join(__dirname, '..', 'graphProvider.ts'),
      'utf8',
    );
    const graphWebviewSrc = fs.readFileSync(
      path.join(__dirname, '..', 'webview', 'graphWebview.ts'),
      'utf8',
    );
    const combined = graphProviderSrc + graphWebviewSrc;
    assert.ok(
      !combined.includes('https://d3js.org'),
      'graph files must not load D3 from CDN — use bundled URI',
    );
    assert.ok(
      !combined.includes('cdn.'),
      'graph files must not load scripts from any CDN',
    );
  });

  test('HTML must use webview.asWebviewUri for D3', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'webview', 'graphWebview.ts'),
      'utf8',
    );
    assert.ok(
      source.includes('asWebviewUri'),
      'graphWebview.ts must use webview.asWebviewUri() to load D3',
    );
  });

  test('tooltip must use esc() for d.kind and d.label', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'webview', 'graphWebview.ts'),
      'utf8',
    );
    assert.ok(
      source.includes('esc(d.kind)'),
      'tooltip must escape d.kind with esc()',
    );
    assert.ok(
      source.includes('esc(d.label'),
      'tooltip must escape d.label with esc()',
    );
  });
});

suite('computeRefCounts', () => {
  test('returns empty map for no edges', () => {
    const result = computeRefCounts([]);
    assert.strictEqual(result.size, 0);
  });

  test('counts incoming edges per node', () => {
    const edges = [
      { from: 'agent:a', to: 'rule:r1' },
      { from: 'agent:b', to: 'rule:r1' },
      { from: 'agent:a', to: 'skill:s1' },
    ];
    const result = computeRefCounts(edges);
    assert.strictEqual(result.get('rule:r1'), 2);
    assert.strictEqual(result.get('skill:s1'), 1);
    assert.strictEqual(result.get('agent:a'), undefined);
  });

  test('handles single edge', () => {
    const edges = [{ from: 'x', to: 'y' }];
    const result = computeRefCounts(edges);
    assert.strictEqual(result.get('y'), 1);
    assert.strictEqual(result.size, 1);
  });
});

suite('KIND_COLORS', () => {
  test('contains all expected kinds', () => {
    const expectedKinds = [
      'agent',
      'skill',
      'rule',
      'workflow',
      'hook',
      'mcp',
    ];
    for (const kind of expectedKinds) {
      assert.ok(
        KIND_COLORS[kind],
        `KIND_COLORS must include "${kind}"`,
      );
    }
  });

  test('all values are valid hex colors', () => {
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    for (const [kind, color] of Object.entries(KIND_COLORS)) {
      assert.ok(
        hexRe.test(color),
        `KIND_COLORS["${kind}"] = "${color}" must be a valid 6-digit hex color`,
      );
    }
  });

  test('agent is blue #4a9eff', () => {
    assert.strictEqual(KIND_COLORS.agent, '#4a9eff');
  });

  test('skill is green #76ff03', () => {
    assert.strictEqual(KIND_COLORS.skill, '#76ff03');
  });

  test('rule is amber #ffab00', () => {
    assert.strictEqual(KIND_COLORS.rule, '#ffab00');
  });
});

suite('nodeRadius', () => {
  test('returns minimum for zero refs', () => {
    assert.strictEqual(nodeRadius(0, 10), 6);
  });

  test('returns maximum for max refs', () => {
    assert.strictEqual(nodeRadius(10, 10), 24);
  });

  test('returns minimum when maxRefCount is zero', () => {
    assert.strictEqual(nodeRadius(0, 0), 6);
  });

  test('returns proportional value for partial refs', () => {
    const result = nodeRadius(5, 10);
    assert.strictEqual(result, 15); // 6 + 0.5 * 18 = 15
  });

  test('returns minimum for negative maxRefCount', () => {
    assert.strictEqual(nodeRadius(0, -1), 6);
  });
});

suite('kindColor', () => {
  test('returns correct color for known kind', () => {
    assert.strictEqual(kindColor('agent'), '#4a9eff');
    assert.strictEqual(kindColor('hook'), '#ff5252');
  });

  test('returns default gray for unknown kind', () => {
    assert.strictEqual(kindColor('unknown'), '#999999');
    assert.strictEqual(kindColor(''), '#999999');
  });
});

suite('parseNodeId', () => {
  test('splits "kind:name" into components', () => {
    const result = parseNodeId('agent:my-agent');
    assert.deepStrictEqual(result, {
      kind: 'agent',
      name: 'my-agent',
    });
  });

  test('handles name with colons', () => {
    const result = parseNodeId('rule:my:complex:name');
    assert.deepStrictEqual(result, {
      kind: 'rule',
      name: 'my:complex:name',
    });
  });

  test('returns undefined for empty string', () => {
    assert.strictEqual(parseNodeId(''), undefined);
  });

  test('returns undefined for id without colon', () => {
    assert.strictEqual(parseNodeId('nocolon'), undefined);
  });

  test('handles colon at start', () => {
    const result = parseNodeId(':name-only');
    assert.deepStrictEqual(result, {
      kind: '',
      name: 'name-only',
    });
  });

  test('handles colon at end', () => {
    const result = parseNodeId('kind:');
    assert.deepStrictEqual(result, {
      kind: 'kind',
      name: '',
    });
  });
});
