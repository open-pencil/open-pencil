import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The CLI entry point, for tests that run it as a subprocess. */
export const CLI_ENTRY = Bun.resolveSync('#cli/index.ts', import.meta.dir)

/** The workspace root, found by its lockfile rather than by counting directories. */
export function workspaceRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    if (dirname(dir) === dir) throw new Error(`No workspace root above ${from}`)
  }
}

/** Fixtures shared across the repository; a module import would escape the package root. */
export const FIXTURES = join(workspaceRoot(), 'tests/fixtures')
