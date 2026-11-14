import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { discoverPublicPackages } from '@open-pencil/package-artifacts-tools'

import { DIST, RELEASE_FILE, readRelease, releaseFileURL, type Release, sha256 } from './release'

export interface FetchOptions {
  /** Downloads one file of a release; GitHub's release downloads by default. */
  download?: (release: Release, name: string) => Promise<Uint8Array>
}

async function downloadFromGitHub(release: Release, name: string): Promise<Uint8Array> {
  const url = releaseFileURL(release, name)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return response.bytes()
}

async function hasFile(path: string, hash: string): Promise<boolean> {
  return existsSync(path) && sha256(await readFile(path)) === hash
}

/**
 * Puts the files of `release` into a package's `dist/`, checking each against its SHA-256. Files
 * already there with their pinned hash are kept, so it downloads only on a fresh checkout or when
 * the pin changes. Nothing is written until every download matches its hash, and then files the
 * release does not list are removed, since `dist/` is what the package publishes. Returns the
 * names it downloaded.
 */
export async function fetchFiles(
  packageDir: string,
  release: Release,
  { download = downloadFromGitHub }: FetchOptions = {}
): Promise<string[]> {
  const dist = join(packageDir, DIST)
  const missing: Array<[string, string]> = []
  for (const [name, hash] of Object.entries(release.files)) {
    if (!(await hasFile(join(dist, name), hash))) missing.push([name, hash])
  }
  const downloaded = await Promise.all(
    missing.map(async ([name, hash]) => {
      const bytes = await download(release, name)
      const actual = sha256(bytes)
      if (actual !== hash) {
        throw new Error(`${name} of ${release.tag} has SHA-256 ${actual}; the pin names ${hash}`)
      }
      return [name, bytes] as const
    })
  )
  await mkdir(dist, { recursive: true })
  await Promise.all(downloaded.map(([name, bytes]) => writeFile(join(dist, name), bytes)))
  const stale = (await readdir(dist)).filter((name) => !Object.hasOwn(release.files, name))
  await Promise.all(stale.map((name) => rm(join(dist, name), { recursive: true, force: true })))
  return missing.map(([name]) => name)
}

/** Fetches the release a package's `release.json` pins into its `dist/` (`fetchFiles`). */
export async function fetchRelease(packageDir: string, options?: FetchOptions): Promise<string[]> {
  return fetchFiles(packageDir, await readRelease(packageDir), options)
}

/** The directories of the workspace's published packages that pin a fork release. */
export async function pinnedPackages(root: string): Promise<string[]> {
  const packages = await discoverPublicPackages(root)
  return packages
    .map(({ directory }) => join(root, directory))
    .filter((dir) => existsSync(join(dir, RELEASE_FILE)))
}

/** Fetches every pinned release in the workspace, reporting each package's state. */
export async function fetchAll(root: string, options?: FetchOptions): Promise<void> {
  for (const dir of await pinnedPackages(root)) {
    const fetched = await fetchRelease(dir, options)
    const { tag } = await readRelease(dir)
    const name = relative(root, dir)
    process.stdout.write(
      fetched.length === 0
        ? `${name}: ${tag} is up to date\n`
        : `${name}: fetched ${fetched.join(', ')} from ${tag}\n`
    )
  }
}
