import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { placeIcon } from '#core/icons/render'
import { buildIconData } from '#core/icons/svg'
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

  test('keep def ids apart for layer ids that differ only in punctuation', async () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Card', width: 200, height: 100 })
    for (const [id, x] of [['a:b', 0], ['a-b', 100]] as const)
      graph.createNodeWithId(id, 'STAR', frame.id, { name: 'Star', x, width: 80, height: 80, fills: [gradient] })

    const { html } = await renderNodesToHTML(graph, [frame.id])
    const ids = [...html.matchAll(/<linearGradient[^>]* id="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(2)
  })

  test('give a straight line a viewport to draw its stroke in', async () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Card', width: 200, height: 100 })
    graph.createNode('VECTOR', frame.id, {
      name: 'Rule',
      width: 120,
      height: 0,
      vectorNetwork: {
        vertices: [{ x: 0, y: 0 }, { x: 120, y: 0 }],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      },
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, weight: 2, align: 'CENTER' }]
    })
    const { html } = await renderNodesToHTML(graph, [frame.id])
    expect(html).toMatch(/<svg width="120" height="1" viewBox="0 0 120 1"/)
  })
})

describe('icons in HTML export', () => {
  test('draw as one SVG named by the icon, recolored through CSS color', async () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Card', width: 100, height: 100 })
    const body = '<path fill="currentColor" d="M0 0h12v12H0z"/><path fill="#ff0000" d="M12 12h12v12H12z"/>'
    const icon = buildIconData({ body }, 'test', 'icon', 24, 24, 24)
    placeIcon(graph, frame.id, icon, { size: 24, color: parseColor('#4f46e5') })

    const { html } = await renderNodesToHTML(graph, [frame.id])
    expect(html.match(/<svg/g)?.length).toBe(1)
    expect(html).toContain('data-icon="test:icon"')
    expect(html).toMatch(/<svg[^>]*style="[^"]*color: #4F46E5/)
    // The tinted path follows the color; the red one keeps its own.
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('fill="#FF0000"')
  })

  test('an icon whose paths were edited draws its paths, no longer named as the icon', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const icon = buildIconData({ body: '<path fill="currentColor" d="M0 0h24v24H0z"/>' }, 'test', 'icon', 24, 24, 24)
    const frame = placeIcon(graph, page, icon, { size: 24, color: parseColor('#000000') })
    graph.createNode('RECTANGLE', frame.id, {
      width: 4,
      height: 4,
      fills: [{ type: 'SOLID', color: parseColor('#16a34a'), opacity: 1, visible: true }]
    })

    const { html } = await renderNodesToHTML(graph, [frame.id])
    expect(html).not.toContain('data-icon')
    expect(html.match(/<svg/g)?.length).toBe(1)
    // The added layer is drawn with the icon's own path.
    expect(html).toContain('fill="#16A34A"')
    expect(html).toContain('fill="currentColor"')
  })
})
