import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { lock } from 'proper-lockfile'

import { assertOwnedPath, fingerprint, isCached, publish } from './cache.ts'
import { repositoryRoot, targets } from './config.ts'
import type { BrandTarget } from './config.ts'
import { generateDesktop } from './desktop.ts'
import { validateFiles } from './validate.ts'
import { generateWeb } from './web.ts'

export type { BrandTarget } from './config.ts'

/** Build-time only. Safe to call from Vite/VitePress configs and from the CLI. */
export async function ensureBrandAssets(
  selected: readonly BrandTarget[] = targets,
  options: { root?: string; force?: boolean } = {}
): Promise<void> {
  const root = options.root ?? repositoryRoot
  const cache = join(root, '.cache/brand')
  await assertOwnedPath(root, cache)
  await mkdir(cache, { recursive: true })
  // Serialize separate Vite/docs/native processes and recover locks after crashes.
  const release = await lock(cache, {
    realpath: false,
    retries: { retries: 60, minTimeout: 100, maxTimeout: 1000, randomize: false }
  })
  try {
    const key = await fingerprint(root)
    let web: Awaited<ReturnType<typeof generateWeb>> | undefined
    for (const target of selected) {
      if (!options.force && (await isCached(root, target, key))) continue
      const files =
        target === 'desktop' ? await generateDesktop(root) : (web ??= await generateWeb(root))
      await validateFiles(files, target)
      await publish(root, target, key, files)
      console.info(`Generated ${target} brand assets`)
    }
  } finally {
    await release()
  }
}
