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
      if (resourceType !== FILE_TYPE_DIR) {
        continue;
      }

      const resourceDirPath = path.join(kindDirPath, resourceName);
      const resourceFiles = await fs.readDirectory(resourceDirPath);

      const baseManifestName = `${kind}.xcaf`;
      const hasBaseManifest = resourceFiles.some(
        ([name, type]) => name === baseManifestName && type === FILE_TYPE_FILE,
      );
      if (!hasBaseManifest) {
        continue;
      }

      const baseManifest = path.join(resourceDirPath, baseManifestName);
      const overrides: OverrideFile[] = [];
      const artifactDirs: ArtifactDir[] = [];

      for (const [fileName, fileType] of resourceFiles) {
        if (fileType === FILE_TYPE_FILE) {
          const provider = parseOverrideFilename(fileName, kind);
          if (provider !== undefined) {
            overrides.push({
              provider,
              path: path.join(resourceDirPath, fileName),
            });
          }
        } else if (fileType === FILE_TYPE_DIR) {
          const artifactDirPath = path.join(resourceDirPath, fileName);
          const artifactEntries = await fs.readDirectory(artifactDirPath);
          const files = artifactEntries
            .filter(([, type]) => type === FILE_TYPE_FILE)
            .map(([name]) => name);
          artifactDirs.push({
            name: fileName,
            path: artifactDirPath,
            files,
          });
        }
      }

      resources.push({
        name: resourceName,
        kind,
        baseManifest,
        overrides,
        artifactDirs,
      });
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
