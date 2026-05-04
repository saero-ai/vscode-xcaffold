import * as assert from 'assert';

suite('GraphProvider HTML', () => {
  test('HTML must not contain CDN script tags', () => {
    // Read the graphProvider source to verify no CDN URLs remain
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'graphProvider.ts'),
      'utf8'
    );
    assert.ok(
      !source.includes('https://d3js.org'),
      'graphProvider.ts must not load D3 from CDN — use bundled URI'
    );
    assert.ok(
      !source.includes('cdn.'),
      'graphProvider.ts must not load scripts from any CDN'
    );
  });

  test('HTML must use webview.asWebviewUri for D3', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'graphProvider.ts'),
      'utf8'
    );
    assert.ok(
      source.includes('asWebviewUri'),
      'graphProvider.ts must use webview.asWebviewUri() to load D3'
    );
  });
});
