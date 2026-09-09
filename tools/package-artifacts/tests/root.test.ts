import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveWorkspaceRoot } from '../src/workspace/root'

test('nearest workspace lockfile isolates nested worktrees from the parent checkout', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'workspace-root-'))
  try {
    const worktree = join(parent, '.worktrees', 'feature')
    const nested = join(worktree, 'tools', 'release')
    await mkdir(nested, { recursive: true })
    for (const root of [parent, worktree]) {
      await writeFile(join(root, 'bun.lock'), '{}')
      await writeFile(join(root, 'package.json'), JSON.stringify({ workspaces: ['tools/release'] }))
    }
    await writeFile(join(worktree, '.git'), 'gitdir: /not-needed-for-discovery')
    expect(await resolveWorkspaceRoot(nested)).toBe(worktree)
    expect(await resolveWorkspaceRoot(nested, parent)).toBe(parent)
    await writeFile(join(nested, 'package.json'), JSON.stringify({ private: true }))
    await expect(resolveWorkspaceRoot(nested, '.')).rejects.toThrow('expected a workspace manifest')
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})
