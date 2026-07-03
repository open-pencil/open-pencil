import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

describe('Figma paint schema field export', () => {
  test('exports pattern, noise, and custom fill metadata', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      fills: [
        {
          type: 'PATTERN',
          color: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
          opacity: 0.75,
          visible: true,
          sourceNodeId: '12:34',
          scale: 1.5,
          spacing: 6,
          patternSpacing: { x: 8, y: 12 },
          patternTileType: 'VERTICAL_HEXAGONAL',
          verticalAlignment: 'CENTER',
          horizontalAlignment: 'END'
        },
        {
          type: 'NOISE',
          color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
          opacity: 1,
          visible: true,
          noiseType: 'MONOTONE',
          density: 0.25,
          noiseSize: { x: 14, y: 18 }
        },
        {
          type: 'CUSTOM',
          color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          opacity: 1,
          visible: true,
          customEffectId: '56:78'
        }
      ]
    })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const fills = changes[0].fillPaints

    expect(fills?.[0]).toMatchObject({
      type: 'PATTERN',
      sourceNodeId: { sessionID: 12, localID: 34 },
      scale: 1.5,
      spacing: 6,
      patternSpacing: { x: 8, y: 12 },
      patternTileType: 'VERTICAL_HEXAGONAL',
      verticalAlignment: 'CENTER',
      horizontalAlignment: 'END'
    })
    expect(fills?.[1]).toMatchObject({
      type: 'NOISE',
      noiseType: 'MONOTONE',
      density: 0.25,
      noiseSize: { x: 14, y: 18 }
    })
    expect(fills?.[2]).toMatchObject({
      type: 'CUSTOM',
      customEffectId: { guid: { sessionID: 56, localID: 78 } }
    })
  })
})
