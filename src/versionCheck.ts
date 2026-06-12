import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/;

export const INSTALL_GUIDE_URL = 'https://github.com/saero-ai/xcaffold#installation';

export function getCliNotFoundMessage(minVersion: string): string {
  return [
    `xcaffold binary was not found on PATH. Install xcaffold CLI ${minVersion}+ with Homebrew`,
    '(`brew install saero-ai/tap/xcaffold`) or Go',
    '(`go install github.com/saero-ai/xcaffold@latest`), then restart VS Code.',
    `Installation guide: ${INSTALL_GUIDE_URL}`,
  ].join(' ');
}

/**
 * parseVersion extracts the first semver triple from a string.
 * Handles "v0.5.0", "xcaffold version 0.5.0", and bare "0.5.0".
 * Returns null if no semver found.
 */
export function parseVersion(raw: string): SemVer | null {
  const m = SEMVER_RE.exec(raw);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
  };
}

/**
 * isVersionSatisfied returns true when `actual` >= `minimum`.
 */
export function isVersionSatisfied(
  actual: SemVer,
  minimum: string
): boolean {
  const min = parseVersion(minimum);
  if (!min) return true; // unparseable minimum — skip check

  if (actual.major !== min.major) return actual.major > min.major;
  if (actual.minor !== min.minor) return actual.minor > min.minor;
  return actual.patch >= min.patch;
}

/**
 * checkMinimumVersion runs `xcaffold --version` and compares against
 * the minimum version in package.json. Shows a warning if below minimum.
 */
export async function checkMinimumVersion(
  cli: XcaffoldCli,
  cwd: string,
  minVersion: string
): Promise<void> {
  try {
    const result = await cli.run(['--version'], cwd);
    const version = parseVersion(result.stdout);

    if (!version) {
      vscode.window.showWarningMessage(
        `xcaffold: Could not determine CLI version. ` +
        `Minimum required: ${minVersion}.`
      );
      return;
    }

    if (!isVersionSatisfied(version, minVersion)) {
      vscode.window.showWarningMessage(
        `xcaffold CLI version ${version.major}.${version.minor}.${version.patch} ` +
        `is below the minimum required ${minVersion}. ` +
        `Please upgrade: go install github.com/saero-ai/xcaffold@latest`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|ENOENT/i.test(message)) {
      vscode.window.showWarningMessage(getCliNotFoundMessage(minVersion));
    }
  }
}
