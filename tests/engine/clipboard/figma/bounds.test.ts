import { describe, expect, it } from 'bun:test'

import { figmaNodesBounds } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'

describe('figmaNodesBounds', () => {
  it('computes bounds of top-level visual nodes', () => {
    const nodes = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'A',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 500, m10: 0, m11: 1, m12: 300 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'RECTANGLE',
        name: 'B',
        size: { x: 50, y: 50 },
        transform: { m00: 1, m01: 0, m02: 800, m10: 0, m11: 1, m12: 400 }
      }
    ] as NodeChange[]

    const bounds = figmaNodesBounds(nodes)
    expect(bounds).toEqual({ x: 500, y: 300, w: 350, h: 150 })
  })

  it('ignores variables and non-visual types', () => {
    const nodes = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 2 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'VARIABLE_SET',
        name: 'Vars'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'FRAME',
        name: 'Card',
        size: { x: 300, y: 200 },
        transform: { m00: 1, m01: 0, m02: 18000, m10: 0, m11: 1, m12: 45000 }
      }
    ] as NodeChange[]

    const bounds = figmaNodesBounds(nodes)
    expect(bounds).toEqual({ x: 18000, y: 45000, w: 300, h: 200 })
  })

  it('returns null for empty or all-non-visual nodes', () => {
    expect(figmaNodesBounds([])).toBeNull()
    const nodes = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      }
    ] as NodeChange[]
    expect(figmaNodesBounds(nodes)).toBeNull()
  })
})
