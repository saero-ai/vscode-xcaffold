import * as assert from 'assert';
import { generateNonce, buildCsp, wrapHtml } from '../webview/baseWebview';

suite('BaseWebview utilities', () => {
  suite('generateNonce', () => {
    test('returns a 32-character alphanumeric string', () => {
      const nonce = generateNonce();
      assert.strictEqual(nonce.length, 32);
      assert.ok(/^[A-Za-z0-9]+$/.test(nonce));
    });

    test('returns different values on successive calls', () => {
      const a = generateNonce();
      const b = generateNonce();
      assert.notStrictEqual(a, b);
    });
  });

  suite('buildCsp', () => {
    test('includes nonce in script-src', () => {
      const csp = buildCsp('https://webview-csp-source', 'abc123');
      assert.ok(csp.includes("'nonce-abc123'"));
      assert.ok(csp.includes('script-src'));
    });

    test('includes cspSource in style-src', () => {
      const csp = buildCsp('https://webview-csp-source', 'abc123');
      assert.ok(csp.includes('https://webview-csp-source'));
      assert.ok(csp.includes('style-src'));
    });

    test('default-src is none', () => {
      const csp = buildCsp('https://webview-csp-source', 'abc123');
      assert.ok(csp.includes("default-src 'none'"));
    });
  });

  suite('wrapHtml', () => {
    test('wraps body content with full HTML document', () => {
      const html = wrapHtml({
        title: 'Test',
        cspSource: 'https://webview-csp-source',
        body: '<div>hello</div>',
        scripts: [],
        styles: '',
      });
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('<div>hello</div>'));
      assert.ok(html.includes('<title>Test</title>'));
    });

    test('includes CSP meta tag', () => {
      const html = wrapHtml({
        title: 'Test',
        cspSource: 'https://webview-csp-source',
        body: '',
        scripts: [],
        styles: '',
      });
      assert.ok(html.includes('Content-Security-Policy'));
      assert.ok(html.includes("default-src 'none'"));
    });

    test('includes script tags with nonce', () => {
      const html = wrapHtml({
        title: 'Test',
        cspSource: 'https://webview-csp-source',
        body: '',
        scripts: [{ uri: 'https://file+.vscode/d3.js' }],
        styles: '',
      });
      assert.ok(html.includes('nonce-'));
      assert.ok(html.includes('https://file+.vscode/d3.js'));
    });

    test('includes inline styles', () => {
      const html = wrapHtml({
        title: 'Test',
        cspSource: 'https://webview-csp-source',
        body: '',
        scripts: [],
        styles: '.my-class { color: red; }',
      });
      assert.ok(html.includes('.my-class { color: red; }'));
    });

    test('uses VS Code CSS variables for dark theme', () => {
      const html = wrapHtml({
        title: 'Test',
        cspSource: 'https://webview-csp-source',
        body: '',
        scripts: [],
        styles: '',
      });
      assert.ok(html.includes('--vscode-editor-background'));
      assert.ok(html.includes('--vscode-editor-foreground'));
    });
  });
});
