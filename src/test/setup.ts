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
    createWebviewPanel: (viewType: string, title: string, showOptions: any, options: any) => ({
      webview: {
        html: '',
        cspSource: 'https://webview-csp-source',
        asWebviewUri: (uri: any) => uri,
        postMessage: async () => true,
        onDidReceiveMessage: (callback: any) => ({ dispose: () => {} }),
      },
      reveal: () => {},
      dispose: () => {},
      onDidDispose: (callback: any, thisArg?: any, disposables?: any[]) => ({ dispose: () => {} }),
      title: title,
      visible: true,
    }),
  },
  commands: {
    registerCommand: (id: string, callback: any) => ({ dispose: () => {} }),
    executeCommand: async () => {},
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
    constructor(startLine: any, startCol?: any, endLine?: any, endCol?: any) {
      // Handle both Range(startLine, startCol, endLine, endCol) and Range(Position, Position)
      if (typeof startLine === 'object' && typeof startCol === 'object') {
        // Range(Position, Position) case
        this.start = startLine;
        this.end = startCol;
      } else {
        // Range(number, number, number, number) case
        this.start = { line: startLine, character: startCol };
        this.end = { line: endLine, character: endCol };
      }
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
    registerCodeLensProvider: (selector: any, provider: any) => ({ dispose: () => {} }),
    registerDefinitionProvider: (selector: any, provider: any) => ({ dispose: () => {} }),
  },
  Uri: {
    file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
    parse: (s: string) => ({ fsPath: s, scheme: 'file', path: s }),
    joinPath: (base: any, ...segments: string[]) => {
      const joined = [base.fsPath || base.path, ...segments].join('/');
      return { fsPath: joined, scheme: 'file', path: joined };
    },
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  CodeLens: class {
    constructor(
      public range: any,
      public command?: { title: string; command: string; arguments?: any[] },
    ) {}
  },
  Location: class {
    constructor(public uri: any, public range: any) {}
  },
});
