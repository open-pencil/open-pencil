import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { capturePosters } from '#landing-posters/capture'
import { landingPosterFingerprint } from '#landing-posters/fingerprint'
import { parseShard, posterFiles, posterTargets, shardTargets } from '#landing-posters/targets'

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

function argumentAfter(flag: string): string | null {
  const position = process.argv.indexOf(flag)
  return position === -1 ? null : (process.argv[position + 1] ?? '')
}

/**
 * Adds stage stills to a production docs build. The build names the fingerprint in each landing
 * page's data; this captures the stills from that build unless the cache already holds them for
 * the fingerprint, then copies them into the build. `--force` captures again.
 *
 * CI spreads the capture over runners: `--shard 2/4` captures only that part of the pages into
 * the cache, and `--assemble`, run once the parts are gathered in the cache, checks that every
 * still is there before copying them into the build.
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
  const targets = posterTargets(fingerprint)

  const shard = argumentAfter('--shard')
  if (shard !== null) {
    const part = shardTargets(targets, parseShard(shard))
    await mkdir(cacheRoot, { recursive: true })
    await capturePosters({ dist, out: cacheRoot, targets: part })
    console.log(`landing posters ${fingerprint}: shard ${shard} captured ${part.length} pages`)
    return
  }

  if (process.argv.includes('--assemble')) {
    // Recapturing here would delete the gathered stills and redo every page on one runner.
    if (process.argv.includes('--force'))
      throw new Error('--force cannot be combined with --assemble')
    const files = targets.flatMap(posterFiles)
    const missing = (
      await Promise.all(
        files.map(async (file) => ((await exists(join(cacheRoot, file))) ? [] : [file]))
      )
    ).flat()
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} of ${files.length} landing posters are missing, first ${missing[0]}`
      )
    }
    await writeFile(complete, `${targets.length}\n`)
  }

  if (process.argv.includes('--force') || !(await exists(complete))) {
    // Stills of older sources are never served again.
    await rm(join(cacheRoot, POSTERS), { recursive: true, force: true })
    await mkdir(cacheRoot, { recursive: true })
    const count = await capturePosters({ dist, out: cacheRoot, targets })
    await writeFile(complete, `${count}\n`)
  }
  await cp(cached, join(dist, POSTERS, fingerprint), { recursive: true })
  const locales = await readdir(cached)
  console.log(`landing posters ${fingerprint}: ${locales.length} locales copied into ${DIST}`)
}

await main()
