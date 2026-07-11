import { describe, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork, SceneGraph } from '@open-pencil/scene-graph'
import type { Fill, VectorNetwork } from '@open-pencil/scene-graph'
import { copyGeometryPaths } from '@open-pencil/scene-graph/copy'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

import { expectDefined } from '#tests/helpers/assert'

const RED: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

// 100×100 square network with one region
const NETWORK: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
}

function squareBlob(size: number): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const pts = [
    [1, 0, 0],
    [2, size, 0],
    [2, size, size],
    [2, 0, size]
  ] as const
  let o = 0
  for (const [cmd, x, y] of pts) {
    blob[o] = cmd
    view.setFloat32(o + 1, x, true)
    view.setFloat32(o + 5, y, true)
    o += 9
  }
  blob[o] = 0
  return blob
}

describe('resize regenerates vector fill geometry', () => {
  test('scaling a vector with styled fillGeometry rebuilds its blobs', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const vector = graph.createNode('VECTOR', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      vectorNetwork: cloneVectorNetwork(NETWORK),
      fillGeometry: [
        { windingRule: 'NONZERO', commandsBlob: squareBlob(100), styleID: 1, fills: [RED] }
      ]
    })
    const origBlob = expectDefined(vector.fillGeometry[0]).commandsBlob.slice()

    const editor = {
      graph,
      renderer: undefined,
      requestRepaint: () => undefined
    } as Editor

    const drag: DragResize = {
      type: 'resize',
      handle: 'se',
      startX: 100,
      startY: 100,
      origRect: { x: 0, y: 0, width: 100, height: 100 },
      nodeId: vector.id,
      origVectorNetwork: cloneVectorNetwork(NETWORK),
      origFillGeometry: copyGeometryPaths(vector.fillGeometry),
      origChildren: null
    }

    // drag the se handle to half size
    applyResize(drag, 50, 50, false, editor)

    const resized = expectDefined(graph.getNode(vector.id))
    expect(resized.width).toBeCloseTo(50, 3)
    const network = expectDefined(resized.vectorNetwork)
    expect(Math.max(...network.vertices.map((v) => v.x))).toBeCloseTo(50, 3)

    // fills render from these blobs — they must follow the scale
    const geo = expectDefined(resized.fillGeometry[0])
    expect(Buffer.from(geo.commandsBlob).equals(Buffer.from(origBlob))).toBe(false)
    // scaled blob: second command's x coordinate is the new width
    expect(
      new DataView(geo.commandsBlob.buffer, geo.commandsBlob.byteOffset).getFloat32(10, true)
    ).toBeCloseTo(50, 3)
    // styleID and per-path fill survive the rebuild
    expect(geo.styleID).toBe(1)
    expect(geo.fills?.[0]?.color.r).toBeCloseTo(1, 2)

    // Simulate reactivity-wrapped preview values (proxies are not
    // structured-cloneable) — commit must store plain deep copies or the next
    // delete/undo snapshot throws DataCloneError.
    resized.vectorNetwork = new Proxy(expectDefined(resized.vectorNetwork), {})
    resized.fillGeometry = resized.fillGeometry.map((g) => ({
      ...g,
      fills: g.fills ? (new Proxy(g.fills, {}) as typeof g.fills) : g.fills
    }))
    const committed: Partial<typeof resized>[] = []
    const commitEditor = {
      graph,
      renderer: undefined,
      requestRepaint: () => undefined,
      updateNode: (id: string, changes: object) => {
        committed.push(changes)
        graph.updateNode(id, changes)
      },
      commitResize: () => undefined
    } as Editor
    commitResizePreview(drag, commitEditor)
    for (const changes of committed) {
      expect(() => structuredClone(changes)).not.toThrow()
    }
  })
})
