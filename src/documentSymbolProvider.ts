import * as vscode from 'vscode';

export interface DocumentSymbolInfo {
  name: string;
  detail: string;
  kind: 'resource' | 'property' | 'section';
  range: { startLine: number; endLine: number };
  children?: DocumentSymbolInfo[];
}

interface FrontmatterBounds {
  startLine: number;
  endLine: number; // exclusive: line after closing --- or end of YAML
  hasDelimiters: boolean;
}

/**
 * detectFrontmatterBounds finds the frontmatter region in the text.
 * Returns null if no valid frontmatter or YAML structure is found.
 */
function detectFrontmatterBounds(lines: string[]): FrontmatterBounds | null {
  if (lines.length === 0) {
    return null;
  }

  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        return { startLine: 1, endLine: i, hasDelimiters: true };
      }
    }
    return null; // unclosed frontmatter
  }

  // Pure YAML: treat all lines as frontmatter if first line looks like YAML
  if (/^\w[\w-]*:/.test(lines[0].trim())) {
    return { startLine: 0, endLine: lines.length, hasDelimiters: false };
  }

  return null;
}

/**
 * extractYamlProperties extracts top-level YAML key names and their lines
 * from the frontmatter region.
 */
function extractYamlProperties(
  lines: string[],
  startLine: number,
  endLine: number,
): DocumentSymbolInfo[] {
  const props: DocumentSymbolInfo[] = [];
  const keyRe = /^([a-zA-Z][\w-]*):/;

  for (let i = startLine; i < endLine; i++) {
    const match = keyRe.exec(lines[i]);
    if (match) {
      props.push({
        name: match[1],
        detail: '',
        kind: 'property',
        range: { startLine: i, endLine: i },
      });
    }
  }

  return props;
}

/**
 * extractBodySections finds ## headings in the markdown body
 * after frontmatter.
 */
function extractBodySections(
  lines: string[],
  bodyStartLine: number,
): DocumentSymbolInfo[] {
  const sections: DocumentSymbolInfo[] = [];
  const headingRe = /^##\s+(.+)/;

  for (let i = bodyStartLine; i < lines.length; i++) {
    const match = headingRe.exec(lines[i]);
    if (match) {
      // Close previous section's range
      if (sections.length > 0) {
        sections[sections.length - 1].range.endLine = i - 1;
      }
      sections.push({
        name: match[1].trim(),
        detail: '',
        kind: 'section',
        range: { startLine: i, endLine: lines.length - 1 },
      });
    }
  }

  return sections;
}

/**
 * findFieldValue extracts the value of a top-level YAML field by key name.
 */
function findFieldValue(
  lines: string[],
  startLine: number,
  endLine: number,
  fieldName: string,
): string | null {
  const re = new RegExp(`^${fieldName}:\\s*(.+)$`);
  for (let i = startLine; i < endLine; i++) {
    const match = re.exec(lines[i].trim());
    if (match) {
      return match[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return null;
}

/**
 * extractDocumentSymbols parses .xcaf file text into a hierarchy of symbols.
 * Pure function: no VS Code dependency.
 */
export function extractDocumentSymbols(text: string): DocumentSymbolInfo[] {
  const lines = text.split('\n');
  const bounds = detectFrontmatterBounds(lines);
  if (!bounds) {
    return [];
  }

  const name = findFieldValue(lines, bounds.startLine, bounds.endLine, 'name');
  const kind = findFieldValue(lines, bounds.startLine, bounds.endLine, 'kind');
  if (!name) {
    return [];
  }

  const properties = extractYamlProperties(lines, bounds.startLine, bounds.endLine);

  // Body starts after closing delimiter (or does not exist for pure YAML)
  const bodyStart = bounds.hasDelimiters ? bounds.endLine + 1 : lines.length;
  const sections = extractBodySections(lines, bodyStart);

  const resource: DocumentSymbolInfo = {
    name,
    detail: kind || '',
    kind: 'resource',
    range: { startLine: 0, endLine: lines.length - 1 },
    children: [...properties, ...sections],
  };

  return [resource];
}

const SYMBOL_KIND_MAP: Record<DocumentSymbolInfo['kind'], vscode.SymbolKind> = {
  resource: vscode.SymbolKind.Module,
  property: vscode.SymbolKind.Property,
  section: vscode.SymbolKind.String,
};

/**
 * toDocumentSymbol maps a DocumentSymbolInfo tree to vscode.DocumentSymbol.
 */
function toDocumentSymbol(
  info: DocumentSymbolInfo,
): vscode.DocumentSymbol {
  const range = new vscode.Range(
    info.range.startLine, 0,
    info.range.endLine, 0,
  );
  const selectionRange = new vscode.Range(
    info.range.startLine, 0,
    info.range.startLine, 0,
  );

  const sym = new vscode.DocumentSymbol(
    info.name,
    info.detail,
    SYMBOL_KIND_MAP[info.kind],
    range,
    selectionRange,
  );

  if (info.children) {
    sym.children = info.children.map(toDocumentSymbol);
  }

  return sym;
}

/**
 * XcafDocumentSymbolProvider populates the VS Code Outline panel
 * and breadcrumb bar with the structure of .xcaf files.
 */
export class XcafDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.DocumentSymbol[] {
    const text = document.getText();
    const infos = extractDocumentSymbols(text);
    return infos.map(toDocumentSymbol);
  }
}
