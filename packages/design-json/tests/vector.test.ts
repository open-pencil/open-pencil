import { describe, expect, test } from 'bun:test'

import { compactDesign } from '#design-json/compact/index'
import { vectorSVG } from '#design-json/compact/svg'

import { SceneGraph, type Fill, type VectorNetwork } from '@open-pencil/scene-graph'

const RED: Fill = { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
const ORIGIN = { x: 0, y: 0 }

/** A triangle filled even-odd, with its three corners joined by straight segments. */
const TRIANGLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 8.66666 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: ORIGIN, tangentEnd: ORIGIN },
    { start: 1, end: 2, tangentStart: ORIGIN, tangentEnd: ORIGIN },
    { start: 2, end: 0, tangentStart: ORIGIN, tangentEnd: ORIGIN }
  ],
  regions: [{ windingRule: 'EVENODD', loops: [[0, 1, 2]] }]
}

function page() {
  const graph = new SceneGraph()
  return { graph, pageId: graph.getPages()[0].id }
}

describe('compact vectors', () => {
  test('a vector carries the paths of its network, in its own coordinates', () => {
    const { graph, pageId } = page()
    const arrow = graph.createNode('VECTOR', pageId, {
      x: 40,
      y: 20,
      width: 10,
      height: 8.66666,
      vectorNetwork: TRIANGLE,
      fills: [RED]
    })
    const [node] = compactDesign(graph, [arrow.id]).roots
    expect(node.vector).toEqual({
      width: 10,
      height: 8.66666,
      paths: [{ d: expect.stringMatching(/^M0 0L10 0L5 8\.667/), fillRule: 'evenodd' }]
    })
  })

  test('a star and a line, which keep no path, carry their outline', () => {
    const { graph, pageId } = page()
    const star = graph.createNode('STAR', pageId, { width: 20, height: 20 })
    const line = graph.createNode('LINE', pageId, { width: 30, height: 0 })
    const [starNode, lineNode] = compactDesign(graph, [star.id, line.id]).roots
    expect(starNode.vector?.paths[0]).toMatchObject({ d: expect.stringMatching(/^M10 0/) })
    expect(lineNode.vector?.paths).toEqual([{ d: 'M0 0L30 0', fillRule: 'none' }])
  })

  test('vectorSVG writes a vector as a standalone SVG file, painted as the layer', () => {
    const { graph, pageId } = page()
    const arrow = graph.createNode('VECTOR', pageId, {
      width: 10,
      height: 8.66666,
      vectorNetwork: TRIANGLE,
      fills: [RED]
    })
    const [node] = compactDesign(graph, [arrow.id]).roots
    const svg = vectorSVG(node)
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="10"')
    expect(svg).toContain('fill="#FF0000" fill-rule="evenodd"')
    expect(svg).toContain('d="M0 0L10 0L5 8.667')
  })

  test('vectorSVG gives null for a layer that is not a vector', () => {
    const { graph, pageId } = page()
    const box = graph.createNode('RECTANGLE', pageId, { width: 10, height: 10 })
    const [node] = compactDesign(graph, [box.id]).roots
    expect(node.vector).toBeUndefined()
    expect(vectorSVG(node)).toBeNull()
  })
})
