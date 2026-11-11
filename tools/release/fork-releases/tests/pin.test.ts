import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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

describe('pinRelease', () => {
  test("takes the files and hashes from the release's SHA256SUMS", async () => {
    const sums = `${sha256(bytes('next'))}  module.js\n${sha256(bytes('n'))}  NOTICES.md\n`
    const release = await pinRelease(dir, NEXT_TAG, async ({ tag }) => {
      expect(tag).toBe(NEXT_TAG)
      return sums
    })
    expect(release).toEqual({
      repository: 'open-pencil/example',
      tag: NEXT_TAG,
      files: parseChecksums(sums)
    })
    expect(await readRelease(dir)).toEqual(release)
  })
})
