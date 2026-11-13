import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { pinRelease } from '#fork-releases/pin'
import { parseChecksums, readRelease, sha256 } from '#fork-releases/release'

const NEXT_TAG = `layout-${'b'.repeat(40)}`
const bytes = (text: string) => new TextEncoder().encode(text)

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fork-release-'))
  await writeFile(
    join(dir, 'release.json'),
    JSON.stringify({
      repository: 'open-pencil/example',
      tag: `layout-${'a'.repeat(40)}`,
      files: { 'module.js': sha256(bytes('module')) }
    })
  )
})

afterEach(() => rm(dir, { recursive: true, force: true }))

const download = (_release: unknown, name: string) => {
  const files: Record<string, string> = { 'module.js': 'next', 'NOTICES.md': 'n' }
  const text = files[name]
  return text === undefined
    ? Promise.reject(new Error(`${name}: 404`))
    : Promise.resolve(bytes(text))
}

describe('pinRelease', () => {
  test("takes the files and hashes from the release's SHA256SUMS once they download", async () => {
    const sums = `${sha256(bytes('next'))}  module.js\n${sha256(bytes('n'))}  NOTICES.md\n`
    const release = await pinRelease(dir, NEXT_TAG, { checksums: async () => sums, download })
    expect(release).toEqual({
      repository: 'open-pencil/example',
      tag: NEXT_TAG,
      files: parseChecksums(sums)
    })
    expect(await readRelease(dir)).toEqual(release)
    expect(await readFile(join(dir, 'dist', 'module.js'), 'utf8')).toBe('next')
  })

  test('keeps the old pin when a file of the new release fails', async () => {
    const before = await readRelease(dir)
    const sums = `${sha256(bytes('next'))}  module.js\n${sha256(bytes('n'))}  missing.wasm\n`
    await expect(
      pinRelease(dir, NEXT_TAG, { checksums: async () => sums, download })
    ).rejects.toThrow(/missing\.wasm/)
    expect(await readRelease(dir)).toEqual(before)
  })

  test('refuses a release that lists no files', async () => {
    await expect(
      pinRelease(dir, NEXT_TAG, { checksums: async () => '', download })
    ).rejects.toThrow(/at least one file/)
  })

  test("moves the fork's revs in a Cargo manifest to the commit it pins", async () => {
    const manifest = join(dir, 'Cargo.toml')
    const old = 'a'.repeat(40)
    const other = `other = { git = "https://github.com/open-pencil/other", rev = "${old}" }`
    await writeFile(
      manifest,
      `[patch."https://github.com/upstream/example"]\nexample = { git = "https://github.com/open-pencil/example", rev = "${old}" }\n${other}\n`
    )
    const sums = `${sha256(bytes('next'))}  module.js\n`
    await pinRelease(dir, NEXT_TAG, {
      checksums: async () => sums,
      download,
      cargoManifest: manifest
    })
    expect(await readFile(manifest, 'utf8')).toBe(
      `[patch."https://github.com/upstream/example"]\nexample = { git = "https://github.com/open-pencil/example", rev = "${'b'.repeat(40)}" }\n${other}\n`
    )
  })
})
