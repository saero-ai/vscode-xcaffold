import * as vscode from 'vscode';

/**
 * DiagnosticSummary captures the error and warning counts for a single URI.
 * Used by computeDecoration to determine the appropriate badge.
 */
export interface DiagnosticSummary {
  errorCount: number;
  warningCount: number;
}

/**
 * DecorationResult is the shape returned by computeDecoration when a
 * decoration should be applied (undefined means no decoration).
 */
export interface DecorationResult {
  badge: string;
  color: string;
  tooltip: string;
}

/**
 * computeDecoration is a pure function that maps a DiagnosticSummary to a
 * FileDecoration badge, color, and tooltip. Returns undefined when the file
 * has not been validated (no entry in the diagnostic collection).
 *
 * Priority: errors > warnings > valid.
 */
export function computeDecoration(
  summary: DiagnosticSummary,
): DecorationResult | undefined {
  if (summary.errorCount > 0) {
    return {
      badge: '✗',
      color: 'errorForeground',
      tooltip: `${summary.errorCount} error${summary.errorCount === 1 ? '' : 's'}`,
    };
  }
  if (summary.warningCount > 0) {
    return {
      badge: '⚠',
      color: 'editorWarning.foreground',
      tooltip: `${summary.warningCount} warning${summary.warningCount === 1 ? '' : 's'}`,
    };
  }
  return {
    badge: '✓',
    color: 'charts.green',
    tooltip: 'Validated',
  };
}

/**
 * summarizeDiagnostics counts errors and warnings in a diagnostic array.
 */
export function summarizeDiagnostics(
  diagnostics: readonly vscode.Diagnostic[],
): DiagnosticSummary {
  let errorCount = 0;
  let warningCount = 0;
  for (const d of diagnostics) {
    if (d.severity === vscode.DiagnosticSeverity.Error) {
      errorCount++;
    } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
      warningCount++;
    }
  }
  return { errorCount, warningCount };
}

/**
 * XcafFileDecorationProvider shows validation status badges on .xcaf files
 * in the VS Code file explorer and editor tabs.
 *
 * States:
 * - Green checkmark: validated with no errors or warnings
 * - Red X: one or more validation errors
 * - Yellow warning: warnings only (no errors)
 * - No decoration: file has not been validated yet
 */
export class XcafFileDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private readonly _onDidChangeFileDecorations =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();

  readonly onDidChangeFileDecorations =
    this._onDidChangeFileDecorations.event;

  private readonly _diagnosticCollection: vscode.DiagnosticCollection;

  constructor(diagnosticCollection: vscode.DiagnosticCollection) {
    this._diagnosticCollection = diagnosticCollection;
  }

  /**
   * Called by the diagnostic change listener in extension.ts when
   * xcaf-related diagnostics change.
   */
  onDiagnosticsChanged(uris: vscode.Uri[]): void {
    this._onDidChangeFileDecorations.fire(uris);
  }

  /**
   * provideFileDecoration returns a decoration for the given URI, or
   * undefined if the file should not be decorated.
   */
  provideFileDecoration(
    uri: vscode.Uri,
  ): vscode.FileDecoration | undefined {
    if (!uri.fsPath.endsWith('.xcaf')) {
      return undefined;
    }

    const diagnostics = this._diagnosticCollection.get(uri);
    if (diagnostics === undefined) {
      // File has never been validated — no decoration
      return undefined;
    }

    const summary = summarizeDiagnostics(diagnostics);
    const result = computeDecoration(summary);
    if (!result) {
      return undefined;
    }

    return {
      badge: result.badge,
      color: new vscode.ThemeColor(result.color),
      tooltip: result.tooltip,
    };
  }

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
