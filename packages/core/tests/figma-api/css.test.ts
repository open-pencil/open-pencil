import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

import { renderNodesToHTML } from '#core/io/formats/html'

const RED = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] as const
const BLUE = [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] as const

describe('getCSSAsync', () => {
  test('gives the CSS the HTML export writes for the layer', async () => {
    const figma = createAPI()
    const row = figma.createFrame()
    row.layoutMode = 'HORIZONTAL'
    row.itemSpacing = 8
    row.paddingLeft = 16
    row.fills = [...RED]
    row.strokes = [...BLUE]
    row.strokeWeight = 2
    row.cornerRadius = 8
    row.appendChild(figma.createRectangle())

    const css = await row.getCSSAsync()
    const { html } = await renderNodesToHTML(figma.graph, [row.id])

    expect(Object.keys(css).length).toBeGreaterThan(0)
    for (const [property, value] of Object.entries(css)) {
      expect(typeof value).toBe('string')
      expect(html).toContain(`${property}: ${value}`)
    }
    expect(css).toMatchObject({
      display: 'flex',
      gap: '8px',
      'padding-left': '16px',
      'background-color': '#FF0000',
      border: '2px solid #0000FF',
      'border-radius': '8px'
    })
  })

  test('gives a hidden layer the CSS it would have shown', async () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    rect.resize(40, 20)
    rect.fills = [...RED]
    rect.visible = false
    expect(await rect.getCSSAsync()).toMatchObject({
      width: '40px',
      height: '20px',
      'background-color': '#FF0000'
    })
  })

  test('writes a bound colour as the token the canvas draws', async () => {
    const figma = createAPI()
    const collection = figma.variables.createVariableCollection('Tokens')
    const brand = figma.variables.createVariable('brand/primary', collection, 'COLOR')
    brand.setValueForMode(collection.modes[0].modeId, { r: 0, g: 0.5, b: 1, a: 1 })
    const rect = figma.createRectangle()
    rect.fills = [
      figma.variables.setBoundVariableForPaint(
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
        'color',
        brand
      )
    ]
    expect((await rect.getCSSAsync())['background-color']).toBe('var(--color-brand-primary)')
  })

  test('rejects for a removed layer rather than throwing', async () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    rect.remove()
    const css = rect.getCSSAsync()
    expect(css).toBeInstanceOf(Promise)
    await expect(css).rejects.toThrow()
  })

  test('gives pages and the document none', async () => {
    const figma = createAPI()
    expect(await figma.currentPage.getCSSAsync()).toEqual({})
    expect(await figma.root.getCSSAsync()).toEqual({})
  })
})
