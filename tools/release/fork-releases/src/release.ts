import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import * as v from 'valibot'

/** The file in a package that pins a release of one of OpenPencil's forks. */
export const RELEASE_FILE = 'release.json'

/** Where a package keeps the files of the release it pins. */
export const DIST = 'dist'

const sha256Schema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))

const releaseSchema = v.object({
  /** The fork, as `owner/name` on GitHub. */
  repository: v.pipe(v.string(), v.regex(/^[\w.-]+\/[\w.-]+$/)),
  /** The release's tag, `<name>-<commit>`, made by the fork's workflow for each commit it builds. */
  tag: v.pipe(v.string(), v.regex(/^[\w.-]+-[0-9a-f]{40}$/)),
  /** Each file of the release with its SHA-256; a release has at least one. */
  files: v.pipe(
    v.record(v.pipe(v.string(), v.regex(/^[\w.-]+$/)), sha256Schema),
    v.check((files) => Object.keys(files).length > 0, 'A release lists at least one file.')
  )
})

export type Release = v.InferOutput<typeof releaseSchema>

export async function readRelease(packageDir: string): Promise<Release> {
  const path = join(packageDir, RELEASE_FILE)
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), releaseSchema),
    await readFile(path, 'utf8')
  )
  if (!parsed.success) throw new Error(`${path}: ${v.summarize(parsed.issues)}`)
  return parsed.output
}

export async function writeRelease(packageDir: string, release: Release): Promise<void> {
  await writeFile(join(packageDir, RELEASE_FILE), `${JSON.stringify(release, null, 2)}\n`)
}

/** The URL of one file of a release. */
export function releaseFileURL(release: Pick<Release, 'repository' | 'tag'>, name: string): string {
  return `https://github.com/${release.repository}/releases/download/${release.tag}/${name}`
}

/** The files and hashes a `SHA256SUMS` lists, as `sha256sum` writes it. */
export function parseChecksums(text: string): Release['files'] {
  const files: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    const match = /^([0-9a-f]{64}) [ *]([\w.-]+)$/.exec(line.trim())
    if (!match) throw new Error(`SHA256SUMS: cannot read ${JSON.stringify(line)}`)
    files[match[2]] = match[1]
  }
  return v.parse(releaseSchema.entries.files, files)
}

export const sha256 = (bytes: Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
