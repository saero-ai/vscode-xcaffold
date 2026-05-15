# xcaf/ — xcaffold Manifest Directory

This directory contains xcaffold manifest files (`.xcaf`) that define the
project's agent configuration, rules, skills, hooks, and settings. These
manifests are the source of truth. Compiled output (`.claude/`, `.gemini/`,
`.agents/`, etc.) is generated from them and should not be edited directly.

## What is xcaffold?

xcaffold is a declarative configuration tool for AI coding agents. You author
`.xcaf` manifests once, then compile them to any supported provider's native
format — Claude Code, Gemini CLI, Cursor, GitHub Copilot, Antigravity, and
others. This means the project maintains a single set of agent definitions that
work across providers.

## Getting Started

1. **Install the xcaffold CLI:**

   ```sh
   go install github.com/saero-ai/xcaffold@latest
   ```

   Or via Homebrew:

   ```sh
   brew install saero-ai/tap/xcaffold
   ```

2. **Set your target providers** in `project.xcaf`:

   ```yaml
   targets: [claude]
   ```

   Or for multiple providers:

   ```yaml
   targets: [cursor, copilot]
   ```

3. **Compile the manifests:**

   ```sh
   xcaffold apply
   ```

   This generates provider-native configuration files in the appropriate
   directories (e.g., `.claude/` for Claude Code). The compiled output is
   gitignored — each contributor generates their own.

## Directory Structure

| Directory  | Purpose                                                        |
|------------|----------------------------------------------------------------|
| agents/    | Specialist agent definitions (extension-dev, test-dev, etc.)   |
| context/   | Project context and orchestrator instructions                  |
| hooks/     | Automated quality checks (typecheck on edit, pre-commit gates) |
| rules/     | Coding standards and security policies                         |
| settings/  | Tool permissions and configuration                             |
| skills/    | Step-by-step guides for common tasks                           |

## Provider-Scoped Content

Some manifests target a specific provider. For example,
`context/claude/orchestrator.xcaf` compiles only when the target includes Claude
Code. Contributors using other providers can create equivalent context files
under `context/<provider>/` for their preferred tool.

## Learn More

- [xcaffold CLI repository](https://github.com/saero-ai/xcaffold)
