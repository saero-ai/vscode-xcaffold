// src/graphProvider.ts
//
// Thin wrapper around GraphWebview for backwards compatibility.
// The interactive D3 force-directed graph logic lives in
// src/webview/graphWebview.ts.

import * as vscode from 'vscode';
import { DataSource } from './webview/dataSource';
import { GraphWebview } from './webview/graphWebview';
import { XcafIndex } from './xcafIndex';

/**
 * XcaffoldGraphProvider wraps GraphWebview and provides a static
 * `show()` entry point compatible with the existing command registration.
 */
export class XcaffoldGraphProvider {
  private static instance: GraphWebview | undefined;

  static show(
    dataSource: DataSource,
    workspaceFolder: string,
    extensionUri: vscode.Uri,
    xcafIndex: XcafIndex,
  ): void {
    if (!XcaffoldGraphProvider.instance) {
      XcaffoldGraphProvider.instance = new GraphWebview(
        extensionUri,
        dataSource,
        workspaceFolder,
        xcafIndex,
        () => XcaffoldGraphProvider.reset(),
      );
    }
    XcaffoldGraphProvider.instance.show();
  }

  /** Reset the singleton (used internally by dispose). */
  static reset(): void {
    XcaffoldGraphProvider.instance = undefined;
  }
}
