import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'

const ROOT_GUID = { sessionID: 1, localID: 0 }

const zero = { x: 0, y: 0 }
const line = (start: number, end: number) => ({ start, end, tangentStart: zero, tangentEnd: zero })
const solid = (r: number) => ({
  type: 'SOLID' as const,
  color: { r, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
})

/** The style IDs in a vector network blob's region words, which keep the winding in bit 0. */
function regionStyleIds(blob: Uint8Array): number[] {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const regions = view.getUint32(8, true)
  let offset = 12 + view.getUint32(0, true) * 12 + view.getUint32(4, true) * 28
  const ids: number[] = []
  for (let index = 0; index < regions; index++) {
    ids.push(view.getUint32(offset, true) >> 1)
    offset += 4
    const loops = view.getUint32(offset, true)
    offset += 4
    for (let loop = 0; loop < loops; loop++) offset += 4 + view.getUint32(offset, true) * 4
  }
  return ids
}

describe('a vector whose regions have their own colors', () => {
  test('names each region’s style in the network, as Figma does, so its edit mode keeps them', () => {
    const graph = new SceneGraph()
    // Two triangles sharing an edge, one red and one plain.
    const node = graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 20,
      height: 10,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 0 }
        ],
        segments: [line(0, 1), line(1, 2), line(2, 0), line(1, 3), line(3, 2)],
        regions: [
          { windingRule: 'NONZERO', loops: [[0, 1, 2]] },
          { windingRule: 'EVENODD', loops: [[3, 4, 1]] }
        ]
      },
      fillGeometry: [
        { windingRule: 'NONZERO', commandsBlob: new Uint8Array([0]), fills: [solid(1)] },
        { windingRule: 'EVENODD', commandsBlob: new Uint8Array([0]) }
      ]
    })
    const blobs: Uint8Array[] = []
    const [change] = sceneNodeToKiwi(node, ROOT_GUID, 0, { value: 100 }, graph, blobs)
    const vectorData = change.vectorData as {
      vectorNetworkBlob: number
      styleOverrideTable: Array<{ styleID: number }>
    }

    const fillStyle = change.fillGeometry?.[0].styleID ?? 0
    expect(fillStyle).toBeGreaterThan(0)
    expect(vectorData.styleOverrideTable.map((entry) => entry.styleID)).toContain(fillStyle)
    // The red region takes the red fill's style; the plain one takes the layer's fill.
    expect(regionStyleIds(blobs[vectorData.vectorNetworkBlob])).toEqual([fillStyle, 0])
  })
})
