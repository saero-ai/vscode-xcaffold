---
title: "VS Code Extension Commands"
description: "Reference for all xcaffold VS Code extension commands."
---

# VS Code Extension Commands

Most commands are accessible from the command palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux). Type **xcaffold** to filter to extension commands. A small number of commands are wired to sidebar toolbar buttons and are noted below.

---

## Lifecycle Commands

These commands map directly to xcaffold CLI operations and run against the workspace root.

| Command | ID | Description |
|---|---|---|
| Apply Manifest | `xcaffold.apply` | Compile `.xcaf` manifests into provider-native configs |
| Validate Manifest | `xcaffold.validate` | Check all manifests for schema and cross-reference errors |
| Show Project Status | `xcaffold.status` | Show compilation state and detect drift |
| List Resources | `xcaffold.list` | List discovered resources and blueprints |
| Show Resource Graph | `xcaffold.graph` | Open the interactive D3 dependency graph |
| Import from Providers | `xcaffold.import` | Import existing provider configs into `.xcaf` |

---

## Editor Commands

These commands operate on the file currently open in the active editor or on resources selected in the tree view.

| Command | ID | Description |
|---|---|---|
| Validate Active File | `xcaffold.validateFile` | Validate the currently open `.xcaf` file |
| Open File | `xcaffold.openResource` | Open a resource's source file from tree view |
| Find References | `xcaffold.findReferences` | Find all files referencing a resource |
| New Resource... | `xcaffold.newResource` | Create a new `.xcaf` resource from template |
| Delete Resource | `xcaffold.deleteResource` | Remove a resource and its file |
| Refresh Explorer | `xcaffold.refreshExplorer` | Refresh the resource tree view (also the refresh toolbar button on the Resource Explorer sidebar) |

---

## Wizard Commands

Guided, multi-step commands that walk through a workflow interactively.

| Command | ID | Description |
|---|---|---|
| Initialize Project (Wizard) | `xcaffold.initWizard` | Interactive project initialization |
| Import from Providers (Picker) | `xcaffold.importPicker` | Multi-select provider import |

---

## Webview Commands

These commands open dedicated panels inside VS Code.

| Command | ID | Description |
|---|---|---|
| Diff Preview | `xcaffold.diff` | Preview apply changes before writing |
| Refresh Status | `xcaffold.refreshDashboard` | Refresh the status dashboard data (also the refresh toolbar button on the Status Dashboard sidebar) |
| Status Dashboard | `xcaffold.statusDash` | Visual drift detection dashboard |
| Schema Viewer | `xcaffold.schemaViewer` | Browse `.xcaf` field schemas |

---

## Registry Commands

These commands manage the resource registry, which tracks directories containing `.xcaf` resources across your system.

| Command | ID | Description |
|---|---|---|
| Registry List | `xcaffold.registryList` | List all registered resource directories |
| Registry Add | `xcaffold.registryAdd` | Add a resource directory to the registry |
| Registry Remove | `xcaffold.registryRemove` | Remove a resource from the registry |
| Registry Prune | `xcaffold.registryPrune` | Remove registry entries that no longer exist on disk |
| Registry Info | `xcaffold.registryInfo` | Show details about a registered resource (also available via right-click in the Object Explorer registry section) |

---

## Scope Commands

| Command | ID | Description |
|---|---|---|
| Toggle Global Scope | `xcaffold.toggleGlobalScope` | Switch between project scope and global scope for apply and list operations |

---

## Keyboard Shortcuts

| Shortcut | Command | Condition |
|---|---|---|
| `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Windows/Linux) | Apply Manifest | Active file is `.xcaf` |

## Notes

Most commands require the xcaffold CLI to be installed and available on `PATH`. The exceptions are file and tree operations (`Open File`, `Find References`, `New Resource`, `Delete Resource`, `Refresh Explorer`) which work without the CLI. If the CLI is not found, commands that need it will display a "CLI not found" notification with a link to the installation guide.

See [Getting Started](getting-started.md#troubleshooting) for CLI path configuration.
