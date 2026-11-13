import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode, type VectorNetwork } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const INSIDE = {
  type: 'SOLID' as const,
  color: { r: 0, g: 0, b: 1, a: 1 },
  opacity: 1,
  visible: true,
  weight: 4,
  align: 'INSIDE' as const
}

/** A closed square whose far corner sits at (`side`, `side`). */
function squareNetwork(side: number): VectorNetwork {
  const corner = { x: 0, y: 0 }
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: side, y: 0 },
      { x: side, y: side },
      { x: 0, y: side }
    ],
    segments: [0, 1, 2, 3].map((start) => ({
      start,
      end: (start + 1) % 4,
      tangentStart: corner,
      tangentEnd: corner
    })),
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  }
}

/** A path that moves to (`x`, `y`), enough for saved geometry to scale. */
function moveTo(x: number, y: number) {
  const commandsBlob = new Uint8Array(9)
  commandsBlob[0] = 1
  const view = new DataView(commandsBlob.buffer)
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

function point(path: SceneNode['fillGeometry'][number] | undefined): [number, number] {
  const blob = path?.commandsBlob
  if (!blob) throw new Error('Expected saved geometry')
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  return [view.getFloat32(1, true), view.getFloat32(5, true)]
}

describe('a vector layout resizes', () => {
  test('scales its network with the box, so the stroke can follow the new outline', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      width: 200,
      height: 200,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const vector = graph.createNode('VECTOR', frame.id, {
      width: 100,
      height: 100,
      layoutGrow: 1,
      layoutAlignSelf: 'STRETCH',
      vectorNetwork: squareNetwork(100),
      fillGeometry: [moveTo(100, 100)],
      strokeGeometry: [moveTo(100, 100)],
      strokes: [INSIDE],
      strokeAlign: 'INSIDE',
      strokeWeight: 4
    })

    computeAllLayouts(graph)

    expect([vector.width, vector.height]).toEqual([200, 200])
    expect(point(vector.fillGeometry[0])).toEqual([200, 200])
    expect(vector.strokeGeometry).toEqual([])
    expect(vector.vectorNetwork?.vertices[2]).toEqual({ x: 200, y: 200 })
    expect(vector.source.editedFields).toContain('vectorNetwork')
  })

  test('keeps a network this layout already replaced, such as a connector route', () => {
    const graph = new SceneGraph()
    const vector = graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 100,
      height: 100,
      vectorNetwork: squareNetwork(100),
      fillGeometry: [moveTo(100, 100)],
      strokeGeometry: [moveTo(100, 100)]
    })
    const routed = squareNetwork(200)
    routed.vertices[2] = { x: 180, y: 40 }

    graph.withLayoutMutations(() => {
      graph.updateNode(vector.id, { width: 200, height: 200, vectorNetwork: routed })
    })

    const node = expectDefined(graph.getNode(vector.id))
    expect([node.width, node.height]).toEqual([200, 200])
    expect(point(node.fillGeometry[0])).toEqual([200, 200])
    expect(node.strokeGeometry).toEqual([])
    expect(node.vectorNetwork?.vertices[2]).toEqual({ x: 180, y: 40 })
  })

  test('keeps its path when layout flattens a side, so resizing it back restores the shape', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const row = graph.createNode('FRAME', page, {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    graph.createNode('RECTANGLE', row.id, { width: 100, height: 100 })
    const vector = graph.createNode('VECTOR', row.id, {
      width: 100,
      height: 100,
      layoutGrow: 1,
      vectorNetwork: squareNetwork(100),
      fillGeometry: [moveTo(100, 100)]
    })

    computeAllLayouts(graph)
    expect(vector.width).toBe(0)

    graph.reparentNode(vector.id, page)
    const restored = expectDefined(new FigmaAPI(graph).getNodeById(vector.id))
    restored.resize(100, 100)

    const node = expectDefined(graph.getNode(vector.id))
    expect([node.width, node.height]).toEqual([100, 100])
    expect(node.vectorNetwork?.vertices[2]).toEqual({ x: 100, y: 100 })
    expect(point(node.fillGeometry[0])).toEqual([100, 100])
  })
})
