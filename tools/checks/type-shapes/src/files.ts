/**
 * Where named shapes are compared with each other, across these roots. Other packages hold
 * small value types, such as a point or a range, that match by coincidence, not by meaning.
 */
export const TYPE_SHAPE_ROOTS = [
  'src',
  'packages/core/src',
  'packages/vue/src',
  'packages/cli/src',
  'packages/mcp/src',
  'tests',
  'tools'
] as const

/** Where an inline intersection written twice in one package is caught: everywhere. */
export const INTERSECTION_ROOTS = ['src', 'packages', 'tests', 'tools'] as const

const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.worktrees'])

export function isTypeShapeSourcePath(path: string): boolean {
  if (path.endsWith('.d.ts')) return false
  return path.split(/[\\/]/).every((segment) => !EXCLUDED_DIRECTORIES.has(segment))
}

export async function discoverTypeShapeFiles(
  roots: readonly string[] = TYPE_SHAPE_ROOTS
): Promise<string[]> {
  const files: string[] = []
  for (const root of roots) {
    for await (const path of new Bun.Glob('**/*.{ts,tsx}').scan(root)) {
      if (!isTypeShapeSourcePath(path)) continue
      files.push(`${root}/${path}`)
    }
  }
  return files.sort()
}
