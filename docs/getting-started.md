---
title: "Getting Started with the VS Code Extension"
description: "Install the xcaffold VS Code extension and set up your first .xcaf workflow in under five minutes."
---

# Getting Started with the VS Code Extension

This guide walks you through installing the extension, connecting it to the CLI, and authoring your first `.xcaf` manifest with full IntelliSense.

---

## Prerequisites

- **VS Code 1.85.0 or later**
- **xcaffold CLI v0.7.1 or later** — the extension calls the CLI for all compile and validate operations

---

## Step 1: Install the CLI

If you haven't installed the xcaffold CLI yet, install it now:

```bash
# macOS
brew install saero-ai/tap/xcaffold

# Linux
curl -sSL https://github.com/saero-ai/xcaffold/releases/latest/download/xcaffold_Linux_x86_64.tar.gz | tar -xz && sudo mv xcaffold /usr/local/bin/

# Windows (Scoop)
scoop bucket add saero-ai https://github.com/saero-ai/scoop-bucket.git
scoop install xcaffold
```

Verify the installation:

```bash
xcaffold --version
```

---

## Step 2: Install the Extension

**Option A — VS Code Marketplace (recommended)**

1. Open VS Code
2. Press `Cmd+Shift+X` (macOS) or `Ctrl+Shift+X` (Windows/Linux) to open the Extensions panel
3. Search for **xcaffold**
4. Click **Install** on the result published by **saero-ai**

**Option B — Command Palette**

1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type **Install Extensions**
3. Run: `ext install saero-ai.vscode-xcaffold`

---

## Step 3: Open a `.xcaf` File

Open any folder that contains `.xcaf` manifests, or initialize a new project:

```bash
xcaffold init
```

Open any `.xcaf` file. You should immediately see:

- Field name completions as you type
- Hover documentation for `kind:`, `targets:`, and other fields
- Red underlines on schema violations

---

## Step 4: Validate from the Command Palette

1. Press `Cmd+Shift+P` and type **xcaffold validate**
2. Select **xcaffold: Validate Manifest** from the list
3. The output panel shows any schema errors or cross-reference violations across all manifests

To validate only the current file, use **xcaffold: Validate Active File**.

---

## Step 5: Open the Dependency Graph

1. Press `Cmd+Shift+P` and type **xcaffold graph**
2. Select **xcaffold: Show Resource Graph**
3. An interactive D3 graph opens in a new panel — click any node to navigate to its source file

---

## Troubleshooting

### "CLI not found" error

The extension cannot locate the `xcaffold` binary. This means either:

- The CLI is not installed — follow Step 1 above
- The CLI is installed in a path that VS Code cannot see (common on macOS with Homebrew when VS Code is launched from the Dock rather than the terminal)

**Fix:** Open VS Code from the terminal with `code .` so it inherits your shell's `PATH`, or set `xcaffold.binaryPath` in VS Code settings to the absolute path of the binary (e.g., `/opt/homebrew/bin/xcaffold`).

---

## Next Steps

- [VS Code Extension Overview](vscode.md) — full feature list
- [Commands Reference](commands.md) — all commands documented
