import { normalizePath } from '@/app/projects/schema'

/**
 * Whether a document saved at this path is one the repository holds. A repository holds what sits
 * inside its folder, so a path beside it, or a sibling whose name merely starts with the same
 * letters, is another project's document.
 */
export function documentBelongsTo(path: string, repository: string): boolean {
  const root = normalizePath(repository)
  return root !== '' && normalizePath(path).startsWith(`${root}/`)
}

/** The first of these document paths the repository holds, or null when it holds none. */
export function openDocumentPath(
  paths: readonly (string | null)[],
  repository: string
): string | null {
  return paths.find((path) => path !== null && documentBelongsTo(path, repository)) ?? null
}
