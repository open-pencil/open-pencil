import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { classifyAsset } from '#docs-config/theme/landing/download/releases'
import {
  assertInjectedChunks,
  listSourceMaps,
  sourceMapsAssetName
} from '#release/sourcemaps/bundle'

const CHUNK_ID = '\n//# chunkId=849ab7be-6ab8-5c38-8851-ee4992cad3e5\n'

async function withDist(files: Record<string, string>, run: (dist: string) => Promise<void>) {
  const dist = await mkdtemp(join(tmpdir(), 'release-sourcemaps-'))
  try {
    for (const [name, content] of Object.entries(files)) {
      await mkdir(join(dist, name, '..'), { recursive: true })
      await writeFile(join(dist, name), content)
    }
    await run(dist)
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
}

test('source maps are listed relative to dist, nested ones included', async () => {
  await withDist(
    {
      'assets/index-a1.js': 'x',
      'assets/index-a1.js.map': '{}',
      'assets/workers/render-b2.js.map': '{}',
      'index.html': ''
    },
    async (dist) => {
      expect(await listSourceMaps(dist)).toEqual([
        'assets/index-a1.js.map',
        'assets/workers/render-b2.js.map'
      ])
    }
  )
})

test('an injected chunk without a source map link passes', async () => {
  await withDist({ 'assets/a.js': `run()${CHUNK_ID}`, 'assets/a.js.map': '{}' }, async (dist) => {
    await assertInjectedChunks(dist, await listSourceMaps(dist))
  })
})

test('a build that keeps its maps may link them, as the Worker does', async () => {
  await withDist(
    { 'worker.js': `run()\n//# sourceMappingURL=worker.js.map${CHUNK_ID}`, 'worker.js.map': '{}' },
    async (dist) => {
      await assertInjectedChunks(dist, await listSourceMaps(dist), { linked: true })
    }
  )
})

test.each([
  ['no maps', {}, /No source maps/],
  ['no chunk ID', { 'a.js': 'run()', 'a.js.map': '{}' }, /no PostHog chunk ID/],
  [
    'a linked map',
    { 'a.js': `run()\n//# sourceMappingURL=a.js.map${CHUNK_ID}`, 'a.js.map': '{}' },
    /links its source map/
  ]
])('a build with %s is refused', async (_scenario, files, message) => {
  await withDist(files, async (dist) => {
    const error: unknown = await assertInjectedChunks(dist, await listSourceMaps(dist)).catch(
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toMatch(message)
  })
})

test.each([
  ['no maps', {}, /No source maps/],
  ['no chunk ID', { 'worker.js': 'run()', 'worker.js.map': '{}' }, /no PostHog chunk ID/]
])('a linked build with %s is still refused', async (_scenario, files, message) => {
  await withDist(files, async (dist) => {
    const error: unknown = await assertInjectedChunks(dist, await listSourceMaps(dist), {
      linked: true
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toMatch(message)
  })
})

test('the download page does not offer the source maps archive', () => {
  const name = sourceMapsAssetName('0.17.0')
  expect(classifyAsset({ name, url: `https://example.com/${name}`, size: 1 })).toBeNull()
})
