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
    showQuickPick: async (items: any[], _options?: any) => items[0],
    activeTextEditor: undefined as any,
    createStatusBarItem: (alignment?: number, priority?: number) => ({
      alignment: alignment || 1,
      priority: priority || 0,
      text: '',
      tooltip: '',
      command: undefined as any,
      name: '',
      backgroundColor: undefined as any,
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
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
  TreeItem: class {
    constructor(public label: string, public collapsibleState: number) {}
    public tooltip: string = '';
    public contextValue: string = '';
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: class {
    private _event = () => {};
    get event() { return this._event; }
    fire() {}
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
  Uri: {
    file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
    parse: (str: string) => ({ fsPath: str, scheme: 'file', path: str }),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ThemeColor: class {
    constructor(public id: string) {}
  },
});
