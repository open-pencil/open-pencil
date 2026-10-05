import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { resolveFillColor } from '#core/canvas/renderer/colors'

const LIGHT = { r: 1, g: 1, b: 1, a: 1 }
const DARK = { r: 0.04, g: 0.04, b: 0.05, a: 1 }
const BOUND_FILL: Fill = {
  type: 'SOLID',
  color: LIGHT,
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

describe('node-scoped variable modes', () => {
  test('renderer resolves paint bindings through the nearest mode scope', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    graph.addVariable({
      id: 'background',
      name: 'Background',
      type: 'COLOR',
      collectionId: 'theme',
      valuesByMode: { light: LIGHT, dark: DARK },
      description: '',
      hiddenFromPublishing: false
    })

    const page = graph.addPage('Page')
    const darkFrame = graph.createNode('FRAME', page.id, {
      variableModes: { theme: 'dark' }
    })
    const child = graph.createNode('RECTANGLE', darkFrame.id, {
      fills: [BOUND_FILL],
      boundVariables: { 'fills/0/color': 'background' }
    })

    expect(resolveFillColor(child.fills[0], 0, child, graph, 'srgb')).toEqual(DARK)
  })
})
