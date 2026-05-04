// src/test/setup.ts
import mock = require('mock-require');

// Mock vscode module
mock('vscode', {
  window: {
    createOutputChannel: (name: string) => ({
      name,
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
    }),
  },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({
      get: (key: string, defaultValue: any) => defaultValue,
    }),
  },
  Range: class {
    constructor(public startLine: number, public startCol: number, public endLine: number, public endCol: number) {}
  },
  Diagnostic: class {
    constructor(public range: any, public message: string, public severity: number) {}
  },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  Disposable: {
    from: (...disposables: any[]) => ({ dispose: () => {} }),
  },
  languages: {
    createDiagnosticCollection: (name: string) => ({
      name,
      set: () => {},
      delete: () => {},
      clear: () => {},
      dispose: () => {},
    }),
  },
});
