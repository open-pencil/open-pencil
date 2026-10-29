import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type SceneNode, type Stroke, type StrokeCap } from '@open-pencil/scene-graph'
import { createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

const black = (weight: number, cap?: StrokeCap): Stroke => ({
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  weight,
  align: 'CENTER',
  cap
})

function exported(build: (graph: SceneGraph, pageId: string) => SceneNode): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = build(graph, pageId)
  return expectDefined(renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false }))
}

/** A vector bent once at its middle, open at both ends. */
function bent(cornerRadius: number, cap: StrokeCap): Partial<SceneNode> {
  const straight = { x: 0, y: 0 }
  return {
    width: 200,
    height: 60,
    cornerRadius,
    strokes: [black(3, cap)],
    vectorNetwork: {
      vertices: [
        { x: 0, y: 60 },
        { x: 100, y: 0 },
        { x: 200, y: 60 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: straight, tangentEnd: straight },
        { start: 1, end: 2, tangentStart: straight, tangentEnd: straight }
      ],
      regions: []
    }
  }
}

describe('arrow heads exported to SVG', () => {
  test('a line ends in filled heads, its shaft stopping inside them', () => {
    const plain = exported((graph, page) =>
      graph.createNode('LINE', page, { width: 300, height: 0, strokes: [black(6, 'ROUND')] })
    )
    const headed = exported((graph, page) =>
      graph.createNode('LINE', page, {
        width: 300,
        height: 0,
        strokes: [black(6, 'TRIANGLE_FILLED')]
      })
    )
    const end = (svg: string) => Number(expectDefined(/<line\b[^>]* x2="([\d.]+)"/.exec(svg))[1])
    expect(end(headed)).toBeLessThan(end(plain))
    expect(headed.match(/<path d="M[^"]+Z" fill="#000000"/g)).toHaveLength(2)
  })

  test('a connector’s line arrow is two wings stroked with round ends, a dot a circle', () => {
    const svg = exported((graph, page) =>
      createConnector(
        graph,
        page,
        { start: freeEndpoint(0, 0), end: freeEndpoint(200, 0) },
        { connectorStartCap: 'CIRCLE_FILLED', connectorEndCap: 'ARROW_LINES' }
      )
    )
    expect(svg).toMatch(/<path d="M[^"]+L[^"]+L[^"]+" fill="none"[^>]*stroke-linecap="round"/)
    expect(svg).toContain('<circle ')
  })

  test('an open path keeps its rounded corner and carries its heads', () => {
    const corner = (radius: number) =>
      exported((graph, page) => graph.createNode('VECTOR', page, bent(radius, 'TRIANGLE_FILLED')))
    const shaft = (svg: string) => expectDefined(/<path d="([^"]+)" fill="none"/.exec(svg))[1]
    expect(shaft(corner(16))).toContain('C')
    expect(shaft(corner(0))).not.toContain('C')
    expect(corner(16).match(/<path d="M[^"]+Z" fill="#000000"/g)).toHaveLength(2)
  })

  test('a loose segment beside a filled region stops short of its head too', () => {
    const straight = { x: 0, y: 0 }
    const segment = (start: number, end: number) => ({
      start,
      end,
      tangentStart: straight,
      tangentEnd: straight
    })
    const svg = exported((graph, page) =>
      graph.createNode('VECTOR', page, {
        width: 300,
        height: 40,
        strokes: [black(3, 'TRIANGLE_FILLED')],
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 20, y: 40 },
            { x: 100, y: 20 },
            { x: 300, y: 20 }
          ],
          segments: [segment(0, 1), segment(1, 2), segment(2, 0), segment(3, 4)],
          regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
        }
      })
    )
    // The loose line runs from 100 to 300 and ends inside the heads at either end.
    const [, from, to] = expectDefined(/<path d="M([\d.]+) 20L([\d.]+) 20"/.exec(svg))
    expect(Number(from)).toBeGreaterThan(100)
    expect(Number(to)).toBeLessThan(300)
  })

  test('a loose segment leaving a filled region keeps its join and stops short of its head', () => {
    const straight = { x: 0, y: 0 }
    const segment = (start: number, end: number) => ({
      start,
      end,
      tangentStart: straight,
      tangentEnd: straight
    })
    const svg = exported((graph, page) =>
      graph.createNode('VECTOR', page, {
        width: 300,
        height: 40,
        strokes: [black(3, 'TRIANGLE_FILLED')],
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 40, y: 20 },
            { x: 0, y: 40 },
            { x: 300, y: 20 }
          ],
          segments: [segment(0, 1), segment(1, 2), segment(2, 0), segment(1, 3)],
          regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
        }
      })
    )
    // The line leaves the triangle's tip at 40 untrimmed, and ends inside its one head.
    const [, to] = expectDefined(/<path d="M40 20L([\d.]+) 20"/.exec(svg))
    expect(Number(to)).toBeLessThan(300)
    expect(svg.match(/<path d="M[^"]+Z" fill="#000000"/g)).toHaveLength(1)
  })
})
