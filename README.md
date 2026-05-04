# xcaffold for VS Code

`xcaffold` is the ultimate manifest authoring extension for AI-native software engineering. It provides 100% technical parity with the `xcaffold` Go CLI, enabling seamless management of agents, skills, rules, and workflows directly from your editor.

![xcaffold Logo](logo.png)

## Features

- **🚀 Real-time Validation**: Validates `*.xcf` manifests on-save using the `xcaffold validate` engine.
- **💎 Intelligence & Autocomplete**: Full JSON Schema integration for all `.xcf` resource kinds (Agents, Skills, Rules, etc.).
- **📊 Interactive Graph**: Visualize your project topology with an interactive D3.js-powered resource graph.
- **🌲 Resource Explorer**: Browse your project resources grouped by kind in the dedicated sidebar.
- **⚡ Command Palette**: Run `apply`, `status`, `list`, `import`, `init`, `export`, and `graph` directly from the Command Palette.

## Requirements

- **xcaffold CLI**: This extension requires the `xcaffold` binary to be installed on your system.
- **YAML Extension**: Recommended to install the `redhat.vscode-yaml` extension for the best schema-driven authoring experience.

## Configuration

- `xcaffold.binaryPath`: The absolute path to the `xcaffold` binary (default: `xcaffold` on PATH).

## Usage

1. Open any `.xcf` file or a directory containing a `project.xcf`.
2. Use the **xcaffold Explorer** in the Activity Bar to browse your resources.
3. Run `xcaffold: Show Resource Graph` to see your project topology.
4. Save any `.xcf` file to trigger automatic validation.

## License

MIT © [Saero AI](https://saero.ai)
