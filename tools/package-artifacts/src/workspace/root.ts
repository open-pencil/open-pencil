import { join, resolve } from 'node:path'

import { findWorkspaceDir, readPackageJSON } from 'pkg-types'

import { parseWorkspace } from './schema'

/** Resolve once at CLI boundaries; nearest lockfile keeps nested Git worktrees isolated. */
export async function resolveWorkspaceRoot(start: string, explicitRoot?: string): Promise<string> {
  const root = explicitRoot
    ? resolve(start, explicitRoot)
    : await findWorkspaceDir(start, { tests: ['lockFile'], lockFile: 'closest' })
  const manifest = await readPackageJSON(join(root, 'package.json'))
  parseWorkspace(manifest, root)
  return root
}
