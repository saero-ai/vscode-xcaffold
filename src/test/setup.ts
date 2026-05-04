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
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    withProgress: (options: any, task: any) => task(),
  },
  commands: {
    registerCommand: (id: string, callback: any) => ({ dispose: () => {} }),
  },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({
      get: (key: string, defaultValue: any) => defaultValue,
    }),
  },
  Range: class {
    public start: { line: number; character: number };
    public end: { line: number; character: number };
    constructor(startLine: number, startCol: number, endLine: number, endCol: number) {
      this.start = { line: startLine, character: startCol };
      this.end = { line: endLine, character: endCol };
    }
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
