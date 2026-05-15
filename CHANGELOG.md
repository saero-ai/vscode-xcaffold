# Changelog

All notable changes to the xcaffold VS Code extension will be documented in this file.

## [Unreleased]

### Changed
- Improved xcaffold resource snippets with clearer descriptions and placeholder hints.

## [0.2.1] - 2026-05-15

### Packaging
- Add .vscodeignore to exclude development artifacts from published extension
- VSIX size reduced from 1.5MB to ~500KB
- Add automated publish workflow for GitHub releases

### Infrastructure
- Switch license from MIT to Apache-2.0 for consistency with xcaffold CLI
- Bump GitHub Actions to latest versions (checkout v6, setup-node v6, upload-artifact v7)
- Update dependencies to resolve security advisories
- Make xcaf manifests provider-agnostic for open-source contributors

## [0.2.0] - 2026-05-04

### Build Infrastructure
- Replaced tsc with esbuild for production bundling
- Bundled D3.js locally — removed CDN dependency, added Content Security Policy
- Converted PATH resolution from synchronous to async (no more extension host blocking)
- Added CLI concurrency control — write operations serialized, reads concurrent
- Added minimum CLI version check on activation

### Tree View Enhancements
- Click any resource in the tree to open its `.xcaf` file
- Right-click context menus: Apply and Validate per resource
- Shared name-to-file index for resource resolution

### Interactive Commands
- Target-filtered apply — quick pick to select providers before compiling
- File-level validate — validate only the active `.xcaf` file
- Init wizard — detect existing provider configs, offer import, create project
- Import picker — multi-select providers to import from

### Webview Panels
- Diff preview — run `apply --dry-run` and preview changes before writing
- Fidelity report — color-coded provider fidelity scores
- Status dashboard — per-provider cards with drift indicators and apply buttons
- Schema viewer — pick a kind, view its field reference grouped by category

### Editor Integration
- CodeLens: Apply and Validate actions above `kind:` declarations
- Go-to-definition: Ctrl+click on `skills:`, `rules:`, `agents:` references
- Snippets: scaffolding templates for agent, skill, rule, workflow, mcp kinds

### Status Bar
- Displays xcaffold version, last apply timestamp, and drift status

## [0.1.0] - 2026-05-04

- Initial release
- JSON Schema integration for `.xcaf` manifest validation and autocomplete
- Validate-on-save diagnostics via `xcaffold validate`
- Interactive D3.js resource graph webview
- Resource Explorer sidebar grouped by kind
- Command Palette integration for core CLI commands
