import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** The workspace root, found by its lockfile rather than by counting directories. */
function workspaceRoot(from = import.meta.dir): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    if (dirname(dir) === dir) throw new Error(`No workspace root above ${from}`)
  }
}

/** Fixtures shared across the repository, such as its test fonts. */
export const FIXTURES = join(workspaceRoot(), 'tests/fixtures')
