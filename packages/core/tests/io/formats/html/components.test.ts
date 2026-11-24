import { describe, expect, test } from 'bun:test'

import { bound, kit, named } from '#core-tests/helpers/html/kit'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'

describe('components a page marks', () => {
  test('become a set with its variants and one property they share', async () => {
    const set = named(await kit(), 'Button')
    expect(set.type).toBe('COMPONENT_SET')
    expect(
      set.componentPropertyDefinitions.map(({ name, type, defaultValue, variantOptions }) => ({
        name,
        type,
        defaultValue,
        variantOptions
      }))
    ).toEqual([
      {
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Rest',
        variantOptions: ['Rest', 'Hover', 'Focus', 'Outline']
      },
      { name: 'Label', type: 'TEXT', defaultValue: 'Save', variantOptions: undefined }
    ])
  })

  test('take slots and visibility, and survive a .fig round trip', async () => {
    const bytes = await exportFigFile(await kit())
    const graph = await parseFigFile(bytes.slice().buffer)
    const card = named(graph, 'Card')
    expect(card.type).toBe('COMPONENT')
    expect(card.componentPropertyDefinitions.map(({ name, type }) => [name, type]).sort()).toEqual([
      ['Content', 'SLOT'],
      ['Hint', 'BOOLEAN']
    ])
    expect(named(graph, 'Button').componentPropertyDefinitions).toHaveLength(2)
    expect(bound(graph, named(graph, 'State=Rest'), 'fills/0/color')).toBe('primary')
  })

  test('refuse a property marked outside a component', async () => {
    await expect(
      readHTMLDocument('<p data-op-text="Label">Hi</p>', { components: true })
    ).rejects.toThrow('outside a component')
  })
})
