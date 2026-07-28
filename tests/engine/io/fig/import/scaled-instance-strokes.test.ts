import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { canvas, doc, node } from './legacy/helpers'

function pointGeometry(x: number, y: number): Uint8Array {
  const bytes = new Uint8Array(9)
  bytes[0] = 1
  const view = new DataView(bytes.buffer)
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return bytes
}

describe('fig import scaled instance strokes', () => {
  test('preserves vector stroke weight while scaling icon geometry', () => {
    const componentGuid = { sessionID: 1, localID: 10 }
    const vectorGuid = { sessionID: 1, localID: 11 }
    const instanceGuid = { sessionID: 1, localID: 20 }

    const graph = importNodeChanges(
      [
        doc(),
        canvas(),
        node('SYMBOL', 10, 1, {
          guid: componentGuid,
          size: { x: 24, y: 24 }
        } as Partial<NodeChange>),
        node('VECTOR', 11, 1, {
          guid: vectorGuid,
          parentIndex: { guid: componentGuid, position: '!' },
          size: { x: 12, y: 12 },
          horizontalConstraint: 'SCALE',
          verticalConstraint: 'SCALE',
          strokeWeight: 2,
          strokePaints: [
            {
              type: 'SOLID',
              color: { r: 0.2, g: 0.25, b: 0.33, a: 1 },
              opacity: 1,
              visible: true,
              blendMode: 'NORMAL'
            }
          ]
        } as Partial<NodeChange>),
        node('INSTANCE', 20, 1, {
          guid: instanceGuid,
          size: { x: 16, y: 16 },
          symbolData: { symbolID: componentGuid }
        } as Partial<NodeChange>)
      ],
      [],
      undefined,
      { populate: 'all' }
    )

    const instance = Array.from(graph.getAllNodes()).find(
      (sceneNode) => sceneNode.name === 'INSTANCE_20'
    )
    const vector = instance?.childIds.map((id) => graph.getNode(id)).find(Boolean)

    expect(vector?.strokes[0]?.weight).toBe(2)
    expect(vector?.strokes[0]?.color).toEqual({ r: 0.2, g: 0.25, b: 0.33, a: 1 })
  })

  test('does not scale explicit derived vector geometry twice', () => {
    const componentGuid = { sessionID: 1, localID: 21 }
    const vectorGuid = { sessionID: 1, localID: 22 }
    const graph = importNodeChanges(
      [
        doc(),
        canvas(),
        node('SYMBOL', 21, 1, {
          guid: componentGuid,
          size: { x: 24, y: 24 }
        } as Partial<NodeChange>),
        node('VECTOR', 22, 1, {
          guid: vectorGuid,
          parentIndex: { guid: componentGuid, position: '!' },
          size: { x: 12, y: 12 },
          horizontalConstraint: 'SCALE',
          verticalConstraint: 'SCALE',
          fillGeometry: [{ commandsBlob: 0, windingRule: 'NONZERO' }]
        } as Partial<NodeChange>),
        node('INSTANCE', 23, 1, {
          size: { x: 16, y: 16 },
          symbolData: { symbolID: componentGuid },
          derivedSymbolData: [
            {
              guidPath: { guids: [vectorGuid] },
              size: { x: 8, y: 8 },
              fillGeometry: [{ commandsBlob: 1, windingRule: 'NONZERO' }]
            }
          ]
        } as Partial<NodeChange>)
      ],
      [pointGeometry(12, 12), pointGeometry(6, 6)],
      undefined,
      { populate: 'all' }
    )

    const instance = Array.from(graph.getAllNodes()).find(
      (sceneNode) => sceneNode.name === 'INSTANCE_23'
    )
    const vector = instance?.childIds.map((id) => graph.getNode(id)).find(Boolean)
    const geometry = vector?.fillGeometry[0]?.commandsBlob
    expect(geometry).toBeDefined()
    const view = new DataView(
      geometry?.buffer ?? new ArrayBuffer(0),
      geometry?.byteOffset ?? 0,
      geometry?.byteLength ?? 0
    )
    expect(view.getFloat32(1, true)).toBe(6)
    expect(view.getFloat32(5, true)).toBe(6)
  })

  test('applies explicit instance stroke scale to scaled vectors', () => {
    const componentGuid = { sessionID: 1, localID: 30 }
    const vectorGuid = { sessionID: 1, localID: 31 }

    const graph = importNodeChanges(
      [
        doc(),
        canvas(),
        node('SYMBOL', 30, 1, {
          guid: componentGuid,
          size: { x: 24, y: 24 }
        } as Partial<NodeChange>),
        node('VECTOR', 31, 1, {
          guid: vectorGuid,
          parentIndex: { guid: componentGuid, position: '!' },
          size: { x: 4, y: 8 },
          horizontalConstraint: 'SCALE',
          verticalConstraint: 'SCALE',
          strokeWeight: 2,
          strokePaints: [
            {
              type: 'SOLID',
              color: { r: 0.2, g: 0.25, b: 0.33, a: 1 },
              opacity: 1,
              visible: true,
              blendMode: 'NORMAL'
            }
          ]
        } as Partial<NodeChange>),
        node('INSTANCE', 40, 1, {
          size: { x: 16, y: 16 },
          strokeWeight: 2 / 3,
          symbolData: { symbolID: componentGuid }
        } as Partial<NodeChange>)
      ],
      [],
      undefined,
      { populate: 'all' }
    )

    const instance = Array.from(graph.getAllNodes()).find(
      (sceneNode) => sceneNode.name === 'INSTANCE_40'
    )
    const vector = instance?.childIds.map((id) => graph.getNode(id)).find(Boolean)

    expect(vector?.strokes[0]?.weight).toBeCloseTo(4 / 3, 6)
  })
})
