import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { renderNodesToHTML } from '#core/io/formats/html'

const gradient: Fill = {
  type: 'GRADIENT_LINEAR',
  color: { r: 1, g: 0, b: 0, a: 1 },
  visible: true,
  opacity: 1,
  gradientStops: [
    { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

describe('vector layers in HTML export', () => {
  test('draw their paths as inline SVG with def ids of their own', async () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Card', width: 200, height: 100 })
    for (const x of [0, 100])
      graph.createNode('STAR', frame.id, { name: 'Star', x, width: 80, height: 80, fills: [gradient] })

    const { html } = await renderNodesToHTML(graph, [frame.id])
    expect(html.match(/<svg/g)?.length).toBe(2)
    expect(html.match(/<polygon points=/g)?.length).toBe(2)
    expect(html).toContain('overflow: visible')
    // Each SVG's gradient has its own id, and each SVG fills with its own.
    const ids = [...html.matchAll(/<linearGradient[^>]* id="([^"]+)"/g)].map((match) => match[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) expect(html).toContain(`url(#${id})`)
  })
})
