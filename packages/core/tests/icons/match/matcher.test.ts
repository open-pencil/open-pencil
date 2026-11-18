import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { noop } from 'es-toolkit'
import { loadIndex } from 'whaticon'
import { DEFAULT_SIZE, HASH_BYTES, dHashFromPixels, parseIndex } from 'whaticon/hash'
import { coverageFromRGBA } from 'whaticon/match'

import { getCanvasKit } from '#core/canvaskit'
import type { IconProvider } from '#core/icons'
import {
  createIconMatcher,
  drawSVG,
  fetchIconIndex,
  type IconMatcherServices
} from '#core/icons/match/matcher'
import { headlessRenderNodes } from '#core/io/formats/raster'
import { createCanvasKitRasterCodec } from '#core/io/formats/raster/pixels'

// Lucide's house and search, as Iconify serves them.
const ICONS: Record<string, string> = {
  'lucide:house': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></g></svg>`,
  'lucide:search': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m21 21l-4.34-4.34"/><circle cx="11" cy="11" r="8"/></g></svg>`
}

const draw: IconMatcherServices['draw'] = async (graph, pageId, nodeId, scale) => {
  const png = await headlessRenderNodes(graph, pageId, [nodeId], { scale })
  return png && createCanvasKitRasterCodec(await getCanvasKit()).decode(png)
}

/** An index of `ICONS`, hashed as the matcher hashes what it is given. */
async function testIndex() {
  const names = Object.keys(ICONS)
  const hashes = await Promise.all(
    names.map(async (name) => {
      const image = await drawSVG(draw, ICONS[name] ?? '', DEFAULT_SIZE + 1, DEFAULT_SIZE)
      if (!image) throw new Error(`${name} did not draw`)
      return dHashFromPixels(coverageFromRGBA(image, DEFAULT_SIZE + 1, DEFAULT_SIZE))
    })
  )
  const bytes = new Uint8Array(hashes.reduce((length, hash) => length + hash.length, 0))
  hashes.forEach((hash, i) => bytes.set(hash, i * hash.length))
  return parseIndex(names.join('\n'), bytes)
}

function testIcons(): IconProvider & { previews: ReturnType<typeof mock> } {
  const previews = mock(async (names: readonly string[]) => {
    const found = new Map<string, string>()
    for (const name of names) if (ICONS[name]) found.set(name, ICONS[name])
    return found
  })
  const unused = () => Promise.reject(new Error('not used'))
  return { search: unused, icons: unused, collections: unused, browse: unused, previews }
}

afterEach(() => {
  mock.restore()
})

// whaticon's own tests cover how the matcher shortlists, compares, keeps, and retries; these
// cover it drawing with OpenPencil's renderer and icons.
describe('naming icons by how they draw', () => {
  test('names an icon a page draws at its own size, in its own color, with rounded numbers', async () => {
    const match = createIconMatcher({ index: testIndex, icons: testIcons(), draw })
    const pageCopy = (ICONS['lucide:house'] ?? '')
      .replace('width="24" height="24"', 'width="20" height="20" color="#ffffff"')
      .replace(/(\d+\.\d)\d+/g, '$1')

    expect(await match([pageCopy])).toEqual(['lucide:house'])
  })

  test('names nothing for artwork that only resembles an icon', async () => {
    const match = createIconMatcher({ index: testIndex, icons: testIcons(), draw })
    const lens = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" fill="none" stroke="black" stroke-width="2"/><rect x="16" y="16" width="5" height="5"/></svg>`

    expect(await match([lens])).toEqual([null])
  })

  test("fetches a page's candidates from the icon provider at once", async () => {
    const icons = testIcons()
    const match = createIconMatcher({ index: testIndex, icons, draw })
    const [house, search] = [ICONS['lucide:house'] ?? '', ICONS['lucide:search'] ?? '']

    expect(await match([house, search])).toEqual(['lucide:house', 'lucide:search'])
    expect(icons.previews).toHaveBeenCalledTimes(1)
  })

  test('warns once and names nothing without its index, then names again', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(noop)
    const index = mock(testIndex)
    index.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    const match = createIconMatcher({ index, icons: testIcons(), draw })
    const house = ICONS['lucide:house'] ?? ''

    expect(await match([house])).toEqual([null])
    expect(await match([house])).toEqual(['lucide:house'])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('draws an SVG again on the next call when the renderer drew no image of it', async () => {
    spyOn(console, 'warn').mockImplementation(noop)
    let drawing = false
    const blank: IconMatcherServices['draw'] = (...args) =>
      drawing ? draw(...args) : Promise.resolve(null)
    const match = createIconMatcher({ index: testIndex, icons: testIcons(), draw: blank })
    const house = ICONS['lucide:house'] ?? ''

    expect(await match([house])).toEqual([null])
    drawing = true
    expect(await match([house])).toEqual(['lucide:house'])
  })

  test("names an icon when another set's icons fail, whatever the provider does with a batch", async () => {
    const icons = testIcons()
    // A provider that fails a whole call when any of its names fails.
    icons.previews.mockImplementation((names: readonly string[]) => {
      if (names.some((name) => name.startsWith('other:'))) throw new Error('timed out')
      return Promise.resolve(
        new Map(names.flatMap((name) => (ICONS[name] ? [[name, ICONS[name]] as const] : [])))
      )
    })
    // Another set's copy of the house hashes as the house does, so it is shortlisted beside it.
    const index = async () => {
      const own = await testIndex()
      const at = own.names.indexOf('lucide:house') * HASH_BYTES
      const house = own.hashes.subarray(at, at + HASH_BYTES)
      return parseIndex(
        [...own.names, 'other:house'].join('\n'),
        new Uint8Array([...own.hashes, ...house])
      )
    }
    const match = createIconMatcher({ index, icons, draw })

    expect(await match([ICONS['lucide:house'] ?? ''])).toEqual(['lucide:house'])
    expect(icons.previews).toHaveBeenCalledWith(['other:house'])
  })

  test("names an icon against whaticon's published index", async () => {
    // The index the package ships, which jsDelivr serves for its version, read offline.
    const data = join(dirname(Bun.resolveSync('whaticon', import.meta.dir)), '..', 'data')
    const published = loadIndex(
      readFileSync(join(data, 'names.txt.gz')),
      readFileSync(join(data, 'hashes.bin.gz'))
    )
    const match = createIconMatcher({ index: async () => published, icons: testIcons(), draw })
    const pageCopy = (ICONS['lucide:house'] ?? '').replace(
      'width="24" height="24"',
      'width="20" height="20"'
    )

    expect(await match([pageCopy])).toEqual(['lucide:house'])
  })
})

describe("whaticon's index", () => {
  test('gives up at its deadline even when the fetcher ignores the signal', async () => {
    const signals: AbortSignal[] = []
    const fetcher = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal)
      return new Promise<Response>(noop)
    })
    const withPreconnect = Object.assign(fetcher, { preconnect: fetch.preconnect })

    expect(await fetchIconIndex(withPreconnect, 20).catch(String)).toContain('stopped')
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  test('cancels the other download when one fails', async () => {
    const signals: AbortSignal[] = []
    const fetcher = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal)
      if (String(input).endsWith('names.txt.gz')) return new Response('', { status: 503 })
      // The hashes stall until they are cancelled.
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })

    const withPreconnect = Object.assign(fetcher, { preconnect: fetch.preconnect })
    expect(await fetchIconIndex(withPreconnect).catch(String)).toContain('503')
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })
})
