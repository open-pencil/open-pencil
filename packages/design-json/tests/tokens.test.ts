import { describe, expect, test } from 'bun:test'

import { compactDesign } from '#design-json/compact/index'
import { designToJSON } from '#design-json/export'
import { designTokens } from '#design-json/tokens'

import { SceneGraph } from '@open-pencil/scene-graph'

/** A palette with a light and a dark mode, and a brand color that aliases a different one in each. */
function palette() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Palette')
  const light = collection.modes[0]
  light.name = 'Light'
  const dark = graph.createMode(collection.id, 'Dark')
  if (!dark) throw new Error('Expected a dark mode')
  const white = graph.createVariable('base/white', 'COLOR', collection.id, {
    r: 1,
    g: 1,
    b: 1,
    a: 1
  })
  const ink = graph.createVariable('base/ink', 'COLOR', collection.id, { r: 0, g: 0, b: 0, a: 0.5 })
  const surface = graph.createVariable('surface', 'COLOR', collection.id, { aliasId: white.id })
  surface.valuesByMode[dark] = { aliasId: ink.id }
  white.valuesByMode[dark] = { r: 1, g: 1, b: 1, a: 1 }
  ink.valuesByMode[dark] = { r: 0, g: 0, b: 0, a: 0.5 }
  const radius = graph.createVariable('radius/card', 'FLOAT', collection.id, 12)
  radius.valuesByMode[dark] = 12
  return { graph, collection }
}

describe('design tokens', () => {
  test('every variable, by collection, with its value in each mode and colors as hex', () => {
    const { graph, collection } = palette()
    const [tokens] = designTokens(graph)
    expect(tokens).toMatchObject({
      id: collection.id,
      name: 'Palette',
      modes: ['Light', 'Dark'],
      library: false
    })
    expect(tokens.tokens.map((token) => [token.name, token.values])).toEqual([
      ['base/white', { Light: '#FFFFFF', Dark: '#FFFFFF' }],
      ['base/ink', { Light: '#00000080', Dark: '#00000080' }],
      ['surface', { Light: '#FFFFFF', Dark: '#00000080' }],
      ['radius/card', { Light: 12, Dark: 12 }]
    ])
  })

  test('names the token each mode aliases', () => {
    const { graph } = palette()
    const surface = designTokens(graph)[0].tokens.find((token) => token.name === 'surface')
    expect(surface?.aliases).toEqual({ Light: 'base/white', Dark: 'base/ink' })
  })

  test('both JSON views list the tokens, used by the layers or not', () => {
    const { graph } = palette()
    const pageId = graph.getPages()[0].id
    const box = graph.createNode('RECTANGLE', pageId, { width: 10, height: 10 })
    expect(designToJSON(graph, [box.id]).tokens[0].tokens).toHaveLength(4)
    expect(compactDesign(graph, [box.id]).tokens[0].tokens).toHaveLength(4)
    expect(designToJSON(graph, [box.id], { tokens: false }).tokens).toEqual([])
  })

  test('a compact layer names the variables its fields use', () => {
    const { graph } = palette()
    const pageId = graph.getPages()[0].id
    const variableNamed = (name: string) =>
      [...graph.variables.values()].find((variable) => variable.name === name)?.id ?? ''
    const card = graph.createNode('RECTANGLE', pageId, {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    card.boundVariables = {
      'fills/0/color': variableNamed('surface'),
      cornerRadius: variableNamed('radius/card')
    }
    const plain = graph.createNode('RECTANGLE', pageId, { width: 10, height: 10 })
    const [cardLayer, plainLayer] = compactDesign(graph, [card.id, plain.id]).roots
    expect(cardLayer.variables).toEqual({ cornerRadius: 'radius/card' })
    // A bound color names its variable beside its value.
    expect(cardLayer.style?.fills).toEqual([{ value: '#FFFFFF', name: 'surface' }])
    expect(plainLayer.style?.fills).toBeUndefined()
    expect(plainLayer.variables).toBeUndefined()
  })
})
