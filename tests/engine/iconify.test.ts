import { describe, expect, test, beforeAll } from 'bun:test'

import { fetchIcon, fetchIcons, searchIcons, searchIconsBatch } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

let hasNetwork = true
beforeAll(async () => {
  try {
    await fetch('https://api.iconify.design/mdi.json?icons=home', {
      signal: AbortSignal.timeout(3000)
    })
  } catch {
    hasNetwork = false
    console.warn('⚠ Skipping iconify tests — no network')
  }
})

const networkTest: typeof test = (name, fn, timeout) =>
  test(
    name,
    async () => {
      if (!hasNetwork) return
      await (fn as () => Promise<void>)()
    },
    timeout
  )

describe('fetchIcon', () => {
  networkTest('fetches mdi:home', async () => {
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

  networkTest('fetches lucide:heart (stroked icon)', async () => {
    const icon = await fetchIcon('lucide:heart', 24)
    expect(icon.paths.length).toBeGreaterThan(0)

    const path = icon.paths[0]
    expect(path.vectorNetwork.vertices.length).toBeGreaterThan(3)
    expect(path.stroke).toBe('currentColor')
    expect(path.strokeWidth).toBe(2)
    expect(path.strokeCap).toBe('round')
    expect(path.strokeJoin).toBe('round')
  })

  networkTest('scales to custom size', async () => {
    const icon = await fetchIcon('mdi:home', 48)
    expect(icon.width).toBe(48)
    expect(icon.height).toBe(48)
  })

  networkTest('caches repeated fetches', async () => {
    const a = await fetchIcon('mdi:home', 24)
    const b = await fetchIcon('mdi:home', 24)
    expect(a).toBe(b)
  })

  networkTest('throws on invalid icon name format', async () => {
    await expect(fetchIcon('invalid')).rejects.toThrow('prefix:name')
  })

  networkTest('throws on non-existent icon', async () => {
    await expect(fetchIcon('mdi:this-icon-definitely-does-not-exist-xyz123')).rejects.toThrow(
      'not found'
    )
  })

  networkTest('heroicons:eye — multi-path icon with group attrs', async () => {
    const icon = await fetchIcon('heroicons:eye', 24)
    expect(icon.paths.length).toBeGreaterThanOrEqual(2)
  })
})

describe('fetchIcons (batch)', () => {
  networkTest('fetches multiple icons from same prefix in one request', async () => {
    const icons = await fetchIcons(['lucide:star', 'lucide:home', 'lucide:search'], 24)
    expect(icons.size).toBe(3)
    expect(icons.get('lucide:star')).toBeDefined()
    expect(icons.get('lucide:home')).toBeDefined()
    expect(icons.get('lucide:search')).toBeDefined()
  })

  networkTest('fetches icons across multiple prefixes', async () => {
    const icons = await fetchIcons(['mdi:heart', 'lucide:heart'], 24)
    expect(icons.size).toBe(2)
    expect(icons.get('mdi:heart')?.prefix).toBe('mdi')
    expect(icons.get('lucide:heart')?.prefix).toBe('lucide')
  })

  networkTest('skips non-existent icons without failing', async () => {
    const icons = await fetchIcons(['mdi:home', 'mdi:nonexistent-xyz-999'], 24)
    expect(icons.has('mdi:home')).toBe(true)
    expect(icons.has('mdi:nonexistent-xyz-999')).toBe(false)
  })

  networkTest('populates cache for subsequent fetchIcon calls', async () => {
    await fetchIcons(['mdi:star'], 24)
    const icon = await fetchIcon('mdi:star', 24)
    expect(icon.prefix).toBe('mdi')
  })
})

describe('searchIcons', () => {
  networkTest('searches for heart icons', async () => {
    const result = await searchIcons('heart', { limit: 10 })
    expect(result.icons.length).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)
    expect(result.icons[0]).toContain(':')
  })

  networkTest('filters by prefix', async () => {
    const result = await searchIcons('home', { limit: 5, prefix: 'lucide' })
    for (const icon of result.icons) {
      expect(icon.startsWith('lucide:')).toBe(true)
    }
  })
})

describe('searchIconsBatch', () => {
  networkTest('searches multiple queries in parallel', async () => {
    const results = await searchIconsBatch(['heart', 'arrow'], { limit: 5 })
    expect(results.size).toBe(2)
    expect(expectDefined(results.get('heart'), 'heart results').icons.length).toBeGreaterThan(0)
    expect(expectDefined(results.get('arrow'), 'arrow results').icons.length).toBeGreaterThan(0)
  })
})
