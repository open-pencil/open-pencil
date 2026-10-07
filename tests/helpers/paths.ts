import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The workspace root, found by its lockfile rather than by counting directories. */
export function workspaceRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    if (dirname(dir) === dir) throw new Error(`No workspace root above ${from}`)
  }
}

const repoRoot = workspaceRoot()

export function repoPath(...segments: string[]): string {
  return join(repoRoot, ...segments)
}

export function coreSourcePath(...segments: string[]): string {
  return repoPath('packages/core/src', ...segments)
}

export function cliSourcePath(...segments: string[]): string {
  return repoPath('packages/cli/src', ...segments)
}

export function testPath(...segments: string[]): string {
  return repoPath('tests', ...segments)
}

export function publicPath(...segments: string[]): string {
  return repoPath('public', ...segments)
}

export function requireBuiltWorkspacePackages(): void {
  const coreDist = repoPath('packages/core/dist/index.js')
  if (!existsSync(coreDist)) {
    throw new Error(
      'CLI integration tests require built workspace packages. Run `bun run check` or `bun run --filter @open-pencil/core build` first.'
    )
  }
}
