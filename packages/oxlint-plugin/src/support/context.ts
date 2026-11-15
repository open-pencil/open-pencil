import type { ESTree } from '@oxlint/plugins'

export function normalizedPath(path: string): string {
  return path.replaceAll('\\', '/')
}

export interface FilenameContext {
  filename?: string
  physicalFilename?: string
}

export function normalizedFilename(context: FilenameContext): string {
  return normalizedPath(context.physicalFilename ?? context.filename ?? '')
}

export function isTestFile(file: string): boolean {
  return file.includes('/tests/')
}

/** The module an import or re-export names, or an inline `import()` given a fixed string. */
export function importSource(
  node:
    | ESTree.ImportDeclaration
    | ESTree.ExportAllDeclaration
    | ESTree.ExportNamedDeclaration
    | ESTree.ImportExpression
): string | null {
  const { source } = node
  if (source?.type === 'Literal') return typeof source.value === 'string' ? source.value : null
  if (source?.type === 'TemplateLiteral' && source.expressions.length === 0) {
    return source.quasis[0]?.value.cooked ?? null
  }
  return null
}
