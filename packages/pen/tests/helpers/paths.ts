import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The workspace root, found by its lockfile rather than by counting directories. */
function workspaceRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    if (dirname(dir) === dir) throw new Error(`No workspace root above ${from}`)
  }
}

/** Fixtures shared across the repository; a module import would escape the package root. */
export const FIXTURES = join(workspaceRoot(), 'tests/fixtures')
