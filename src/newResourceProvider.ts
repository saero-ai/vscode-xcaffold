import * as vscode from 'vscode';
import * as path from 'path';
import { XcafIndex } from './xcafIndex';
import { validateResourceName } from './renameProvider';
import {
  renderTemplate,
  supportedVariants,
  TemplateVariant,
} from './resourceTemplates';
import { KNOWN_KINDS } from './xcafSchema';

/**
 * Variant choice item for the template selection quick pick.
 */
export interface VariantChoice {
  label: string;
  variant: TemplateVariant | 'existing';
}

/**
 * buildResourcePath returns the canonical file path for a new xcaf resource.
 * Layout: `<workspaceRoot>/xcaf/<kind>/<name>/<name>.xcaf`
 */
export function buildResourcePath(
  workspaceRoot: string,
  kind: string,
  name: string,
): string {
  return path.join(workspaceRoot, 'xcaf', kind, name, `${name}.xcaf`);
}

/**
 * buildVariantChoices returns the quick pick items for template selection.
 * All kinds get Minimal + From Existing. Kinds that support the full
 * variant also get Full.
 */
export function buildVariantChoices(kind: string): VariantChoice[] {
  const choices: VariantChoice[] = [];
  const variants = supportedVariants(kind);

  for (const v of variants) {
    const label = v === 'minimal' ? 'Minimal' : 'Full';
    choices.push({ label, variant: v });
  }

  choices.push({ label: 'From Existing', variant: 'existing' });
  return choices;
}

/**
 * validateName wraps validateResourceName for use as a VS Code
 * InputBox validateInput callback.
 * Returns undefined when valid, or an error message string when invalid.
 */
export function validateName(name: string): string | undefined {
  const result = validateResourceName(name);
  return result.valid ? undefined : result.reason;
}

/**
 * runNewResourceWizard walks the user through creating a new .xcaf resource:
 *
 * 1. Quick Pick — select resource kind
 * 2. Quick Pick — select template variant (Minimal, Full, From Existing)
 * 3. Input Box — enter resource name with validation
 * 4. (If From Existing) Quick Pick — pick source resource from XcafIndex
 * 5. Create directory and write the .xcaf file
 * 6. Open the new file in the editor
 */
export async function runNewResourceWizard(
  xcafIndex: XcafIndex,
  workspaceRoot: string,
): Promise<void> {
  // Step 1: Pick kind
  const kindItems = KNOWN_KINDS.map((k) => ({ label: k }));
  const kindPick = await vscode.window.showQuickPick(kindItems, {
    placeHolder: 'Select resource kind',
    title: 'xcaffold: New Resource',
  });
  if (!kindPick) {
    return;
  }

  // Step 2: Pick template variant
  const variants = buildVariantChoices(kindPick.label);
  const variantPick = await vscode.window.showQuickPick(variants, {
    placeHolder: 'Select template',
    title: 'xcaffold: New Resource',
  });
  if (!variantPick) {
    return;
  }

  // Step 3: Input resource name
  const name = await vscode.window.showInputBox({
    prompt: 'Resource name (lowercase, digits, hyphens)',
    placeHolder: 'my-resource',
    validateInput: validateName,
  });
  if (!name) {
    return;
  }

  // Step 4: Resolve template content
  let content: string;

  if (variantPick.variant === 'existing') {
    const entries = xcafIndex
      .allEntries()
      .filter((e) => e.kind === kindPick.label);

    if (entries.length === 0) {
      vscode.window.showWarningMessage(
        `No existing ${kindPick.label} resources found.`,
      );
      return;
    }

    const sourceItems = entries.map((e) => ({
      label: e.name,
      entry: e,
    }));
    const sourcePick = await vscode.window.showQuickPick(sourceItems, {
      placeHolder: 'Select resource to copy from',
      title: 'xcaffold: New Resource — From Existing',
    });
    if (!sourcePick) {
      return;
    }

    const sourceDoc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(sourcePick.entry.fileUri),
    );
    content = sourceDoc
      .getText()
      .replace(/^name:\s*.+$/m, `name: ${name}`);
  } else {
    content = renderTemplate(kindPick.label, variantPick.variant, {
      name,
    });
  }

  // Step 5: Create file
  const filePath = buildResourcePath(
    workspaceRoot,
    kindPick.label,
    name,
  );
  const fileUri = vscode.Uri.file(filePath);
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(fileUri, { overwrite: false });
  await vscode.workspace.applyEdit(edit);
  await vscode.workspace.fs.writeFile(
    fileUri,
    Buffer.from(content, 'utf-8'),
  );

  // Step 6: Open the file
  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc);
}
