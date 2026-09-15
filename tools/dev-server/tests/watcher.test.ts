import { expect, test } from 'bun:test'
import { once } from 'node:events'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createDevServerOptions } from '#vite-config/server'
import { createServer, type ViteDevServer } from 'vite'

const WATCH_TIMEOUT_MS = 5000

async function waitFor(check: () => boolean | Promise<boolean>, description: string) {
  const deadline = Date.now() + WATCH_TIMEOUT_MS
  while (!(await check())) {
    if (Date.now() >= deadline) throw new Error(description)
    await Bun.sleep(10)
  }
}

test('Vite invalidates source inside an active worktree while excluding nested checkouts', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'open-pencil-watch-')))
  let server: ViteDevServer | undefined
  try {
    const root = join(directory, '.worktrees', 'active')
    const sourceDir = join(root, 'src')
    const source = join(sourceDir, 'entry.ts')
    const nestedSourceDir = join(root, '.worktrees', 'other', 'src')
    await mkdir(sourceDir, { recursive: true })
    await mkdir(nestedSourceDir, { recursive: true })
    await writeFile(source, 'export const version = 1\n')
    await writeFile(join(nestedSourceDir, 'entry.ts'), 'export const nested = true\n')
    const activeServer = await createServer({
      configFile: false,
      root,
      logLevel: 'silent',
      server: { ...createDevServerOptions(undefined, root), port: 0 },
      optimizeDeps: { noDiscovery: true }
    })
    server = activeServer
    await activeServer.listen()
    expect((await activeServer.transformRequest('/src/entry.ts'))?.code).toContain('version = 1')
    await waitFor(
      () => activeServer.watcher.getWatched()[sourceDir]?.includes('entry.ts') ?? false,
      'Active worktree source is not watched'
    )
    const changed = once(activeServer.watcher, 'change', {
      signal: AbortSignal.timeout(WATCH_TIMEOUT_MS)
    })
    await writeFile(source, 'export const version = 2\n')
    const [changedPath] = await changed
    expect(changedPath).toBe(source)
    // Vite's asynchronous change handler must invalidate its transform cache too.
    await waitFor(
      async () =>
        (await activeServer.transformRequest('/src/entry.ts'))?.code.includes('version = 2') ??
        false,
      'Vite still serves the cached transform after a source change'
    )
    expect(activeServer.watcher.getWatched()[nestedSourceDir]).toBeUndefined()
  } finally {
    try {
      await server?.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
})
