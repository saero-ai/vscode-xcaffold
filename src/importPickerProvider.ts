import * as vscode from 'vscode';
import * as fs from 'fs';
import { XcaffoldCli } from './xcaffoldCli';
import {
  KNOWN_PROVIDER_DIRS,
  ProviderDirEntry,
  detectProviderDirs,
} from './initWizardProvider';

export interface ImportPickerItem {
  label: string;
  detail: string;
  dirName: string;
}

/**
 * DIR_TO_PROVIDER maps filesystem directory names to xcaffold provider
 * identifiers used by `xcaffold import --provider <name>`.
 */
const DIR_TO_PROVIDER: Record<string, string> = {
  '.claude': 'claude',
  '.cursor': 'cursor',
  '.github': 'copilot',
  '.gemini': 'gemini',
  '.agents': 'agents',
};

/**
 * createPickerItems builds VS Code quick pick items from detected
 * provider directory entries.
 */
export function createPickerItems(
  detected: ProviderDirEntry[]
): ImportPickerItem[] {
  return detected.map((d) => ({
    label: d.label,
    detail: `${d.name}/`,
    dirName: d.name,
  }));
}

/**
 * buildImportArgs constructs CLI arguments for xcaffold import.
 * Maps directory names to provider identifiers.
 */
export function buildImportArgs(selectedDirNames: string[]): string[] {
  const args = ['import'];

  for (const dirName of selectedDirNames) {
    const provider = DIR_TO_PROVIDER[dirName] ?? dirName.replace(/^\./, '');
    args.push('--provider', provider);
  }

  return args;
}

/**
 * runImportPicker shows a multi-select quick pick of detected provider
 * directories and runs xcaffold import for selected ones.
 */
export async function runImportPicker(
  cli: XcaffoldCli,
  workspaceRoot: string
): Promise<void> {
  // Scan workspace for provider directories
  let allDirNames: string[];
  try {
    const entries = fs.readdirSync(workspaceRoot, {
      withFileTypes: true,
    });
    allDirNames = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    vscode.window.showErrorMessage(
      'xcaffold: Could not read workspace directory.'
    );
    return;
  }

  const detected = detectProviderDirs(allDirNames);

  if (detected.length === 0) {
    vscode.window.showInformationMessage(
      'xcaffold: No provider directories found in workspace. ' +
      'Expected: .claude/, .cursor/, .github/, .gemini/, or .agents/'
    );
    return;
  }

  const pickerItems = createPickerItems(detected);

  const selected = await vscode.window.showQuickPick(pickerItems, {
    canPickMany: true,
    placeHolder: 'Select providers to import from',
    title: 'xcaffold: Import from Providers',
  });

  if (!selected || selected.length === 0) {
    return; // user cancelled
  }

  const dirNames = selected.map((s) => s.dirName);
  const args = buildImportArgs(dirNames);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `xcaffold: Importing from ${selected.map((s) => s.label).join(', ')}...`,
      cancellable: false,
    },
    async () => {
      try {
        await cli.run(args, workspaceRoot);
        vscode.window.showInformationMessage(
          `xcaffold: Import completed from ${selected.map((s) => s.label).join(', ')}.`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `xcaffold import error: ${err.message}`
        );
      }
    }
  );
}
