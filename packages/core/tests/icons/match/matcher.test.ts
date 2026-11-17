import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { noop } from 'es-toolkit'
import { DEFAULT_SIZE, dHashFromPixels, parseIndex } from 'whaticon/hash'

import { getCanvasKit } from '#core/canvaskit'
import type { IconProvider } from '#core/icons'
import { coverageGrid } from '#core/icons/match/coverage'
import { createIconMatcher, svgCoverage, type IconMatcherServices } from '#core/icons/match/matcher'
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
      const grid = await svgCoverage(draw, ICONS[name] ?? '', DEFAULT_SIZE + 1, DEFAULT_SIZE)
      if (!grid) throw new Error(`${name} did not draw`)
      return dHashFromPixels(grid)
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

  test("fetches a page's candidates at once, and compares an icon it repeats once", async () => {
    const icons = testIcons()
    const match = createIconMatcher({ index: testIndex, icons, draw })
    const [house, search] = [ICONS['lucide:house'] ?? '', ICONS['lucide:search'] ?? '']

    expect(await match([house, search, house])).toEqual([
      'lucide:house',
      'lucide:search',
      'lucide:house'
    ])
    expect(await match([search])).toEqual(['lucide:search'])
    expect(icons.previews).toHaveBeenCalledTimes(1)
  })

  test('names nothing when the icons to compare with do not load, and asks again later', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(noop)
    const icons = testIcons()
    icons.previews.mockImplementationOnce(() => Promise.reject(new Error('timed out')))
    const match = createIconMatcher({ index: testIndex, icons, draw })
    const house = ICONS['lucide:house'] ?? ''

    expect(await match([house])).toEqual([null])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(await match([house])).toEqual(['lucide:house'])
  })

  test('names nothing without its index, and says so once', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(noop)
    const match = createIconMatcher({
      index: () => Promise.reject(new Error('offline')),
      icons: testIcons(),
      draw
    })

    expect(await match([ICONS['lucide:house'] ?? ''])).toEqual([null])
    expect(await match([ICONS['lucide:search'] ?? ''])).toEqual([null])
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('naming icons after a failure', () => {
  test('loads the index again on the next call after it failed', async () => {
    spyOn(console, 'warn').mockImplementation(noop)
    const index = mock(testIndex)
    index.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    const match = createIconMatcher({ index, icons: testIcons(), draw })
    const house = ICONS['lucide:house'] ?? ''

    expect(await match([house])).toEqual([null])
    expect(await match([house])).toEqual(['lucide:house'])
  })

  test('leaves an SVG unnamed when drawing it fails, and draws it again on the next call', async () => {
    spyOn(console, 'warn').mockImplementation(noop)
    let failing = true
    const flaky: IconMatcherServices['draw'] = (...args) =>
      failing ? Promise.reject(new Error('context lost')) : draw(...args)
    const match = createIconMatcher({ index: testIndex, icons: testIcons(), draw: flaky })
    const house = ICONS['lucide:house'] ?? ''

    // The index is hashed with the working renderer; only the matcher's draws fail.
    expect(await match([house])).toEqual([null])
    failing = false
    expect(await match([house])).toEqual(['lucide:house'])
  })

  test('does not keep a miss from comparing with only some of its icons', async () => {
    const icons = testIcons()
    icons.previews.mockImplementationOnce(async () => new Map())
    const match = createIconMatcher({ index: testIndex, icons, draw })
    const house = ICONS['lucide:house'] ?? ''

    expect(await match([house])).toEqual([null])
    expect(await match([house])).toEqual(['lucide:house'])
  })
})

describe('coverage', () => {
  test('centers an image in its box, as darkness on white', () => {
    // One opaque pixel and one half covered, in a 2 by 1 image.
    const image = { width: 2, height: 1, data: new Uint8Array([0, 0, 0, 255, 0, 0, 0, 128]) }

    const grid = coverageGrid(image, 4, 3)

    // The middle row of three, the image one pixel in from the left; the rest is white.
    expect([...grid.subarray(4, 8)]).toEqual([255, 0, 127, 255])
    expect(grid.filter((value) => value !== 255)).toHaveLength(2)
  })
})
