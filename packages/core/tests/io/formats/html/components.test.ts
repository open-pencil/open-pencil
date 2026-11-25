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

  test('keep the look of the element that held a set', async () => {
    const { graph } = await readHTMLDocument(
      '<div data-op-component-set="Dot" style="padding:10px;background:var(--brand)"><i data-op-component="Size=S" style="display:block;width:9px;height:9px;background:blue"></i></div>',
      { cssText: ':root { --brand: #ff0000 }', variables: {}, components: true }
    )
    const set = named(graph, 'Dot')
    expect(set.fills).toHaveLength(1)
    expect(bound(graph, set, 'fills/0/color')).toBe('brand')
    expect(named(graph, 'Size=S')).toMatchObject({ x: 10, y: 10 })
  })

  test('paint nothing behind text they wrap', async () => {
    const { graph } = await readHTMLDocument(
      '<p data-op-component="Label" style="color:white">Hi</p>',
      { components: true }
    )
    expect(named(graph, 'Label')).toMatchObject({ type: 'COMPONENT', fills: [] })
  })

  test('refuse a mark on a word inside a sentence', async () => {
    await expect(
      readHTMLDocument('<p>A <b data-op-text="Label">B</b> C</p>', { components: true })
    ).rejects.toThrow('has no layer')
  })

  test('refuse a property marked outside a component', async () => {
    await expect(
      readHTMLDocument('<p data-op-text="Label">Hi</p>', { components: true })
    ).rejects.toThrow('outside a component')
  })
})
