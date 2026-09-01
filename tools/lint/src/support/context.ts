import type { TSESTree } from '@typescript-eslint/utils'

export function normalizedPath(path: string): string {
  return path.replaceAll('\\', '/')
}

export interface FilenameContext {
  filename?: string
  physicalFilename?: string
  getFilename?: () => string
}

export function normalizedFilename(context: FilenameContext): string {
  return normalizedPath(
    context.physicalFilename ?? context.filename ?? context.getFilename?.() ?? ''
  )
}

export function staticPropertyName(
  property: TSESTree.Expression | TSESTree.PrivateIdentifier
): string | null {
  if (property.type === 'Identifier') return property.name
  if (property.type === 'Literal' && typeof property.value === 'string') return property.value
  return null
}

export function importSource(
  node: TSESTree.ImportDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration
): string | null {
  return typeof node.source?.value === 'string' ? node.source.value : null
}
