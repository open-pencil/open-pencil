import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { cubicExtrema, cubicPoint } from '@open-pencil/scene-graph/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

const OUTLINE = { windingRule: 'NONZERO' as const, commandsBlob: new Uint8Array([1, 2, 3, 4]) }

/** A move to the origin and a line to (`x`, `y`), so the saved fill has that extent. */
function span(x: number, y: number) {
  const commandsBlob = new Uint8Array(18)
  const view = new DataView(commandsBlob.buffer)
  commandsBlob[0] = 1
  commandsBlob[9] = 2
  view.setFloat32(10, x, true)
  view.setFloat32(14, y, true)
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

function endpoint(path: SceneNode['fillGeometry'][number] | undefined): [number, number] {
  const blob = path?.commandsBlob
  if (!blob) throw new Error('Expected saved fill geometry')
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  return [view.getFloat32(10, true), view.getFloat32(14, true)]
}

/**
 * `M 0,0 C 100,10 100,20 0,30 Z`. The handles sit at x = 100; the curve peaks at x = 75.
 */
function hump() {
  const commandsBlob = new Uint8Array(35)
  const view = new DataView(commandsBlob.buffer)
  commandsBlob[0] = 1
  commandsBlob[9] = 4
  view.setFloat32(10, 100, true)
  view.setFloat32(14, 10, true)
  view.setFloat32(18, 100, true)
  view.setFloat32(22, 20, true)
  view.setFloat32(26, 0, true)
  view.setFloat32(30, 30, true)
  commandsBlob[34] = 0
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

/** The widest x of a cubic saved as `hump`, including where the curve is level. */
function humpWidth(path: SceneNode['fillGeometry'][number] | undefined): number {
  const blob = path?.commandsBlob
  if (!blob) throw new Error('Expected saved fill geometry')
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const p0: Vector = { x: view.getFloat32(1, true), y: view.getFloat32(5, true) }
  const p1: Vector = { x: view.getFloat32(10, true), y: view.getFloat32(14, true) }
  const p2: Vector = { x: view.getFloat32(18, true), y: view.getFloat32(22, true) }
  const p3: Vector = { x: view.getFloat32(26, true), y: view.getFloat32(30, true) }
  let max = Math.max(p0.x, p3.x)
  for (const t of cubicExtrema(p0.x, p1.x, p2.x, p3.x)) {
    max = Math.max(max, cubicPoint(p0, p1, p2, p3, t).x)
  }
  return max
}

/**
 * `M 0 0 L 100 100 Z C 400/3 10 400/3 20 0 30 Z`. Close returns the pen to (0, 0), so the curve
 * peaks at x = 100. Starting the cubic at the line's end instead peaks near x = 118.5.
 */
function closedThenCubic() {
  const commandsBlob = new Uint8Array(45)
  const view = new DataView(commandsBlob.buffer)
  let offset = 0
  const command = (code: number) => {
    commandsBlob[offset] = code
    offset += 1
  }
  const pair = (x: number, y: number) => {
    view.setFloat32(offset, x, true)
    view.setFloat32(offset + 4, y, true)
    offset += 8
  }
  command(1)
  pair(0, 0)
  command(2)
  pair(100, 100)
  command(0)
  command(4)
  pair(400 / 3, 10)
  pair(400 / 3, 20)
  pair(0, 30)
  command(0)
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

test('resize drops a saved stroke outline on a frame instead of leaving it at the old size', () => {
  const graph = new SceneGraph()
  const frame = new FigmaAPI(graph).createFrame()
  frame.resize(38, 20)
  graph.updateNode(frame.id, { strokeGeometry: [OUTLINE] })

  frame.resize(38, 20)
  expect(graph.getNode(frame.id)?.strokeGeometry).toEqual([OUTLINE])

  frame.resize(226, 20)

  expect(graph.getNode(frame.id)?.width).toBe(226)
  expect(graph.getNode(frame.id)?.strokeGeometry).toEqual([])
  expect(graph.getNode(frame.id)?.source.editedFields).toContain('strokeGeometry')
})

test('resizeWithoutConstraints keeps a childless boolean fill through a zero side, so the shape comes back', () => {
  const graph = new SceneGraph()
  const node = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
    width: 100,
    height: 50,
    fillGeometry: [span(100, 50)],
    strokeGeometry: [OUTLINE]
  })
  const boolean = new FigmaAPI(graph).getNodeById(node.id)
  if (!boolean) throw new Error('Boolean proxy was not found')

  boolean.resizeWithoutConstraints(0, 50)

  expect(graph.getNode(node.id)?.width).toBe(0)
  expect(endpoint(graph.getNode(node.id)?.fillGeometry[0])).toEqual([100, 50])
  expect(graph.getNode(node.id)?.strokeGeometry).toEqual([])

  boolean.resizeWithoutConstraints(200, 50)

  expect(graph.getNode(node.id)?.width).toBe(200)
  expect(endpoint(graph.getNode(node.id)?.fillGeometry[0])).toEqual([200, 50])
})

test('resizeWithoutConstraints scales a curved saved fill from the curve, not its handles', () => {
  const graph = new SceneGraph()
  const node = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
    width: 75,
    height: 30,
    fillGeometry: [hump()]
  })
  const boolean = new FigmaAPI(graph).getNodeById(node.id)
  if (!boolean) throw new Error('Boolean proxy was not found')

  boolean.resizeWithoutConstraints(0, 30)
  expect(humpWidth(graph.getNode(node.id)?.fillGeometry[0])).toBeCloseTo(75, 4)

  boolean.resizeWithoutConstraints(150, 30)

  expect(graph.getNode(node.id)?.width).toBe(150)
  expect(humpWidth(graph.getNode(node.id)?.fillGeometry[0])).toBeCloseTo(150, 4)
})

test('resizeWithoutConstraints starts a curve after a close at the contour start', () => {
  const graph = new SceneGraph()
  const fill = closedThenCubic()
  const node = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
    width: 100,
    height: 100,
    fillGeometry: [fill]
  })
  const boolean = new FigmaAPI(graph).getNodeById(node.id)
  if (!boolean) throw new Error('Boolean proxy was not found')
  const control = new DataView(fill.commandsBlob.buffer).getFloat32(20, true)
  expect(control).toBeGreaterThan(100)

  boolean.resizeWithoutConstraints(0, 0)
  expect(endpoint(graph.getNode(node.id)?.fillGeometry[0])).toEqual([100, 100])

  boolean.resizeWithoutConstraints(200, 200)

  expect(graph.getNode(node.id)?.width).toBe(200)
  expect(endpoint(graph.getNode(node.id)?.fillGeometry[0])).toEqual([200, 200])
})
