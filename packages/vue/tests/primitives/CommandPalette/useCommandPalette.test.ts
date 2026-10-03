import { describe, expect, test } from 'bun:test'

import { range } from 'es-toolkit'

import { useCommandPalette } from '@open-pencil/vue'

const palette = () =>
  useCommandPalette({
    groups: [
      {
        id: 'pages',
        items: [
          { id: 'recent', label: 'Checkout' },
          { id: 'hidden', label: 'Settings archive', searchOnly: true }
        ]
      }
    ]
  })

const labels = (groups: ReturnType<typeof palette>['filteredGroups']['value']) =>
  groups.flatMap((group) => group.items.map((item) => item.label))

describe('search-only items', () => {
  test('stay out of the unfiltered list', () => {
    expect(labels(palette().filteredGroups.value)).toEqual(['Checkout'])
  })

  test('appear when the query matches them', () => {
    const { searchTerm, filteredGroups } = palette()
    searchTerm.value = 'archive'
    expect(labels(filteredGroups.value)).toEqual(['Settings archive'])
  })
})

describe('select', () => {
  test('opens children without running a command', () => {
    let ran = false
    const { select, filteredGroups, isNested } = useCommandPalette({
      groups: [
        {
          id: 'pages',
          items: [
            {
              id: 'go-to',
              label: 'Go to page',
              children: [{ id: 'page', label: 'Checkout', onSelect: () => (ran = true) }]
            }
          ]
        }
      ]
    })
    const [goTo] = filteredGroups.value[0]?.items ?? []
    expect(goTo && select(goTo)).toBe(false)
    expect(isNested.value).toBe(true)
    const [page] = filteredGroups.value[0]?.items ?? []
    expect(page && select(page)).toBe(true)
    expect(ran).toBe(true)
  })
})

describe('nested steps', () => {
  const pages = range(1, 21).map((n) => ({ id: `page-${n}`, label: `Page ${n}` }))
  const open = () => {
    const palette = useCommandPalette({
      resultLimit: 12,
      groups: [{ id: 'pages', items: [{ id: 'go-to', label: 'Go to page', children: pages }] }]
    })
    const [goTo] = palette.filteredGroups.value[0]?.items ?? []
    if (goTo) palette.select(goTo)
    return palette
  }

  test('list every item before searching', () => {
    expect(labels(open().filteredGroups.value)).toHaveLength(20)
  })

  test('still limit search results', () => {
    const { searchTerm, filteredGroups } = open()
    searchTerm.value = 'Page'
    expect(labels(filteredGroups.value)).toHaveLength(12)
  })
})
