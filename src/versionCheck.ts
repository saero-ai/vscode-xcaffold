import * as vscode from 'vscode';
import { XcaffoldCli } from './xcaffoldCli';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/;

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
  } catch {
    // Binary not found or errored — separate ENOENT handling exists in xcaffoldCli.ts
  }
}
