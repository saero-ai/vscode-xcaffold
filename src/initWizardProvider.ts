import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { XcaffoldCli } from './xcaffoldCli';

export interface ProviderDirEntry {
  name: string;
  label: string;
}

/**
 * Known provider directories that xcaffold can import from.
 */
export const KNOWN_PROVIDER_DIRS: ProviderDirEntry[] = [
  { name: '.claude', label: 'Claude Code' },
  { name: '.cursor', label: 'Cursor' },
  { name: '.github', label: 'GitHub Copilot' },
  { name: '.gemini', label: 'Gemini CLI' },
  { name: '.agents', label: 'Agents (agentskills.io)' },
];

/**
 * detectProviderDirs filters KNOWN_PROVIDER_DIRS to those present
 * in the given list of directory names.
 */
export function detectProviderDirs(
  existingDirNames: string[]
): ProviderDirEntry[] {
  const nameSet = new Set(existingDirNames);
  return KNOWN_PROVIDER_DIRS.filter((d) => nameSet.has(d.name));
}

export interface InitOptions {
  force?: boolean;
}

/**
 * buildInitArgs constructs CLI arguments for xcaffold init.
 */
export function buildInitArgs(options?: InitOptions): string[] {
  const args = ['init'];
  if (options?.force) {
    args.push('--force');
  }
  return args;
}

/**
 * scanWorkspaceProviderDirs reads the workspace root and returns
 * names of directories that match known provider dirs.
 */
function scanWorkspaceProviderDirs(workspaceRoot: string): string[] {
  try {
    const entries = fs.readdirSync(workspaceRoot, {
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * runInitWizard guides the user through a multi-step init flow:
 * 1. Detect existing provider dirs
 * 2. Offer import if providers found
 * 3. Run xcaffold init
 */
export async function runInitWizard(
  cli: XcaffoldCli,
  workspaceRoot: string
): Promise<void> {
  // Step 1: Detect existing provider directories
  const allDirNames = scanWorkspaceProviderDirs(workspaceRoot);
  const detected = detectProviderDirs(allDirNames);

  // Step 2: If providers found, offer import
  if (detected.length > 0) {
    const labels = detected.map((d) => `${d.label} (${d.name}/)`);
    const importChoice = await vscode.window.showQuickPick(
      ['Yes - Import existing config first', 'No - Start fresh'],
      {
        placeHolder: `Found ${detected.length} provider dir(s): ${labels.join(', ')}`,
        title: 'xcaffold Init: Import existing configuration?',
      }
    );

    if (!importChoice) {
      return; // user cancelled
    }

    if (importChoice.startsWith('Yes')) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'xcaffold: Importing existing configuration...',
          cancellable: false,
        },
        async () => {
          try {
            await cli.run(['import'], workspaceRoot);
            vscode.window.showInformationMessage(
              'xcaffold: Import completed.'
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(
              `xcaffold import error: ${err.message}`
            );
          }
        }
      );
    }
  }

  // Step 3: Check if project.xcaf already exists
  const projectXcfPath = path.join(workspaceRoot, 'project.xcaf');
  let forceFlag = false;

  if (fs.existsSync(projectXcfPath)) {
    const overwrite = await vscode.window.showQuickPick(
      ['Yes - Overwrite existing project.xcaf', 'No - Cancel'],
      {
        placeHolder: 'project.xcaf already exists',
        title: 'xcaffold Init: Overwrite?',
      }
    );

    if (!overwrite || overwrite.startsWith('No')) {
      return; // user cancelled
    }
    forceFlag = true;
  }

  // Step 4: Run init
  const args = buildInitArgs({ force: forceFlag });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'xcaffold: Initializing project...',
      cancellable: false,
    },
    async () => {
      try {
        await cli.run(args, workspaceRoot);
        vscode.window.showInformationMessage(
          'xcaffold: Project initialized successfully.'
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `xcaffold init error: ${err.message}`
        );
      }
    }
  );
}
