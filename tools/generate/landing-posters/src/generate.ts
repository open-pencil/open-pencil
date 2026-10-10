import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { capturePosters } from '#landing-posters/capture'
import { landingPosterFingerprint } from '#landing-posters/fingerprint'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

const DIST = 'packages/docs/.vitepress/dist'
/** Captures are kept per fingerprint, so a rebuild with unchanged stages reuses them. */
const CACHE = '.cache'
const POSTERS = 'landing-posters'

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false
  )

/**
 * Adds stage stills to a production docs build. The build names the fingerprint in each landing
 * page's data; this captures the stills from that build unless the cache already holds them for
 * the fingerprint, then copies them into the build. `--force` captures again.
 */
async function main(): Promise<void> {
  const root = await resolveWorkspaceRoot(fileURLToPath(import.meta.url))
  const fingerprint = await landingPosterFingerprint(root)
  const dist = join(root, DIST)
  const landing = await readFile(join(dist, 'index.html'), 'utf8').catch(() => '')
  if (!landing.includes(fingerprint)) {
    throw new Error(
      `The docs build in ${DIST} does not reference landing posters ${fingerprint}. ` +
        'Build it with OPENPENCIL_LANDING_POSTERS=1 (docs build:production) from the same sources.'
    )
  }

  const cacheRoot = join(root, CACHE)
  const cached = join(cacheRoot, POSTERS, fingerprint)
  const complete = `${cached}.complete`
  if (process.argv.includes('--force') || !(await exists(complete))) {
    // Stills of older sources are never served again.
    await rm(join(cacheRoot, POSTERS), { recursive: true, force: true })
    await mkdir(cacheRoot, { recursive: true })
    const count = await capturePosters({ dist, out: cacheRoot, fingerprint })
    await writeFile(complete, `${count}\n`)
  }
  await cp(cached, join(dist, POSTERS, fingerprint), { recursive: true })
  const locales = await readdir(cached)
  console.log(`landing posters ${fingerprint}: ${locales.length} locales copied into ${DIST}`)
}

await main()
