import { describe, expect, test } from 'bun:test'

import {
  clearIconCache,
  fetchIcon,
  fetchIcons,
  searchIcons,
  searchIconsBatch
} from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

const ICONIFY_API = 'https://api.iconify.design'

const ICON_FIXTURES = {
  mdi: {
    home: '<path d="M3 11L12 3L21 11V21H15V15H9V21H3Z"/>',
    heart:
      '<path d="M12 21C7 17 4 14 4 10C4 7 6 5 9 5C10.5 5 11.5 6 12 7C12.5 6 13.5 5 15 5C18 5 20 7 20 10C20 14 17 17 12 21Z"/>',
    star: '<path d="M12 2L15 9H22L17 14L19 21L12 17L5 21L7 14L2 9H9Z"/>'
  },
  lucide: {
    heart:
      '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6C19 2.8 16 2.8 14.2 4.6L12 6.8L9.8 4.6C8 2.8 5 2.8 3.2 4.6C1.4 6.4 1.4 9.4 3.2 11.2L12 20L20.8 11.2C22.6 9.4 22.6 6.4 20.8 4.6Z"/></g>',
    home: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11L12 3L21 11"/><path d="M5 10V21H19V10"/></g>',
    search:
      '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20L16 16"/></g>',
    star: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15 9H22L17 14L19 21L12 17L5 21L7 14L2 9H9Z"/></g>'
  },
  heroicons: {
    eye: '<path d="M2 12C4 7 8 5 12 5C16 5 20 7 22 12C20 17 16 19 12 19C8 19 4 17 2 12Z"/><circle cx="12" cy="12" r="3"/>'
  }
} as const

interface IconifyRequestLog {
  path: string
  icons: string[]
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function iconCollectionResponse(prefix: string, iconNames: string[]): Response {
  const collection = ICON_FIXTURES[prefix as keyof typeof ICON_FIXTURES]
  if (!collection) return jsonResponse({ error: 'Unknown prefix' }, 404)

  const icons = Object.fromEntries(
    iconNames.flatMap((name) => {
      const body = collection[name as keyof typeof collection]
      return body ? [[name, { body }]] : []
    })
  )

  return jsonResponse({ prefix, width: 24, height: 24, icons })
}

function searchResponse(url: URL): Response {
  const prefix = url.searchParams.get('prefix')
  const query = url.searchParams.get('query') ?? ''
  const baseIcons =
    query === 'arrow' ? ['lucide:arrow-right', 'mdi:arrow-left'] : ['mdi:heart', 'lucide:heart']
  const icons = prefix ? baseIcons.filter((name) => name.startsWith(`${prefix}:`)) : baseIcons
  return jsonResponse({
    icons,
    total: icons.length,
    collections: {
      mdi: { name: 'Material Design Icons', total: 2 },
      lucide: { name: 'Lucide', total: 2 }
    }
  })
}

async function withMockedIconifyApi(
  run: (requests: IconifyRequestLog[]) => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch
  const requests: IconifyRequestLog[] = []
  clearIconCache()

  const mockedFetch: typeof fetch = async (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input)
    if (!requestUrl.startsWith(ICONIFY_API)) return originalFetch(input, init)

    const url = new URL(requestUrl)
    const icons = url.searchParams.get('icons')?.split(',').filter(Boolean) ?? []
    requests.push({ path: url.pathname, icons })

    if (url.pathname === '/search') return searchResponse(url)
    if (!url.pathname.endsWith('.json')) return jsonResponse({ error: 'Unsupported path' }, 404)

    const prefix = url.pathname.slice(1, -'.json'.length)
    return iconCollectionResponse(prefix, icons)
  }

  globalThis.fetch = mockedFetch

  try {
    await run(requests)
  } finally {
    clearIconCache()
    globalThis.fetch = originalFetch
  }
}

const iconifyTest = (name: string, fn: () => Promise<void>, timeout?: number): void =>
  test(name, () => withMockedIconifyApi(() => fn()), timeout)

describe('fetchIcon', () => {
  iconifyTest('fetches mdi:home', async () => {
    const icon = await fetchIcon('mdi:home', 24)
    expect(icon.prefix).toBe('mdi')
    expect(icon.name).toBe('home')
    expect(icon.width).toBe(24)
    expect(icon.height).toBe(24)
    expect(icon.paths.length).toBeGreaterThan(0)

    const path = icon.paths[0]
    expect(path.vectorNetwork.vertices.length).toBeGreaterThan(3)
    expect(path.vectorNetwork.segments.length).toBeGreaterThan(3)
    expect(path.fill).toBe('currentColor')
    expect(path.stroke).toBeNull()
  })

  iconifyTest('fetches lucide:heart (stroked icon)', async () => {
    const icon = await fetchIcon('lucide:heart', 24)
    expect(icon.paths.length).toBeGreaterThan(0)

    const path = icon.paths[0]
    expect(path.vectorNetwork.vertices.length).toBeGreaterThan(3)
    expect(path.stroke).toBe('currentColor')
    expect(path.strokeWidth).toBe(2)
    expect(path.strokeCap).toBe('round')
    expect(path.strokeJoin).toBe('round')
  })

  iconifyTest('scales to custom size', async () => {
    const icon = await fetchIcon('mdi:home', 48)
    expect(icon.width).toBe(48)
    expect(icon.height).toBe(48)
  })

  test('caches repeated fetches', async () => {
    await withMockedIconifyApi(async (requests) => {
      const a = await fetchIcon('mdi:home', 24)
      const b = await fetchIcon('mdi:home', 24)
      expect(a).toBe(b)
      expect(requests).toEqual([{ path: '/mdi.json', icons: ['home'] }])
    })
  })

  iconifyTest('throws on invalid icon name format', async () => {
    await expect(fetchIcon('invalid')).rejects.toThrow('prefix:name')
  })

  iconifyTest('throws on non-existent icon', async () => {
    await expect(fetchIcon('mdi:this-icon-definitely-does-not-exist-xyz123')).rejects.toThrow(
      'not found'
    )
  })

  iconifyTest('heroicons:eye — multi-path icon with group attrs', async () => {
    const icon = await fetchIcon('heroicons:eye', 24)
    expect(icon.paths.length).toBeGreaterThanOrEqual(2)
  })
})

describe('fetchIcons (batch)', () => {
  test('fetches multiple icons from same prefix in one request', async () => {
    await withMockedIconifyApi(async (requests) => {
      const icons = await fetchIcons(['lucide:star', 'lucide:home', 'lucide:search'], 24)
      expect(icons.size).toBe(3)
      expect(icons.get('lucide:star')).toBeDefined()
      expect(icons.get('lucide:home')).toBeDefined()
      expect(icons.get('lucide:search')).toBeDefined()
      expect(requests).toEqual([{ path: '/lucide.json', icons: ['star', 'home', 'search'] }])
    })
  })

  iconifyTest('fetches icons across multiple prefixes', async () => {
    const icons = await fetchIcons(['mdi:heart', 'lucide:heart'], 24)
    expect(icons.size).toBe(2)
    expect(icons.get('mdi:heart')?.prefix).toBe('mdi')
    expect(icons.get('lucide:heart')?.prefix).toBe('lucide')
  })

  iconifyTest('skips non-existent icons without failing', async () => {
    const icons = await fetchIcons(['mdi:home', 'mdi:nonexistent-xyz-999'], 24)
    expect(icons.has('mdi:home')).toBe(true)
    expect(icons.has('mdi:nonexistent-xyz-999')).toBe(false)
  })

  test('populates cache for subsequent fetchIcon calls', async () => {
    await withMockedIconifyApi(async (requests) => {
      await fetchIcons(['mdi:star'], 24)
      const icon = await fetchIcon('mdi:star', 24)
      expect(icon.prefix).toBe('mdi')
      expect(requests).toEqual([{ path: '/mdi.json', icons: ['star'] }])
    })
  })
})

describe('searchIcons', () => {
  iconifyTest('searches for heart icons', async () => {
    const result = await searchIcons('heart', { limit: 10 })
    expect(result.icons.length).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)
    expect(result.icons[0]).toContain(':')
  })

  iconifyTest('filters by prefix', async () => {
    const result = await searchIcons('home', { limit: 5, prefix: 'lucide' })
    for (const icon of result.icons) {
      expect(icon.startsWith('lucide:')).toBe(true)
    }
  })
})

describe('searchIconsBatch', () => {
  iconifyTest('searches multiple queries in parallel', async () => {
    const results = await searchIconsBatch(['heart', 'arrow'], { limit: 5 })
    expect(results.size).toBe(2)
    expect(expectDefined(results.get('heart'), 'heart results').icons.length).toBeGreaterThan(0)
    expect(expectDefined(results.get('arrow'), 'arrow results').icons.length).toBeGreaterThan(0)
  })
})
