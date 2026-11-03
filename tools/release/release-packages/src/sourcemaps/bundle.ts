import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The PostHog release every OpenPencil build's chunks are associated with, by version. */
export const POSTHOG_RELEASE_NAME = 'openpencil'

/** The release asset holding a version's source maps, beside its installers. */
export function sourceMapsAssetName(version: string): string {
  return `OpenPencil_${version}_sourcemaps.tar.gz`
}

/** Every `.map` file under `dist`, as paths relative to it, sorted. */
export async function listSourceMaps(dist: string): Promise<string[]> {
  const entries = await readdir(dist, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.map'))
    .map((entry) => join(entry.parentPath, entry.name).slice(dist.length + 1))
    .sort()
}

const CHUNK_ID_COMMENT = /\n\/\/# chunkId=\S+\s*$/
const SOURCE_MAPPING_URL = /\/\/# sourceMappingURL=/

/**
 * Checks that every chunk with a map carries the chunk ID PostHog matches stack frames by, and no
 * `sourceMappingURL`: the maps leave the build, so a browser must never be told to fetch them.
 */
export async function assertInjectedChunks(dist: string, maps: string[]): Promise<void> {
  if (maps.length === 0) {
    throw new Error(`No source maps in ${dist}; release builds need VITE_OPENPENCIL_FEEDBACK=on`)
  }
  for (const map of maps) {
    const chunk = map.slice(0, -'.map'.length)
    const code = await readFile(join(dist, chunk), 'utf8')
    if (SOURCE_MAPPING_URL.test(code)) throw new Error(`${chunk} links its source map`)
    if (!CHUNK_ID_COMMENT.test(code)) throw new Error(`${chunk} has no PostHog chunk ID`)
  }
}
