import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { SceneGraph } from '#core/scene-graph'

describe('Figma font variation export', () => {
  test('exports base and styled-run variable font axes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: 'Axis',
      fontVariations: [{ axis: 'wght', value: 650 }],
      styleRuns: [
        {
          start: 0,
          length: 2,
          style: { fontVariations: [{ axis: 'wdth', value: 88 }] }
        }
      ]
    })

    const changes = sceneNodeToKiwi(text, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const nodeChange = changes[0]

    expect(nodeChange.fontVariations).toEqual([{ axisName: 'wght', value: 650 }])
    expect(nodeChange.textData?.styleOverrideTable?.[0]?.fontVariations).toEqual([
      { axisName: 'wdth', value: 88 }
    ])
  })
})
