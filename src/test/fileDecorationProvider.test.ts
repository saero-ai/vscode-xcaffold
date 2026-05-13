import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  computeDecoration,
  summarizeDiagnostics,
  XcafFileDecorationProvider,
} from '../fileDecorationProvider';

suite('FileDecorationProvider', () => {
  suite('computeDecoration', () => {
    test('returns green checkmark for 0 errors and 0 warnings', () => {
      const result = computeDecoration({ errorCount: 0, warningCount: 0 });
      assert.ok(result);
      assert.strictEqual(result.badge, '✓');
      assert.strictEqual(result.color, 'charts.green');
      assert.strictEqual(result.tooltip, 'Validated');
    });

    test('returns red X for 1+ errors', () => {
      const result = computeDecoration({ errorCount: 3, warningCount: 0 });
      assert.ok(result);
      assert.strictEqual(result.badge, '✗');
      assert.strictEqual(result.color, 'errorForeground');
      assert.strictEqual(result.tooltip, '3 errors');
    });

    test('returns yellow warning for 0 errors and 1+ warnings', () => {
      const result = computeDecoration({ errorCount: 0, warningCount: 2 });
      assert.ok(result);
      assert.strictEqual(result.badge, '⚠');
      assert.strictEqual(result.color, 'editorWarning.foreground');
      assert.strictEqual(result.tooltip, '2 warnings');
    });

    test('errors take priority over warnings', () => {
      const result = computeDecoration({ errorCount: 1, warningCount: 5 });
      assert.ok(result);
      assert.strictEqual(result.badge, '✗');
      assert.strictEqual(result.color, 'errorForeground');
      assert.strictEqual(result.tooltip, '1 error');
    });

    test('singular tooltip for 1 error', () => {
      const result = computeDecoration({ errorCount: 1, warningCount: 0 });
      assert.ok(result);
      assert.strictEqual(result.tooltip, '1 error');
    });

    test('singular tooltip for 1 warning', () => {
      const result = computeDecoration({ errorCount: 0, warningCount: 1 });
      assert.ok(result);
      assert.strictEqual(result.tooltip, '1 warning');
    });
  });

  suite('summarizeDiagnostics', () => {
    test('counts errors and warnings correctly', () => {
      const diagnostics: vscode.Diagnostic[] = [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'error one',
          vscode.DiagnosticSeverity.Error,
        ),
        new vscode.Diagnostic(
          new vscode.Range(1, 0, 1, 1),
          'warning one',
          vscode.DiagnosticSeverity.Warning,
        ),
        new vscode.Diagnostic(
          new vscode.Range(2, 0, 2, 1),
          'error two',
          vscode.DiagnosticSeverity.Error,
        ),
        new vscode.Diagnostic(
          new vscode.Range(3, 0, 3, 1),
          'info one',
          vscode.DiagnosticSeverity.Information,
        ),
      ];
      const summary = summarizeDiagnostics(diagnostics);
      assert.strictEqual(summary.errorCount, 2);
      assert.strictEqual(summary.warningCount, 1);
    });

    test('returns zero counts for empty diagnostics', () => {
      const summary = summarizeDiagnostics([]);
      assert.strictEqual(summary.errorCount, 0);
      assert.strictEqual(summary.warningCount, 0);
    });
  });

  suite('XcafFileDecorationProvider', () => {
    function createMockCollection(): vscode.DiagnosticCollection & {
      _store: Map<string, vscode.Diagnostic[]>;
    } {
      const store = new Map<string, vscode.Diagnostic[]>();
      return {
        name: 'test',
        _store: store,
        set: (uri: any, diagnostics: any) => {
          store.set(uri.fsPath || uri.toString(), diagnostics);
        },
        get: (uri: any): vscode.Diagnostic[] | undefined => {
          return store.get(uri.fsPath || uri.toString());
        },
        delete: (uri: any) => {
          store.delete(uri.fsPath || uri.toString());
        },
        clear: () => store.clear(),
        has: (uri: any) => store.has(uri.fsPath || uri.toString()),
        dispose: () => {},
        forEach: (
          callback: (
            uri: vscode.Uri,
            diagnostics: readonly vscode.Diagnostic[],
            collection: vscode.DiagnosticCollection,
          ) => void,
        ) => {},
        [Symbol.iterator]: function* () {},
      } as unknown as vscode.DiagnosticCollection & {
        _store: Map<string, vscode.Diagnostic[]>;
      };
    }

    test('returns undefined for non-xcaf files', () => {
      const collection = createMockCollection();
      const provider = new XcafFileDecorationProvider(collection);
      const uri = vscode.Uri.file('/workspace/readme.md');
      const result = provider.provideFileDecoration(uri);
      assert.strictEqual(result, undefined);
      provider.dispose();
    });

    test('returns undefined for unvalidated xcaf files', () => {
      const collection = createMockCollection();
      const provider = new XcafFileDecorationProvider(collection);
      const uri = vscode.Uri.file('/workspace/agent.xcaf');
      const result = provider.provideFileDecoration(uri);
      assert.strictEqual(result, undefined);
      provider.dispose();
    });

    test('returns green decoration for validated xcaf file with no diagnostics', () => {
      const collection = createMockCollection();
      const uri = vscode.Uri.file('/workspace/agent.xcaf');
      collection.set(uri, []);
      const provider = new XcafFileDecorationProvider(collection);
      const result = provider.provideFileDecoration(uri);
      assert.ok(result);
      assert.strictEqual(result.badge, '✓');
      assert.strictEqual(result.tooltip, 'Validated');
      provider.dispose();
    });

    test('returns red decoration for xcaf file with errors', () => {
      const collection = createMockCollection();
      const uri = vscode.Uri.file('/workspace/agent.xcaf');
      collection.set(uri, [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'bad field',
          vscode.DiagnosticSeverity.Error,
        ),
      ]);
      const provider = new XcafFileDecorationProvider(collection);
      const result = provider.provideFileDecoration(uri);
      assert.ok(result);
      assert.strictEqual(result.badge, '✗');
      assert.strictEqual(result.tooltip, '1 error');
      provider.dispose();
    });

    test('returns yellow decoration for xcaf file with warnings only', () => {
      const collection = createMockCollection();
      const uri = vscode.Uri.file('/workspace/agent.xcaf');
      collection.set(uri, [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'deprecated field',
          vscode.DiagnosticSeverity.Warning,
        ),
        new vscode.Diagnostic(
          new vscode.Range(1, 0, 1, 1),
          'another warning',
          vscode.DiagnosticSeverity.Warning,
        ),
      ]);
      const provider = new XcafFileDecorationProvider(collection);
      const result = provider.provideFileDecoration(uri);
      assert.ok(result);
      assert.strictEqual(result.badge, '⚠');
      assert.strictEqual(result.tooltip, '2 warnings');
      provider.dispose();
    });
  });
});
