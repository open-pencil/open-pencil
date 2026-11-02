import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { arrangeNodes } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

function overlaps(nodes: Rect[]): boolean {
  return nodes.some((a, i) =>
    nodes
      .slice(i + 1)
      .some(
        (b) =>
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
      )
  )
}

describe('arrange', () => {
  test('spreads every top-level layer on the page apart by default', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const layers = [figma.createRectangle(), figma.createRectangle(), figma.createRectangle()]

    expect(await arrangeNodes.execute(figma, {})).toMatchObject({ mode: 'spread', layers: 3 })
    expect(overlaps(layers)).toBe(false)
  })

  test('flows layers along the connectors joining them', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const [first, second] = [figma.createRectangle(), figma.createRectangle()]
    const connector = figma.createConnector()
    connector.connectorStart = { endpointNodeId: first.id, magnet: 'AUTO' }
    connector.connectorEnd = { endpointNodeId: second.id, magnet: 'AUTO' }

    expect(
      await arrangeNodes.execute(figma, {
        ids: [first.id, second.id],
        mode: 'flow',
        direction: 'LR'
      })
    ).toEqual({ mode: 'flow', layers: 2, groups: 0, connectors: 1 })
    expect(first.x + first.width).toBeLessThan(second.x)
  })

  test('keeps the grid it always had', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const layers = Array.from({ length: 4 }, () => figma.createRectangle())
    await arrangeNodes.execute(figma, { mode: 'grid', gap: 10 })
    expect(layers.map((layer) => [layer.x, layer.y])).toEqual([
      [0, 0],
      [110, 0],
      [0, 110],
      [110, 110]
    ])
  })

  test('reports layers it cannot arrange together', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    const inside = figma.createRectangle()
    frame.appendChild(inside)
    expect(
      await arrangeNodes.execute(figma, {
        ids: [figma.createRectangle().id, inside.id],
        mode: 'flow'
      })
    ).toEqual({
      error: 'Layers to arrange must share a parent, apart from those in chosen sections'
    })
  })
})
