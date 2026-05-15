# xcaffold for VS Code

VS Code extension for authoring and managing xcaffold `.xcaf` manifests. Wraps the `xcaffold` Go CLI to provide an IDE-native experience for agent configuration — validation, autocomplete, resource browsing, and interactive commands without leaving the editor.

## Features

**Schema and Validation**
- JSON Schema integration for all `.xcaf` resource kinds via `redhat.vscode-yaml`
- Validate-on-save with inline diagnostics from `xcaffold validate`
- File-level validation for the active `.xcaf` editor

**Resource Explorer**
- Sidebar tree view showing all resources grouped by kind
- Click any resource to open its `.xcaf` file
- Right-click context menus for Apply and Validate per resource

**Interactive Commands**
- Target-filtered apply — select which providers to compile
- Init wizard — detect existing provider configs and offer import
- Import picker — multi-select which providers to import from
- Diff preview — preview changes before applying (`--dry-run`)

**Webview Panels**
- Interactive D3.js resource dependency graph
- Fidelity report with color-coded provider scores
- Status dashboard with per-provider drift indicators
- Schema viewer with kind selection and grouped field reference

**Editor Integration**
- CodeLens above `kind:` declarations — inline Apply and Validate actions
- Go-to-definition for resource references (`skills: [name]` -> jump to `.xcaf` file)
- Snippet scaffolding for agent, skill, rule, workflow, and mcp resources

**Status Bar**
- xcaffold CLI version, last apply timestamp, and drift status indicator

## Requirements

- **xcaffold CLI** (v0.5.0+): The extension requires the `xcaffold` binary installed and on PATH
- **YAML Extension** (recommended): Install `redhat.vscode-yaml` for schema-driven autocomplete and hover docs

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `xcaffold.binaryPath` | `xcaffold` | Path to the xcaffold binary. The extension resolves this via your login shell. |

## Usage

1. Open a workspace containing a `project.xcaf` file
2. The xcaffold icon appears in the Activity Bar — click to open the Resource Explorer
3. Edit any `.xcaf` file to get autocomplete, validation, and CodeLens actions
4. Use the Command Palette (`Cmd+Shift+P`) to access all xcaffold commands

## License

Apache-2.0
