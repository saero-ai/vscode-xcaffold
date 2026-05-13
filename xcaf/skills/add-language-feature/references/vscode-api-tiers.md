# VS Code Language API Tiers

Reference for selecting which VS Code language feature API to implement in the xcaffold extension. Tiers indicate implementation priority based on user value and architectural readiness.

## Tier 1 — High Priority

These APIs have the highest direct value for xcaf file authoring. Implement these first.

| API | Interface | Description |
|---|---|---|
| CompletionItemProvider | `vscode.CompletionItemProvider` | Auto-complete xcaf field names, kinds, and enum values as the user types |
| HoverProvider | `vscode.HoverProvider` | Show field documentation when the user hovers over a field name or value |
| DocumentSymbolProvider | `vscode.DocumentSymbolProvider` | Populate the Outline view with the xcaf resource structure (kind, name, fields) |
| WorkspaceSymbolProvider | `vscode.WorkspaceSymbolProvider` | Jump to any xcaf resource by name across all files in the workspace |
| ReferenceProvider | `vscode.ReferenceProvider` | Find all xcaf files that reference a given resource name |
| RenameProvider | `vscode.RenameProvider` | Rename a resource and update all cross-file references atomically |
| CodeActionProvider | `vscode.CodeActionProvider` | Offer quick-fix actions for validation errors; suggest common transforms |
| SemanticTokensProvider | `vscode.DocumentSemanticTokensProvider` | Semantic syntax highlighting beyond what TextMate regex grammars can express |
| FileDecorationProvider | `vscode.FileDecorationProvider` | Badge xcaf files in the Explorer with their validation status (pass/error/warning) |
| DocumentFormattingEditProvider | `vscode.DocumentFormattingEditProvider` | Format xcaf files: normalize YAML indentation, sort fields by schema order |

## Tier 2 — Medium Priority

Useful additions after Tier 1 is complete. Adds polish and workflow integration.

| API | Interface | Description |
|---|---|---|
| WebviewView | `vscode.WebviewViewProvider` | Sidebar panel showing live validation results and resource summary |
| FoldingRangeProvider | `vscode.FoldingRangeProvider` | Collapse large xcaf blocks (e.g., agent body, long description fields) |
| DocumentLinkProvider | `vscode.DocumentLinkProvider` | Make resource name references in xcaf files clickable for navigation |
| InlayHintsProvider | `vscode.InlayHintsProvider` | Show expected field types inline next to field values |
| TaskProvider | `vscode.TaskProvider` | Register xcaffold CLI commands (apply, validate, status) as VS Code tasks |

## Tier 3 — Future

Exploratory capabilities. Requires VS Code API maturity and design work before implementation.

| API | Interface | Description |
|---|---|---|
| ChatParticipant | `vscode.chat.createChatParticipant` | `@xcaffold` AI assistant in VS Code Chat for authoring help |
| CustomTextEditorProvider | `vscode.CustomTextEditorProvider` | Visual form-based editor overlay for xcaf files instead of raw YAML |

## Provider Registration Reference

All language feature providers are registered in `src/extension.ts` inside the `activate()` function using `vscode.languages.register<Type>Provider`. The document selector for all xcaf providers is:

```ts
{ scheme: 'file', pattern: '**/*.xcaf' }
```

Every registration returns a `vscode.Disposable` that must be pushed to `context.subscriptions`.

## Testing Notes

Language feature providers must follow the pure function extraction pattern:
- All parsing and computation logic lives in a pure function (plain arguments, no VS Code types)
- The provider class is a thin wrapper that calls the pure function
- Tests import and call the pure function directly — no VS Code host required
- Test files live at `src/test/<name>Provider.test.ts`
