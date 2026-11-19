import { existsSync } from 'node:fs'

import { repoPath } from '@open-pencil/test-support/paths'

/** The CLI entry point, for tests that run it as a subprocess. */
export const CLI_ENTRY = Bun.resolveSync('#cli/index.ts', import.meta.dir)

/** Fails fast when a test needs the workspace packages built, as the CLI's dist imports do. */
export function requireBuiltWorkspacePackages(): void {
  if (!existsSync(repoPath('packages/core/dist/index.js'))) {
    throw new Error(
      'CLI integration tests require built workspace packages. Run `bun run build:packages` first.'
    )
  }
}
