import { parseChecksums, readRelease, releaseFileURL, type Release, writeRelease } from './release'

/** Reads a release's `SHA256SUMS`; from GitHub by default. */
export type ChecksumSource = (release: Pick<Release, 'repository' | 'tag'>) => Promise<string>

async function checksumsFromGitHub(release: Pick<Release, 'repository' | 'tag'>): Promise<string> {
  const url = releaseFileURL(release, 'SHA256SUMS')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return response.text()
}

/**
 * Points a package's `release.json` at another release of the same fork, with the files and
 * hashes its `SHA256SUMS` lists. Returns the new pin.
 */
export async function pinRelease(
  packageDir: string,
  tag: string,
  checksums: ChecksumSource = checksumsFromGitHub
): Promise<Release> {
  const { repository } = await readRelease(packageDir)
  const release = { repository, tag, files: parseChecksums(await checksums({ repository, tag })) }
  await writeRelease(packageDir, release)
  return readRelease(packageDir)
}
