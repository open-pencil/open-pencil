import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { SceneGraph } from '@lawha/scene-graph'

const HASH = 'b'.repeat(40)

function photo() {
  const graph = new SceneGraph()
  graph.images.set(HASH, new Uint8Array([137, 80, 78, 71]))
  const figma = new FigmaAPI(graph)
  const rect = figma.createRectangle()
  return { figma, graph, rect }
}

describe('image filters through the plugin API', () => {
  test('setting filters stores them as adjustments; zeros are left out', () => {
    const { graph, rect } = photo()
    rect.fills = [
      {
        type: 'IMAGE',
        imageHash: HASH,
        scaleMode: 'FILL',
        filters: {
          exposure: 0.3,
          contrast: 0,
          saturation: -1,
          temperature: 0,
          tint: 0,
          highlights: 0,
          shadows: 0.2
        }
      }
    ]
    expect(graph.getNode(rect.id)?.fills[0].adjustments).toEqual({
      exposure: 0.3,
      saturation: -1,
      shadows: 0.2
    })
  })

  test('reading a paint reports the stored adjustments as its filters', () => {
    const { graph, rect } = photo()
    graph.updateNode(rect.id, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: HASH,
          imageScaleMode: 'FILL',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          adjustments: { contrast: 0.4, tint: -0.1, hue: 0.5 }
        }
      ]
    })
    const [paint] = rect.fills as readonly { filters?: Record<string, number> }[]
    expect(paint.filters).toEqual({
      exposure: 0,
      contrast: 0.4,
      saturation: 0,
      temperature: 0,
      tint: -0.1,
      highlights: 0,
      shadows: 0
    })
  })

  test('an image without filters has no adjustments', () => {
    const { graph, rect } = photo()
    rect.fills = [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'FIT' }]
    expect(graph.getNode(rect.id)?.fills[0]).not.toHaveProperty('adjustments')
  })

  test('filters outside -1…1 are rejected, as Figma does', () => {
    const { rect } = photo()
    expect(() => {
      rect.fills = [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'FILL', filters: { exposure: 2 } }]
    }).toThrow()
  })
})
