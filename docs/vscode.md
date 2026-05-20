---
title: "VS Code Extension"
description: "See your agent harness. Install in 30 seconds."
---

# VS Code Extension

The xcaffold VS Code extension brings the full compiler workflow into your editor. Open a `.xcaf` file and get immediate schema-aware editing — no terminal required for day-to-day authoring.

**Free. Open source. Apache 2.0.**

---

## Install

Search for **xcaffold** in the VS Code Extensions panel, or install directly from the command palette:

```
ext install saero-ai.vscode-xcaffold
```

→ [View on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=saero-ai.vscode-xcaffold)

---

## Features

### Schema-Aware Editing

IntelliSense completions for all `.xcaf` fields — `kind:`, `name:`, `targets:`, `tools:`, and more. Validate-on-save catches schema errors and cross-reference violations reported by the CLI validator.

### D3 Dependency Graph

An interactive graph of your entire agent harness. Click any node to navigate to the source file. Visualize which agents share skills, rules, or MCP servers at a glance.

### IDE Commands

Apply, validate, import, diff, check status, open the graph, scaffold new resources — all accessible from the command palette without leaving the editor. See the [full command reference](commands.md).

### CodeLens Actions

Inline **Apply** and **Validate** actions appear above every `kind:` declaration — one click to compile or check your manifest without leaving the source file.

### Resource Tree View

A sidebar panel that lists every resource in your project organized by kind — Agents, Skills, Rules, Workflows, MCP Servers, Hooks, Blueprints, Policies, and more. Click to open, right-click to delete or validate. Stays in sync as you add or remove `.xcaf` files.

### Status Dashboard

A live sidebar panel showing per-provider compilation state. Each provider gets its own card with a drift indicator, last applied timestamp, and file count. Hit **Apply** on any card to recompile that provider without opening a terminal. Refreshes automatically whenever you save a `.xcaf` file.

### Hover Documentation

Hover over any field name in a `.xcaf` file to see its schema description, valid values, and type — sourced from the CLI's schema definitions, with a built-in fallback when the CLI is unavailable.

### Go-to-Definition

`Cmd+Click` (macOS) or `Ctrl+Click` (Windows/Linux) on any resource reference in a `.xcaf` file to jump directly to its source file.

### Snippet Scaffolding

Starter snippets for resource kinds including `agent`, `skill`, `rule`, `workflow`, and `mcp`. Type the kind name and press Tab to expand a complete, field-annotated skeleton.

---

## CLI Dependency

The extension calls the xcaffold CLI under the hood. **xcaffold CLI v0.7.1 or later is required.**

Install the CLI if you haven't already:

```bash
# macOS
brew install saero-ai/tap/xcaffold

# Linux
curl -sSL https://github.com/saero-ai/xcaffold/releases/latest/download/xcaffold_Linux_x86_64.tar.gz | tar -xz && sudo mv xcaffold /usr/local/bin/

# Windows (Scoop)
scoop bucket add saero-ai https://github.com/saero-ai/scoop-bucket.git
scoop install xcaffold
```

---

## Next Steps

- [Getting Started](getting-started.md) — step-by-step setup walkthrough
- [Commands Reference](commands.md) — all commands documented
