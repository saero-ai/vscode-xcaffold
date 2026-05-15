# Contributing to xcaffold-vscode

## Ways to Contribute

- **Bug reports** — open a GitHub issue with a minimal reproduction case.
- **Documentation** — fix errors, improve examples, or clarify feature descriptions in `README.md`.
- **Feature proposals** — open a GitHub Discussion before writing code for significant changes.
- **Extension improvements** — enhancements to tree views, webviews, diagnostics, commands, or JSON schema.

## Setting Up

Prerequisites: Node.js 20 or later, VS Code 1.95 or later.

```
npm install
npm run compile
```

No other global dependencies are required. The extension has a zero-runtime-dependency policy — do not add packages to `dependencies` in `package.json`. Development-only tools belong in `devDependencies`.

## Reporting Bugs

Open a GitHub issue. Include:

- VS Code version (`Help > About`)
- xcaffold-vscode extension version (Extensions panel)
- xcaffold CLI version (`xcaffold version`)
- OS and Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Extension Host logs (`Help > Toggle Developer Tools > Console`, or `Output > xcaffold` channel)

## Proposing Features

For significant changes — new commands, new webviews, tree view restructuring — open a GitHub Discussion before writing code. Maintainers will confirm scope before you invest implementation time. For small, well-scoped improvements, a PR with a clear description is sufficient.

## Pull Requests

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat(tree-view): add import status indicator
fix(diagnostics): handle missing xcaffold binary gracefully
docs(contributing): update setup instructions
test(cli-queue): add cancellation test cases
```

### Changelog

Changelogs are generated automatically by [release-please](https://github.com/googleapis/release-please) from Conventional Commit messages. Do not edit `CHANGELOG.md` manually — your commit messages become the changelog entries. Write clear, user-facing commit descriptions.

For breaking changes, include a `BREAKING CHANGE:` footer in the commit message body.

### PR Checklist

- [ ] `npm run compile` succeeds with no errors
- [ ] `npm test` passes
- [ ] No new runtime dependencies added (`dependencies` in `package.json` must not grow)
- [ ] Tree view and webview changes tested manually in the Extension Development Host
- [ ] `README.md` updated if user-facing behavior changed

## Testing

### Running Tests

```
npm test
```

Tests run with Mocha and ts-node. They execute outside the Extension Development Host (no VS Code API access required) using stubs for VS Code APIs.

### Writing Tests

Each source file in `src/` has a corresponding test file in `src/test/`. Follow the existing test structure — use `setup.ts` stubs for VS Code APIs. Do not add tests that require a live Extension Host; the CI environment does not support it.

### Manual Testing in the Extension Host

For changes to UI behavior (tree views, webviews, commands):

1. Open the worktree in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open a project with `.xcaf` files
4. Exercise the changed behavior

The `launch.json` and `tasks.json` in `.vscode/` are pre-configured for this workflow.

## Architecture

The extension is organized into discrete providers, each responsible for one surface area of the VS Code API.

### Providers

| File | Responsibility |
|------|---------------|
| `src/extension.ts` | Entry point — registers all providers and disposes them on deactivation |
| `src/treeViewProvider.ts` | Explorer tree view showing `.xcaf` resources and their compiled state |
| `src/commandProvider.ts` | VS Code command palette commands (`xcaffold.apply`, `xcaffold.import`, etc.) |
| `src/diagnosticProvider.ts` | Inline diagnostics for `.xcaf` files using the xcaffold CLI |
| `src/codeLensProvider.ts` | Code lens actions on `.xcaf` files |
| `src/definitionProvider.ts` | Go-to-definition for `.xcaf` resource references |
| `src/diffPreviewProvider.ts` | Diff webview showing pending changes before apply |
| `src/graphProvider.ts` | Dependency graph webview |
| `src/importPickerProvider.ts` | Quick pick UI for selecting an import source |
| `src/initWizardProvider.ts` | Multi-step wizard for initializing a new xcaffold project |
| `src/schemaViewerProvider.ts` | Schema reference webview |
| `src/statusBarProvider.ts` | Status bar item showing xcaffold state |
| `src/statusDashProvider.ts` | Status dashboard webview |
| `src/xcaffoldCli.ts` | Subprocess wrapper for the xcaffold binary |
| `src/cliQueue.ts` | Serialized queue for CLI invocations |
| `src/xcfIndex.ts` | In-memory index of `.xcaf` files in the workspace |
| `src/versionCheck.ts` | Version compatibility check between extension and CLI |

### Webviews

Webviews (`diffPreviewProvider`, `graphProvider`, `schemaViewerProvider`, `statusDashProvider`) follow a shared base class in `src/webview/baseWebview.ts`. All webview HTML is generated in TypeScript — no separate HTML files. Content Security Policy is enforced on every webview.

### JSON Schema

`schemas/xcaffold-schema.json` is generated from the xcaffold CLI's AST by the tool at `tools/gen-json-schema/`. When the xcaffold CLI's schema changes, regenerate with:

```
cd tools/gen-json-schema && go run . > ../../schemas/xcaffold-schema.json
```

Do not edit `schemas/xcaffold-schema.json` by hand.

### Zero Runtime Dependencies

The extension ships no `node_modules` to the end user. All runtime code is bundled with esbuild (`esbuild.config.mjs`). If a library is needed at runtime, evaluate whether the VS Code API already provides the equivalent. If not, justify the addition in the PR description.

## Architectural Constraints

### CLI as the Source of Truth

The extension is a thin UI layer over the xcaffold CLI. Business logic lives in the CLI, not the extension. Do not re-implement parsing, compilation, or validation in TypeScript — invoke the CLI and render its output.

### Subprocess Safety

All CLI invocations go through `src/cliQueue.ts`, which serializes concurrent calls to prevent race conditions. Do not spawn the xcaffold binary directly from providers.

### VS Code API Compatibility

Target the minimum VS Code engine version declared in `package.json`. Do not use API surface introduced after that version without a version guard.

## Breaking Changes

A breaking change requires existing users to modify their workflow, configuration, or `.xcaf` files. Process:

1. Deprecate with a warning in the current release
2. Remove in the following release
3. Add a `BREAKING CHANGE:` footer to the commit message — release-please will generate the changelog entry

## Good First Issues

Look for issues labeled `good first issue`. Good starting points: documentation fixes, improving error messages in diagnostics, adding test coverage for existing providers. Before starting, comment on the issue to signal that you are working on it.

## Response Time Expectations

Maintainers aim to respond to issues within 1 week and PRs within 72 hours. If you have not received a response after 2 weeks, you may ping the thread.
