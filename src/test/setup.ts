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
    registerFileDecorationProvider: (provider: any) => ({ dispose: () => {} }),
    registerWebviewViewProvider: (viewId: string, provider: any) => ({ dispose: () => {} }),
    showTextDocument: async () => {},
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
    openTextDocument: async (_uri: any) => ({ getText: () => '' }),
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose: () => {} }),
      onDidChange: () => ({ dispose: () => {} }),
      onDidDelete: () => ({ dispose: () => {} }),
      dispose: () => {},
    }),
    findFiles: async () => [],
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
    dispose() {}
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
    registerDocumentSemanticTokensProvider: (selector: any, provider: any, legend: any) => ({ dispose: () => {} }),
    registerCodeActionsProvider: (selector: any, provider: any, metadata?: any) => ({ dispose: () => {} }),
    onDidChangeDiagnostics: (listener: any) => ({ dispose: () => {} }),
  },
  SemanticTokensLegend: class {
    constructor(public tokenTypes: string[], public tokenModifiers: string[] = []) {}
  },
  SemanticTokensBuilder: class {
    private _legend: any;
    private _data: number[] = [];
    constructor(legend?: any) { this._legend = legend; }
    push(line: number, char: number, length: number, tokenType: number, tokenModifiers?: number): void {
      this._data.push(line, char, length, tokenType, tokenModifiers || 0);
    }
    build(): any { return { data: new Uint32Array(this._data) }; }
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
  ViewColumn: { One: 1, Two: 2, Three: 3, Beside: 4 },
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
  Hover: class {
    constructor(public contents: any, public range?: any) {}
  },
  MarkdownString: class {
    constructor(public value: string = '') {}
    appendMarkdown(val: string) { this.value += val; return this; }
    appendCodeblock(code: string, lang?: string) { this.value += code; return this; }
  },
  Location: class {
    constructor(public uri: any, public range: any) {}
  },
  DocumentSymbol: class {
    public children: any[] = [];
    constructor(
      public name: string,
      public detail: string,
      public kind: number,
      public range: any,
      public selectionRange: any,
    ) {}
  },
  SymbolKind: {
    File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4,
    Method: 5, Property: 6, Field: 7, Constructor: 8, Enum: 9,
    Interface: 10, Function: 11, Variable: 12, Constant: 13,
    String: 14, Number: 15, Boolean: 16, Array: 17, Object: 18,
  },
  CompletionItem: class {
    public detail: string = '';
    public insertText: string = '';
    constructor(public label: string, public kind?: number) {}
  },
  CompletionItemKind: {
    Text: 0, Method: 1, Function: 2, Constructor: 3, Field: 4,
    Variable: 5, Class: 6, Interface: 7, Module: 8, Property: 9,
    Unit: 10, Value: 11, Enum: 12, Keyword: 13, Snippet: 14,
    Color: 15, Reference: 17, File: 16, Folder: 18, EnumMember: 19,
    Constant: 20, Struct: 21, Event: 22, Operator: 23, TypeParameter: 24,
  },
  WorkspaceEdit: class {
    private _edits: Array<{ uri: any; range: any; newText: string }> = [];
    replace(uri: any, range: any, newText: string): void {
      this._edits.push({ uri, range, newText });
    }
    insert(uri: any, position: any, newText: string): void {
      const range = { start: position, end: position };
      this._edits.push({ uri, range, newText });
    }
    get size(): number {
      const uris = new Set(
        this._edits.map(e => e.uri.fsPath || e.uri.toString()),
      );
      return uris.size;
    }
  },
  CodeAction: class {
    public edit: any;
    public isPreferred: boolean = false;
    constructor(public title: string, public kind?: any) {}
  },
  CodeActionKind: {
    QuickFix: { value: 'quickfix', append: (val: string) => ({ value: `quickfix.${val}` }) },
    Refactor: { value: 'refactor', append: (val: string) => ({ value: `refactor.${val}` }) },
  },
});
