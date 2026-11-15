import { describe, expect, test } from 'bun:test'

import type { IconProvider } from '#core/icons/provider'
import { createIconSetsProvider } from '#core/icons/sets'
import type { IconCollection } from '#core/icons/types'

/** A provider that answers for `prefixes`, recording the names it is asked for. */
function fake(prefixes: string[], asked: string[][]): IconProvider {
  const collection = (prefix: string): IconCollection => ({
    prefix,
    name: prefix,
    total: 1,
    category: null,
    license: null,
    multicolor: false
  })
  return {
    async icons(names, size) {
      asked.push([...names])
      return new Map(
        names.map((name) => [
          name,
          {
            prefix: name.split(':')[0] ?? '',
            name: name.split(':')[1] ?? '',
            width: size,
            height: size,
            paths: []
          }
        ])
      )
    },
    previews: async (names) => new Map(names.map((name) => [name, `<svg>${name}</svg>`])),
    search: async () => ({
      icons: prefixes.map((prefix) => `${prefix}:found`),
      total: prefixes.length,
      collections: Object.fromEntries(
        prefixes.map((prefix) => [prefix, { name: prefix, total: 1 }])
      )
    }),
    collections: async () => prefixes.map(collection),
    browse: async (prefix) => [`${prefix}:one`]
  }
}

describe('icon sets', () => {
  const setup = () => {
    const fontAsked: string[][] = []
    const iconifyAsked: string[][] = []
    const provider = createIconSetsProvider({
      sources: [{ prefixes: ['font-set'], provider: fake(['font-set'], fontAsked) }],
      fallback: fake(['lucide', 'iconify-copy'], iconifyAsked),
      replaced: ['iconify-copy']
    })
    return { provider, fontAsked, iconifyAsked }
  }

  test('asks each set’s own source for its icons, and the fallback for the rest', async () => {
    const { provider, fontAsked, iconifyAsked } = setup()
    const icons = await provider.icons(['lucide:a', 'font-set:b', 'lucide:c'], 24)
    expect([...icons.keys()].sort()).toEqual(['font-set:b', 'lucide:a', 'lucide:c'])
    expect(fontAsked).toEqual([['font-set:b']])
    expect(iconifyAsked).toEqual([['lucide:a', 'lucide:c']])
    expect(await provider.browse('font-set')).toEqual(['font-set:one'])
  })

  test('leaves the sets a source replaces out of the catalogue and searches', async () => {
    const { provider } = setup()
    expect((await provider.collections()).map((set) => set.prefix)).toEqual(['lucide', 'font-set'])
    const found = await provider.search('anything')
    expect(found.icons).toEqual(['lucide:found', 'font-set:found'])
    expect(Object.keys(found.collections)).toEqual(['lucide', 'font-set'])
  })

  test('hides a replaced set from a search or browse scoped to it', async () => {
    const { provider } = setup()
    expect((await provider.search('anything', { prefix: 'iconify-copy' })).icons).toEqual([])
    expect(await provider.browse('iconify-copy')).toEqual([])
  })

  test('takes matches from each source in turn up to the limit', async () => {
    const many = (prefix: string): IconProvider => ({
      ...fake([prefix], []),
      search: async () => ({
        icons: ['a', 'b', 'c'].map((name) => `${prefix}:${name}`),
        total: 3,
        collections: { [prefix]: { name: prefix, total: 3 } }
      })
    })
    const provider = createIconSetsProvider({
      sources: [{ prefixes: ['font-set'], provider: many('font-set') }],
      fallback: many('lucide')
    })
    expect((await provider.search('anything', { limit: 4 })).icons).toEqual([
      'lucide:a',
      'font-set:a',
      'lucide:b',
      'font-set:b'
    ])
  })

  test('keeps the icons other sources answer when one source fails', async () => {
    const offline: IconProvider = {
      ...fake(['font-set'], []),
      icons: async () => {
        throw new Error('offline')
      },
      previews: async () => {
        throw new Error('offline')
      }
    }
    const provider = createIconSetsProvider({
      sources: [{ prefixes: ['font-set'], provider: offline }],
      fallback: fake(['lucide'], [])
    })
    expect([...(await provider.previews(['lucide:a', 'font-set:b'])).keys()]).toEqual(['lucide:a'])
    await expect(provider.icons(['font-set:b'], 24)).rejects.toThrow('offline')
  })
})
