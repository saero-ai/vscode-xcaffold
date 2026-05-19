import * as path from 'path';

export interface OverrideFile {
  provider: string;
  path: string;
}

export interface ArtifactDir {
  name: string;
  path: string;
  files: string[];
}

export interface XcafResource {
  name: string;
  kind: string;
  scope?: string;  // e.g., 'cli', 'platform' for scoped resources like rules
  baseManifest: string;
  overrides: OverrideFile[];
  artifactDirs: ArtifactDir[];
}

export interface XcafKindGroup {
  kind: string;
  displayName: string;
  resources: XcafResource[];
}

const PLURAL_TO_SINGULAR: Record<string, string> = {
  'agents': 'agent',
  'skills': 'skill',
  'rules': 'rule',
  'workflows': 'workflow',
  'hooks': 'hooks',
  'mcp': 'mcp',
  'context': 'context',
  'settings': 'settings',
  'memories': 'memory',
  'blueprints': 'blueprint',
  'policies': 'policy',
  'global': 'global',
  'project': 'project',
};

const SINGULAR_TO_DISPLAY: Record<string, string> = {
  'agent': 'AGENTS',
  'skill': 'SKILLS',
  'rule': 'RULES',
  'workflow': 'WORKFLOWS',
  'hooks': 'HOOKS',
  'mcp': 'MCP SERVERS',
  'context': 'CONTEXTS',
  'settings': 'SETTINGS',
  'memory': 'MEMORIES',
  'blueprint': 'BLUEPRINTS',
  'policy': 'POLICIES',
  'global': 'GLOBALS',
};

export function dirNameToKind(dirName: string): string | undefined {
  return PLURAL_TO_SINGULAR[dirName];
}

export function kindToDisplayName(kind: string): string {
  return SINGULAR_TO_DISPLAY[kind] ?? (kind.toUpperCase() + 'S');
}

export function parseOverrideFilename(filename: string, kind: string): string | undefined {
  if (!filename.endsWith('.xcaf')) {
    return undefined;
  }
  // Pattern: <kind>.<provider>.xcaf — exactly 3 dot-separated segments
  const parts = filename.split('.');
  // parts: ['<kind>', '<provider>', 'xcaf'] -> length 3
  if (parts.length !== 3) {
    return undefined;
  }
  if (parts[0] !== kind) {
    return undefined;
  }
  // parts[1] is the provider segment
  return parts[1];
}

export interface FsAdapter {
  readDirectory(dirPath: string): Promise<Array<[string, number]>>;
}

const FILE_TYPE_FILE = 1;
const FILE_TYPE_DIR = 2;

async function _buildResource(
  name: string,
  kind: string,
  dirPath: string,
  files: Array<[string, number]>,
  fs: FsAdapter,
): Promise<XcafResource> {
  const baseManifestName = `${kind}.xcaf`;
  const baseManifest = path.join(dirPath, baseManifestName);
  const overrides: OverrideFile[] = [];
  const artifactDirs: ArtifactDir[] = [];

  for (const [fileName, fileType] of files) {
    if (fileType === FILE_TYPE_FILE) {
      const provider = parseOverrideFilename(fileName, kind);
      if (provider !== undefined) {
        overrides.push({
          provider,
          path: path.join(dirPath, fileName),
        });
      }
    } else if (fileType === FILE_TYPE_DIR) {
      const artifactDirPath = path.join(dirPath, fileName);
      const artifactEntries = await fs.readDirectory(artifactDirPath);
      const artifactFiles = artifactEntries
        .filter(([, type]) => type === FILE_TYPE_FILE)
        .map(([n]) => n);
      artifactDirs.push({
        name: fileName,
        path: artifactDirPath,
        files: artifactFiles,
      });
    }
  }

  return { name, kind, baseManifest, overrides, artifactDirs };
}

export async function scanXcafDirectory(
  xcafRoot: string,
  fs: FsAdapter,
): Promise<XcafKindGroup[]> {
  const topEntries = await fs.readDirectory(xcafRoot);
  const groups: XcafKindGroup[] = [];

  for (const [entryName, entryType] of topEntries) {
    if (entryType !== FILE_TYPE_DIR) {
      continue;
    }
    const kind = dirNameToKind(entryName);
    if (kind === undefined) {
      continue;
    }

    const kindDirPath = path.join(xcafRoot, entryName);
    const resourceEntries = await fs.readDirectory(kindDirPath);
    const resources: XcafResource[] = [];

    for (const [resourceName, resourceType] of resourceEntries) {
      // Flat-file kinds: .xcaf files sitting directly in the kind directory
      if (resourceType === FILE_TYPE_FILE) {
        if (resourceName.endsWith('.xcaf')) {
          const name = resourceName.slice(0, -'.xcaf'.length);
          // Skip override-style filenames (e.g. "blueprint.claude.xcaf")
          if (!name.includes('.')) {
            resources.push({
              name,
              kind,
              baseManifest: path.join(kindDirPath, resourceName),
              overrides: [],
              artifactDirs: [],
            });
          }
        }
        continue;
      }

      if (resourceType !== FILE_TYPE_DIR) {
        continue;
      }

      const resourceDirPath = path.join(kindDirPath, resourceName);
      const resourceFiles = await fs.readDirectory(resourceDirPath);

      const baseManifestName = `${kind}.xcaf`;
      const hasBaseManifest = resourceFiles.some(
        ([name, type]) => name === baseManifestName && type === FILE_TYPE_FILE,
      );

      if (hasBaseManifest) {
        // Normal (flat) resource
        const resource = await _buildResource(resourceName, kind, resourceDirPath, resourceFiles, fs);
        resources.push(resource);
      } else {
        // Check if this is a scope directory containing resource subdirectories
        const scopeSubdirs = resourceFiles.filter(([, type]) => type === FILE_TYPE_DIR);
        for (const [scopeChildName] of scopeSubdirs) {
          const scopeChildPath = path.join(resourceDirPath, scopeChildName);
          const scopeChildFiles = await fs.readDirectory(scopeChildPath);
          const hasScopeBase = scopeChildFiles.some(
            ([name, type]) => name === baseManifestName && type === FILE_TYPE_FILE,
          );
          if (hasScopeBase) {
            const resource = await _buildResource(scopeChildName, kind, scopeChildPath, scopeChildFiles, fs);
            resource.scope = resourceName;
            resources.push(resource);
          }
        }
      }
    }

    resources.sort((a, b) => a.name.localeCompare(b.name));

    groups.push({
      kind,
      displayName: kindToDisplayName(kind),
      resources,
    });
  }

  groups.sort((a, b) => a.kind.localeCompare(b.kind));

  return groups;
}

export class XcafProjectModel {
  private kindMap: Map<string, XcafKindGroup>;

  constructor(groups: XcafKindGroup[]) {
    this.kindMap = new Map();
    for (const g of groups) {
      this.kindMap.set(g.kind, g);
    }
  }

  static async scan(xcafRoot: string, fs: FsAdapter): Promise<XcafProjectModel> {
    const groups = await scanXcafDirectory(xcafRoot, fs);
    return new XcafProjectModel(groups);
  }

  getKinds(): XcafKindGroup[] {
    return Array.from(this.kindMap.values()).sort((a, b) => a.kind.localeCompare(b.kind));
  }

  getResources(kind: string): XcafResource[] {
    return this.kindMap.get(kind)?.resources ?? [];
  }

  getResource(kind: string, name: string): XcafResource | undefined {
    return this.getResources(kind).find(r => r.name === name);
  }

  // Compatibility shim — matches XcafEntry shape from xcafIndex.ts
  resolve(kind: string, name: string): { fileUri: string; kind: string; name: string; nameLine: number } | undefined {
    const resource = this.getResource(kind, name);
    if (!resource) { return undefined; }
    return { fileUri: resource.baseManifest, kind, name, nameLine: 0 };
  }

  resolveByName(name: string): { fileUri: string; kind: string; name: string; nameLine: number } | undefined {
    for (const group of this.kindMap.values()) {
      const resource = group.resources.find(r => r.name === name);
      if (resource) {
        return { fileUri: resource.baseManifest, kind: group.kind, name, nameLine: 0 };
      }
    }
    return undefined;
  }

  allEntries(): Array<{ fileUri: string; kind: string; name: string; nameLine: number }> {
    const entries: Array<{ fileUri: string; kind: string; name: string; nameLine: number }> = [];
    for (const group of this.kindMap.values()) {
      for (const resource of group.resources) {
        entries.push({ fileUri: resource.baseManifest, kind: group.kind, name: resource.name, nameLine: 0 });
      }
    }
    return entries;
  }
}
