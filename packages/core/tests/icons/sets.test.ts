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
})
