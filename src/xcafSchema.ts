// src/xcafSchema.ts
//
// Reusable schema data source for the xcaf language providers.
// Fetches field definitions from `xcaffold help --xcaf <kind>` and
// caches them in memory. Falls back to hardcoded schemas when the CLI
// is unavailable.

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  group: string;
  description: string;
}

export interface KindSchema {
  kind: string;
  fields: SchemaField[];
}

export const KNOWN_KINDS: readonly string[] = [
  'agent',
  'skill',
  'rule',
  'workflow',
  'mcp',
  'project',
  'settings',
  'hooks',
  'global',
  'policy',
  'blueprint',
];

/** Hardcoded fallback schemas for all known kinds. */
export const FALLBACK_SCHEMAS: ReadonlyMap<string, SchemaField[]> = new Map([
  [
    'agent',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Agent name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'tools', type: '[]string', required: false, group: 'behavior', description: 'Allowed tools' },
      { name: 'model', type: 'string', required: false, group: 'behavior', description: 'LLM model to use' },
    ],
  ],
  [
    'skill',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Skill name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'allowed-tools', type: '[]string', required: false, group: 'behavior', description: 'Tools the skill may use' },
      { name: 'activation', type: 'string', required: false, group: 'behavior', description: 'Activation trigger' },
    ],
  ],
  [
    'rule',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Rule name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'activation', type: 'string', required: false, group: 'behavior', description: 'When this rule applies' },
      { name: 'always-apply', type: 'bool', required: false, group: 'behavior', description: 'Apply to every conversation' },
    ],
  ],
  [
    'workflow',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Workflow name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'targets', type: '[]string', required: false, group: 'behavior', description: 'Target providers' },
    ],
  ],
  [
    'mcp',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'MCP server name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'command', type: 'string', required: false, group: 'behavior', description: 'Server command' },
      { name: 'args', type: '[]string', required: false, group: 'behavior', description: 'Command arguments' },
    ],
  ],
  [
    'project',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Project name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'targets', type: '[]string', required: false, group: 'behavior', description: 'Target providers' },
    ],
  ],
  [
    'settings',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Settings name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'permissions', type: 'map', required: false, group: 'behavior', description: 'Permission settings' },
    ],
  ],
  [
    'hooks',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Hooks name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'events', type: '[]string', required: false, group: 'behavior', description: 'Hook event triggers' },
    ],
  ],
  [
    'global',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
    ],
  ],
  [
    'policy',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Policy name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'assertions', type: '[]string', required: false, group: 'behavior', description: 'Policy assertions' },
    ],
  ],
  [
    'blueprint',
    [
      { name: 'kind', type: 'string', required: true, group: 'identity', description: 'Resource kind' },
      { name: 'version', type: 'string', required: true, group: 'identity', description: 'Schema version' },
      { name: 'name', type: 'string', required: true, group: 'identity', description: 'Blueprint name' },
      { name: 'description', type: 'string', required: false, group: 'identity', description: 'Short description' },
      { name: 'includes', type: '[]string', required: false, group: 'behavior', description: 'Included resources' },
      { name: 'targets', type: '[]string', required: false, group: 'behavior', description: 'Target providers' },
    ],
  ],
]);

/**
 * parseSchemaOutput extracts field definitions from `help --xcaf` output.
 * Tries JSON first, falls back to text parsing.
 */
export function parseSchemaOutput(stdout: string): SchemaField[] {
  if (!stdout.trim()) return [];

  // Try JSON parse first
  try {
    const parsed = JSON.parse(stdout);
    if (parsed.fields && Array.isArray(parsed.fields)) {
      return parsed.fields.map((f: any) => ({
        name: f.name || '',
        type: f.type || 'string',
        required: f.required === true,
        group: f.group || '',
        description: f.description || '',
      }));
    }
  } catch {
    // Not JSON -- fall through to text parsing
  }

  return parseTextSchemaOutput(stdout);
}

/** Parse the tabular text format emitted by `xcaffold help --xcaf`. */
function parseTextSchemaOutput(stdout: string): SchemaField[] {
  const lines = stdout.split('\n');
  const fields: SchemaField[] = [];
  let inFields = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'Fields:' || trimmed === 'FIELDS:') {
      inFields = true;
      continue;
    }
    if (!inFields || trimmed === '') continue;

    const parts = trimmed.split(/\s{2,}/);
    if (parts.length >= 4) {
      fields.push({
        name: parts[0],
        type: parts[1],
        required: parts[2] === 'required',
        group: parts[3] || '',
        description: parts.slice(4).join(' ') || '',
      });
    }
  }
  return fields;
}

type CliRunner = (args: string[], cwd: string) => Promise<{ stdout: string }>;

/**
 * XcafSchemaCache fetches and caches schema definitions for all known
 * xcaf resource kinds. Providers query this cache instead of calling
 * the CLI directly.
 */
export class XcafSchemaCache {
  private cache = new Map<string, KindSchema>();

  constructor(private runCli: CliRunner) {}

  /** Fetch schema for all known kinds, populating the cache. */
  async loadAll(cwd: string): Promise<void> {
    const promises = KNOWN_KINDS.map((kind) => this.loadKind(kind, cwd));
    await Promise.all(promises);
  }

  /** Return the cached schema for a kind, or undefined. */
  getSchema(kind: string): KindSchema | undefined {
    return this.cache.get(kind);
  }

  /** Find a specific field within a kind's schema. */
  getField(kind: string, fieldName: string): SchemaField | undefined {
    const schema = this.cache.get(kind);
    if (!schema) return undefined;
    return schema.fields.find((f) => f.name === fieldName);
  }

  /** Return the list of all known kinds. */
  getAllKinds(): string[] {
    return [...KNOWN_KINDS];
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private async loadKind(kind: string, cwd: string): Promise<void> {
    let fields: SchemaField[] | undefined;

    try {
      const result = await this.runCli(
        ['help', '--xcaf', kind, '--format', 'json'],
        cwd,
      );
      fields = parseSchemaOutput(result.stdout);
    } catch {
      // CLI unavailable -- use fallback below
    }

    if (!fields || fields.length === 0) {
      fields = FALLBACK_SCHEMAS.get(kind) ?? [];
    }

    this.cache.set(kind, { kind, fields });
  }
}
