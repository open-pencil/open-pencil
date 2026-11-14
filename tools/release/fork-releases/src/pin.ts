import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'

import { type FetchOptions, fetchFiles } from './fetch'
import { parseChecksums, readRelease, releaseFileURL, type Release, writeRelease } from './release'

/** Reads a release's `SHA256SUMS`; from GitHub by default. */
export type ChecksumSource = (release: Pick<Release, 'repository' | 'tag'>) => Promise<string>

async function checksumsFromGitHub(release: Pick<Release, 'repository' | 'tag'>): Promise<string> {
  const url = releaseFileURL(release, 'SHA256SUMS')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return response.text()
}

export interface PinOptions extends FetchOptions {
  checksums?: ChecksumSource
  /** A Cargo manifest whose git `rev`s of the fork move with the pin, such as the root `Cargo.toml`. */
  cargoManifest?: string
}

/** The commit a release's tag, `<name>-<commit>`, was built from. */
const commitOf = (tag: string) => tag.slice(-40)

/**
 * A Cargo manifest with each dependency or patch that takes `repository` at commit `from` moved to
 * commit `to`, so Rust built in the workspace uses the commit a package pins.
 */
function movedCargoRevs(text: string, repository: string, from: string, to: string): string {
  const source = `git = "https://github.com/${repository}"`
  return text
    .split('\n')
    .map((line) =>
      line.includes(source) ? line.replaceAll(`rev = "${from}"`, `rev = "${to}"`) : line
    )
    .join('\n')
}

/**
 * Points a package's `release.json` at another release of the same fork, with the files and
 * hashes its `SHA256SUMS` lists, once every file has downloaded into `dist/` and matched its hash,
 * and moves `cargoManifest`'s `rev`s of the fork along; a release that fails leaves the pin as it
 * was. Returns the new pin.
 */
export async function pinRelease(
  packageDir: string,
  tag: string,
  { checksums = checksumsFromGitHub, cargoManifest, ...fetchOptions }: PinOptions = {}
): Promise<Release> {
  const { repository, tag: before } = await readRelease(packageDir)
  const release = { repository, tag, files: parseChecksums(await checksums({ repository, tag })) }
  await fetchFiles(packageDir, release, fetchOptions)
  const manifest =
    cargoManifest && existsSync(cargoManifest) ? await readFile(cargoManifest, 'utf8') : null
  // The manifest moves first: a retry after `release.json` failed finds it moved and writes the pin.
  if (cargoManifest && manifest !== null) {
    const moved = movedCargoRevs(manifest, repository, commitOf(before), commitOf(tag))
    if (moved !== manifest) await writeFile(cargoManifest, moved)
  }
  await writeRelease(packageDir, release)
  return readRelease(packageDir)
}
