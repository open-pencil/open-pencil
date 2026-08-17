import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { Fill, GeometryPath, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import { copyGeometryPaths } from '@open-pencil/scene-graph/copy'
import { collectResizeDescendants } from '@open-pencil/scene-graph/resize'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

import { getNodeOrThrow } from '#tests/helpers/assert'

const RED: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

const NETWORK: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
}

function movePath(x: number, y: number, fills?: Fill[]): GeometryPath {
  const commandsBlob = new Uint8Array(9)
  const view = new DataView(commandsBlob.buffer)
  commandsBlob[0] = 1
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return { windingRule: 'NONZERO', commandsBlob, fills }
}

function pathPoint(path: GeometryPath | undefined) {
  if (!path) return null
  const view = new DataView(
    path.commandsBlob.buffer,
    path.commandsBlob.byteOffset,
    path.commandsBlob.byteLength
  )
  return [view.getFloat32(1, true), view.getFloat32(5, true)]
}

function vectorGeometry(node: SceneNode) {
  return {
    network: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null,
    fills: copyGeometryPaths(node.fillGeometry),
    strokes: copyGeometryPaths(node.strokeGeometry)
  }
}

function dragFor(node: SceneNode, origChildren: DragResize['origChildren'] = null): DragResize {
  const geometry = vectorGeometry(node)
  return {
    type: 'resize',
    handle: 'se',
    startX: 10,
    startY: 10,
    origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
    nodeId: node.id,
    origVectorNetwork: geometry.network,
    origFillGeometry: geometry.fills,
    origStrokeGeometry: geometry.strokes,
    origDerivedTextGlyphs: null,
    origStrokes: [],
    origTextPathBox: null,
    origChildren
  }
}

function expectGeometry(node: SceneNode, size: number) {
  expect(node.width).toBe(size)
  expect(node.height).toBe(size)
  expect(node.vectorNetwork?.vertices[2]).toMatchObject({ x: size, y: size })
  expect(pathPoint(node.fillGeometry[0])).toEqual([size, size])
  expect(pathPoint(node.strokeGeometry[0])).toEqual([size / 2, size / 2])
  expect(node.fillGeometry[0]?.fills?.[0]?.color.r).toBe(1)
}

describe('vector resize geometry', () => {
  test('keeps fill and stroke paths aligned through resize, undo, and redo', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]
    const vector = editor.graph.createNode('VECTOR', page.id, {
      width: 10,
      height: 10,
      vectorNetwork: cloneVectorNetwork(NETWORK),
      fillGeometry: [movePath(10, 10, [RED])],
      strokeGeometry: [movePath(5, 5)]
    })
    const drag = dragFor(vector)

    applyResize(drag, 20, 20, false, editor)
    commitResizePreview(drag, editor)
    expectGeometry(getNodeOrThrow(editor.graph, vector.id), 20)

    editor.undo.undo()
    expectGeometry(getNodeOrThrow(editor.graph, vector.id), 10)

    editor.undo.redo()
    expectGeometry(getNodeOrThrow(editor.graph, vector.id), 20)
  })

  test('keeps descendant geometry aligned through group resize history', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]
    const group = editor.graph.createNode('GROUP', page.id, { width: 10, height: 10 })
    const vector = editor.graph.createNode('VECTOR', group.id, {
      width: 10,
      height: 10,
      vectorNetwork: cloneVectorNetwork(NETWORK),
      fillGeometry: [movePath(10, 10, [RED])],
      strokeGeometry: [movePath(5, 5)]
    })
    const descendants = collectResizeDescendants(editor.graph, group.id)
    expect(descendants).not.toBeNull()
    const drag = dragFor(group, descendants)

    applyResize(drag, 20, 20, false, editor)
    commitResizePreview(drag, editor)
    expectGeometry(getNodeOrThrow(editor.graph, vector.id), 20)

    editor.undo.undo()
    expectGeometry(getNodeOrThrow(editor.graph, vector.id), 10)

    editor.undo.redo()
    expectGeometry(getNodeOrThrow(editor.graph, vector.id), 20)
  })
})
