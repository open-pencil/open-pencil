import { describe, expect, test } from 'bun:test'

import { createIconifyAPIClient } from '#core/icons/api'
import { createIconifyProvider } from '#core/icons/provider'

const SET = {
  prefix: 'test',
  width: 24,
  height: 24,
  icons: {
    square: { body: '<path fill="currentColor" d="M2 2h20v20H2z"/>' },
    wide: { body: '<path fill="currentColor" d="M0 0h32v16H0z"/>', width: 32, height: 16 }
  },
  aliases: { box: { parent: 'square' } }
}

const CATALOGUE = {
  test: { name: 'Test Icons', total: 3, category: 'General', license: { title: 'MIT' } },
  logos: { name: 'Logos', total: 9, palette: true },
  retired: { name: 'Retired', total: 1, hidden: true }
}

const LIST = {
  uncategorized: ['square'],
  categories: { Shapes: ['wide', 'square'], Boxes: ['box'] }
}

/**
 * A provider over a fake API that serves `SET`, `CATALOGUE`, and `LIST`, counting its requests.
 * `failing` lists paths that answer 500 until removed.
 */
function setup() {
  const requests: string[] = []
  const failing = new Set<string>()
  const fetcher = async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requests.push(url.pathname + url.search)
    if (failing.has(url.pathname)) return new Response('', { status: 500 })
    if (url.pathname === '/collections') return Response.json(CATALOGUE)
    if (url.pathname === '/collection') return Response.json(LIST)
    return Response.json(SET)
  }
  const provider = createIconifyProvider(
    createIconifyAPIClient(fetcher as typeof fetch, 'https://icons.test')
  )
  return { provider, requests, failing }
}

describe('Iconify provider', () => {
  test('previews draw each icon in its own box, with the color left to the page', async () => {
    const { provider } = setup()
    const previews = await provider.previews(['test:square', 'test:wide', 'test:box', 'test:gone'])

    expect([...previews.keys()]).toEqual(['test:square', 'test:wide', 'test:box'])
    expect(previews.get('test:wide')).toContain('viewBox="0 0 32 16"')
    expect(previews.get('test:square')).toContain('fill="currentColor"')
    expect(previews.get('test:box')).toBe(previews.get('test:square'))
  })

  test('previews and placed icons share one request per set', async () => {
    const { provider, requests } = setup()
    await provider.previews(['test:square', 'test:wide'])
    const icons = await provider.icons(['test:square', 'test:wide'], 48)

    expect(requests).toHaveLength(1)
    expect(icons.get('test:wide')).toMatchObject({ name: 'wide', width: 48 })
  })

  test('a long list of names is split over several requests', async () => {
    const { provider, requests } = setup()
    const names = Array.from({ length: 250 }, (_, index) => `test:icon-${index}`)
    await provider.previews(names)

    expect(requests).toHaveLength(3)
  })

  test('overlapping loads share requests, and a name the set lacks is not asked for again', async () => {
    const { provider, requests } = setup()
    await Promise.all([
      provider.previews(['test:square', 'test:gone']),
      provider.icons(['test:square'], 24)
    ])
    await provider.previews(['test:gone'])

    expect(requests).toHaveLength(1)
  })

  test('a failed load is asked for again', async () => {
    const { provider, requests, failing } = setup()
    failing.add('/test.json')
    await expect(provider.previews(['test:square'])).rejects.toThrow('500')

    failing.clear()
    expect((await provider.previews(['test:square'])).has('test:square')).toBe(true)
    expect(requests).toHaveLength(2)
  })

  test('a name without a set is refused', async () => {
    const { provider } = setup()
    await expect(provider.previews(['square'])).rejects.toThrow('prefix:name')
  })

  test('the set catalogue leaves out retired sets and is loaded once', async () => {
    const { provider, requests } = setup()
    const sets = await provider.collections()
    await provider.collections()

    expect(sets).toEqual([
      {
        prefix: 'test',
        name: 'Test Icons',
        total: 3,
        category: 'General',
        license: 'MIT',
        multicolor: false
      },
      { prefix: 'logos', name: 'Logos', total: 9, category: null, license: null, multicolor: true }
    ])
    expect(requests).toEqual(['/collections'])
  })

  test('browsing lists every icon in a set once, loose ones first', async () => {
    const { provider, requests } = setup()
    const names = await provider.browse('test')
    await provider.browse('test')

    expect(names).toEqual(['test:square', 'test:wide', 'test:box'])
    expect(requests).toEqual(['/collection?prefix=test'])
  })

  test('a failed catalogue is asked for again', async () => {
    const { provider, failing } = setup()
    failing.add('/collections')
    await expect(provider.collections()).rejects.toThrow('500')

    failing.clear()
    expect(await provider.collections()).toHaveLength(2)
  })
})
