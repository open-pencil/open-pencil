import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fetchRelease } from '#fork-releases/fetch'
import { readRelease, type Release, sha256 } from '#fork-releases/release'

const TAG = `layout-${'a'.repeat(40)}`
const bytes = (text: string) => new TextEncoder().encode(text)

let dir: string
let published: Map<string, Uint8Array>
let downloads: string[]

const download = (release: Release, name: string) => {
  downloads.push(`${release.tag}/${name}`)
  const file = published.get(`${release.tag}/${name}`)
  if (!file) return Promise.reject(new Error(`${release.tag}/${name}: 404`))
  return Promise.resolve(file)
}

async function pin(files: Record<string, string>) {
  const release: Release = {
    repository: 'open-pencil/example',
    tag: TAG,
    files: Object.fromEntries(Object.entries(files).map(([n, t]) => [n, sha256(bytes(t))]))
  }
  await writeFile(join(dir, 'release.json'), JSON.stringify(release))
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fork-release-'))
  published = new Map([
    [`${TAG}/module.js`, bytes('module')],
    [`${TAG}/NOTICES.md`, bytes('notices')]
  ])
  downloads = []
})

afterEach(() => rm(dir, { recursive: true, force: true }))

describe('fetchRelease', () => {
  test('downloads the pinned files into dist', async () => {
    await pin({ 'module.js': 'module', 'NOTICES.md': 'notices' })
    expect((await fetchRelease(dir, { download })).toSorted()).toEqual(['NOTICES.md', 'module.js'])
    expect(await readFile(join(dir, 'dist', 'module.js'), 'utf8')).toBe('module')
  })

  test('keeps files that already match their pin', async () => {
    await pin({ 'module.js': 'module', 'NOTICES.md': 'notices' })
    await mkdir(join(dir, 'dist'))
    await writeFile(join(dir, 'dist', 'module.js'), 'module')
    await writeFile(join(dir, 'dist', 'NOTICES.md'), 'stale')
    expect(await fetchRelease(dir, { download })).toEqual(['NOTICES.md'])
    expect(downloads).toEqual([`${TAG}/NOTICES.md`])
  })

  test('refuses a file whose hash differs from its pin', async () => {
    await pin({ 'module.js': 'something else' })
    expect(fetchRelease(dir, { download })).rejects.toThrow(/module\.js .* SHA-256/)
  })

  test('rejects a release.json without a commit tag', async () => {
    await writeFile(
      join(dir, 'release.json'),
      JSON.stringify({ repository: 'open-pencil/example', tag: 'latest', files: {} })
    )
    expect(readRelease(dir)).rejects.toThrow(/release\.json/)
  })
})
