import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

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
