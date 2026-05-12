# Security Policy

## Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Send a report to **security@saero.ai**. Include:

- VS Code version (`Help > About`)
- xcaffold-vscode extension version (Extensions panel)
- xcaffold CLI version (`xcaffold version`, if relevant)
- OS and Node.js version
- Steps to reproduce or a proof-of-concept
- Whether you believe the issue is remotely exploitable
- Your suggested severity: low / medium / high / critical

We will acknowledge your report within 48 hours, complete an initial triage within 7 business days, and coordinate a disclosure timeline with you before any public announcement. We ask that you do not disclose the issue publicly until a patch has been released.

## Supported Versions

Security updates are provided for the latest released version only.

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | No — upgrade to the latest release |

## Scope

**In scope:**

- Vulnerabilities in the extension's TypeScript code
- Webview rendering issues that could enable script injection or content security policy bypass
- File system access patterns that could enable path traversal or unauthorized reads/writes
- VS Code API usage that could enable privilege escalation or sandbox escape
- CLI subprocess invocation that could enable command injection

**Out of scope:**

- Vulnerabilities in the xcaffold CLI itself — report those to the [xcaffold repository](https://github.com/saero-ai/xcaffold/blob/main/SECURITY.md)
- Vulnerabilities in VS Code itself — report those to [Microsoft](https://www.microsoft.com/en-us/msrc)
- Vulnerabilities in third-party npm dependencies — report those to the upstream maintainer or via [GitHub's advisory database](https://github.com/advisories)
- Issues that require the attacker to already have write access to the user's workspace or VS Code settings
