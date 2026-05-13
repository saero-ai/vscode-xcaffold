// src/resourceTemplates.ts
//
// Embedded template strings for all xcaf resource kinds.
// Each kind has a Minimal template (identity fields only) and optionally
// a Full template (all fields with placeholder values). Pure functions
// that take a name and optional description, returning complete .xcaf
// file content as a string.

import { FALLBACK_SCHEMAS, KNOWN_KINDS, SchemaField } from './xcafSchema';

export type TemplateVariant = 'minimal' | 'full';

export interface TemplateParams {
  name: string;
  description?: string;
}

/** Kinds that support both minimal and full template variants. */
const FULL_VARIANT_KINDS: ReadonlySet<string> = new Set([
  'agent',
  'skill',
  'rule',
  'workflow',
]);

/** Default body text per kind, shown after the closing `---`. */
const BODY_TEXT: ReadonlyMap<string, string> = new Map([
  ['agent', '# Agent instructions go here'],
  ['skill', '# Skill instructions go here'],
  ['rule', '# Rule content goes here'],
  ['workflow', '# Workflow steps go here'],
  ['mcp', ''],
  ['project', ''],
  ['settings', ''],
  ['hooks', ''],
  ['global', ''],
  ['policy', ''],
  ['blueprint', ''],
]);

/**
 * Default placeholder values for behavior fields in full templates.
 * Keyed by `kind.fieldName` for kind-specific defaults, or just
 * `fieldName` for generic defaults.
 */
const FIELD_DEFAULTS: ReadonlyMap<string, string> = new Map([
  ['agent.tools', '  - Read\n  - Edit\n  - Write\n  - Bash\n  - Glob\n  - Grep'],
  ['agent.model', 'sonnet'],
  ['skill.allowed-tools', '  - Read\n  - Edit\n  - Write\n  - Bash\n  - Glob\n  - Grep'],
  ['skill.activation', 'manual'],
  ['rule.activation', 'always'],
  ['rule.always-apply', 'false'],
  ['workflow.targets', '  - claude\n  - cursor'],
  ['mcp.command', 'npx'],
  ['mcp.args', '  - -y\n  - my-mcp-server'],
  ['project.targets', '  - claude\n  - cursor'],
  ['settings.permissions', '{}'],
  ['hooks.events', '  - pre-commit\n  - post-commit'],
  ['policy.assertions', '  - all-resources-have-descriptions'],
  ['blueprint.includes', '  - agents/*\n  - rules/*'],
  ['blueprint.targets', '  - claude\n  - cursor'],
]);

/**
 * Returns true when the given kind supports the requested variant.
 * All kinds support 'minimal'. Only kinds in FULL_VARIANT_KINDS
 * support 'full'.
 */
export function supportsVariant(
  kind: string,
  variant: TemplateVariant,
): boolean {
  if (variant === 'minimal') {
    return KNOWN_KINDS.includes(kind);
  }
  return FULL_VARIANT_KINDS.has(kind);
}

/**
 * Returns the list of supported variants for a kind.
 */
export function supportedVariants(kind: string): TemplateVariant[] {
  if (!KNOWN_KINDS.includes(kind)) {
    return [];
  }
  if (FULL_VARIANT_KINDS.has(kind)) {
    return ['minimal', 'full'];
  }
  return ['minimal'];
}

/**
 * Render a .xcaf file template for the given kind and variant.
 *
 * Returns the complete file content including frontmatter delimiters
 * and a body section. Throws if the kind is unknown or the variant
 * is not supported for the kind.
 */
export function renderTemplate(
  kind: string,
  variant: TemplateVariant,
  params: TemplateParams,
): string {
  if (!KNOWN_KINDS.includes(kind)) {
    throw new Error(`Unknown kind: ${kind}`);
  }
  if (!supportsVariant(kind, variant)) {
    throw new Error(
      `Kind "${kind}" does not support variant "${variant}"`,
    );
  }

  const fields = FALLBACK_SCHEMAS.get(kind) ?? [];
  const lines: string[] = ['---'];

  appendIdentityFields(lines, kind, fields, params);

  if (variant === 'full') {
    appendBehaviorFields(lines, kind, fields);
  }

  lines.push('---');

  const body = BODY_TEXT.get(kind) ?? '';
  if (body) {
    lines.push('');
    lines.push(body);
  }

  return lines.join('\n') + '\n';
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function appendIdentityFields(
  lines: string[],
  kind: string,
  fields: readonly SchemaField[],
  params: TemplateParams,
): void {
  lines.push(`kind: ${kind}`);
  lines.push('version: "1.0"');

  const hasName = fields.some((f) => f.name === 'name');
  if (hasName) {
    lines.push(`name: ${params.name}`);
  }

  const hasDescription = fields.some((f) => f.name === 'description');
  if (hasDescription) {
    const desc = params.description ?? 'A brief description';
    lines.push(`description: ${desc}`);
  }
}

function appendBehaviorFields(
  lines: string[],
  kind: string,
  fields: readonly SchemaField[],
): void {
  const behaviorFields = fields.filter(
    (f) => f.group === 'behavior',
  );

  for (const field of behaviorFields) {
    const value = resolveFieldDefault(kind, field);
    if (isMultilineValue(value)) {
      lines.push(`${field.name}:`);
      lines.push(value);
    } else {
      lines.push(`${field.name}: ${value}`);
    }
  }
}

function resolveFieldDefault(
  kind: string,
  field: SchemaField,
): string {
  const specific = FIELD_DEFAULTS.get(`${kind}.${field.name}`);
  if (specific !== undefined) {
    return specific;
  }
  return defaultForType(field.type);
}

function defaultForType(type: string): string {
  switch (type) {
    case '[]string':
      return '  - example';
    case 'bool':
      return 'false';
    case 'map':
      return '{}';
    default:
      return '""';
  }
}

function isMultilineValue(value: string): boolean {
  return value.includes('\n');
}
