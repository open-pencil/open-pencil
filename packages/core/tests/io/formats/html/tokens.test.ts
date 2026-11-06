import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'
import { renderNodesToHTML } from '#core/io/formats/html'

describe('tokens in HTML export', () => {
  test('a standalone page defines every token its layers use', async () => {
    const figma = createAPI()
    const collection = figma.variables.createVariableCollection('Tokens')
    const mode = collection.modes[0].modeId
    const bound = (name: string, color: { r: number; g: number; b: number }) => {
      const variable = figma.variables.createVariable(name, collection, 'COLOR')
      variable.setValueForMode(mode, { ...color, a: 1 })
      const rect = figma.createRectangle()
      // A script binds a paint it gave another colour; the page draws the variable's.
      rect.fills = [
        figma.variables.setBoundVariableForPaint(
          { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
          'color',
          variable
        )
      ]
      return rect.id
    }
    const ids = [
      bound('brand/primary', { r: 0, g: 0.5, b: 1 }),
      bound('brand/accent', { r: 1, g: 0, b: 0 })
    ]

    const { html } = await renderNodesToHTML(figma.graph, ids, { html: 'standalone' })

    expect(html).toContain('--color-brand-primary: #0080FF')
    expect(html).toContain('--color-brand-accent: #FF0000')
    expect(html).toContain('background-color: var(--color-brand-primary)')
    expect(html).toContain('background-color: var(--color-brand-accent)')
  })
})
