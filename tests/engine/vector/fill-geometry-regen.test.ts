import { describe, test, expect } from 'bun:test'

import { regenerateFillGeometry } from '@open-pencil/core'
import type { GeometryPath, VectorNetwork } from '@open-pencil/scene-graph'

function square(): VectorNetwork {
  return {
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
    regions: [{ windingRule: 'EVENODD', loops: [[0, 1, 2, 3]] }]
  }
}

/** Decode a commandsBlob into a readable command list for assertions. */
function decode(blob: Uint8Array): string[] {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const out: string[] = []
  let o = 0
  while (o < blob.length) {
    const cmd = blob[o]
    o += 1
    if (cmd === 0) {
      out.push('Z')
    } else if (cmd === 1 || cmd === 2) {
      out.push(
        `${cmd === 1 ? 'M' : 'L'} ${view.getFloat32(o, true)},${view.getFloat32(o + 4, true)}`
      )
      o += 8
    } else if (cmd === 4) {
      out.push(`C ${view.getFloat32(o + 16, true)},${view.getFloat32(o + 20, true)}`)
      o += 24
    } else {
      throw new Error(`unknown cmd ${cmd}`)
    }
  }
  return out
}

const ENTRY: GeometryPath = {
  windingRule: 'NONZERO',
  commandsBlob: new Uint8Array([9, 9, 9]),
  styleID: 5,
  fills: [
    {
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL'
    }
  ]
}

describe('regenerateFillGeometry', () => {
  test('rebuilds region blobs positionally, preserving styleID/fills', () => {
    const network = square()
    const [g] = regenerateFillGeometry(network, [ENTRY])
    expect(g.styleID).toBe(5)
    expect(g.fills).toEqual(ENTRY.fills)
    expect(g.windingRule).toBe('EVENODD') // taken from the region
    expect(decode(g.commandsBlob)).toEqual(['M 0,0', 'L 10,0', 'L 10,10', 'L 0,10', 'L 0,0', 'Z'])
  })

  test('edited vertices land in the regenerated blob', () => {
    const network = square()
    network.vertices[2] = { x: 14, y: 12 }
    const [g] = regenerateFillGeometry(network, [ENTRY])
    expect(decode(g.commandsBlob)).toContain('L 14,12')
  })

  test('curved segments emit cubics', () => {
    const network = square()
    network.segments[0].tangentStart = { x: 3, y: 4 }
    const [g] = regenerateFillGeometry(network, [ENTRY])
    expect(decode(g.commandsBlob)[1]).toBe('C 10,0')
  })

  test('region/entry count mismatch keeps the old blobs', () => {
    const network = square()
    const out = regenerateFillGeometry(network, [ENTRY, { ...ENTRY, styleID: 6 }])
    expect(out[0].commandsBlob).toBe(ENTRY.commandsBlob)
  })

  test('regionless networks rebuild a single entry from segment chains', () => {
    const network = square()
    network.regions = []
    const [g] = regenerateFillGeometry(network, [ENTRY])
    const cmds = decode(g.commandsBlob)
    expect(cmds[0]).toBe('M 0,0')
    expect(cmds).toHaveLength(5) // M + 4 line segments around the square
  })
})
