import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes: styling', () => {
  it('preserves fills and strokes', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
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
        type: 'RECTANGLE',
        name: 'Colored',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        fillPaints: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
        ],
        strokePaints: [
          { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }
        ],
        strokeWeight: 2
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const node = getNodeOrThrow(graph, created[0])
    expect(node.fills).toHaveLength(1)
    expect(node.fills[0].color.r).toBe(1)
    expect(node.strokes).toHaveLength(1)
    expect(node.strokes[0].color.b).toBe(1)
    expect(node.strokes[0].weight).toBe(2)
  })
})
