import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from '../helpers'

describe('fig-import: image fills', () => {
  test('image fill with hash', () => {
    const hash: Record<string, number> = {}
    for (let i = 0; i < 20; i++) hash[String(i)] = i + 10

    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        fillPaints: [
          {
            type: 'IMAGE',
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL',
            image: { hash, name: 'test-image' },
            imageScaleMode: 'FILL',
            transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
          }
        ] as NodeChange['fillPaints']
      })
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills[0].type).toBe('IMAGE')
    expect(n.fills[0].imageHash).toBeDefined()
    expect(n.fills[0].imageHash?.length).toBe(40)
    expect(n.fills[0].imageScaleMode).toBe('FILL')
  })

  test('images stored on graph', () => {
    const images = new Map<string, Uint8Array>()
    images.set('abc123', new Uint8Array([1, 2, 3]))
    const graph = importNodeChanges([doc(), canvas()], [], images)
    expect(graph.images.get('abc123')).toEqual(new Uint8Array([1, 2, 3]))
  })
})
