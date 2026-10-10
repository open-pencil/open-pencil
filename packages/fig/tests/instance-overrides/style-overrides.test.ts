import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const paint = (r: number) => ({
  type: 'SOLID' as const,
  color: { r, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL' as const
})

describe('style overrides from a file', () => {
  test('an instance keeps the style it overrides a layer with after its component syncs', () => {
    const page = { guid: { sessionID: 0, localID: 1 }, position: '!' }
    const graph = materializeDocument([
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', phase: 'CREATED' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        phase: 'CREATED'
      },
      {
        guid: { sessionID: 1, localID: 1 },
        parentIndex: page,
        type: 'RECTANGLE',
        name: 'Style A',
        styleType: 'FILL',
        fillPaints: [paint(0.2)]
      },
      {
        guid: { sessionID: 1, localID: 2 },
        parentIndex: page,
        type: 'RECTANGLE',
        name: 'Style B',
        styleType: 'FILL',
        fillPaints: [paint(0.8)]
      },
      {
        guid: { sessionID: 3, localID: 1 },
        parentIndex: page,
        type: 'SYMBOL',
        name: 'Card',
        size: { x: 100, y: 100 }
      },
      {
        guid: { sessionID: 3, localID: 2 },
        parentIndex: { guid: { sessionID: 3, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Fill',
        size: { x: 100, y: 100 },
        styleIdForFill: { guid: { sessionID: 1, localID: 1 } },
        fillPaints: [paint(0.2)]
      },
      {
        guid: { sessionID: 4, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'INSTANCE',
        name: 'Card',
        size: { x: 100, y: 100 },
        symbolData: {
          symbolID: { sessionID: 3, localID: 1 },
          symbolOverrides: [
            {
              guidPath: { guids: [{ sessionID: 3, localID: 2 }] },
              styleIdForFill: { guid: { sessionID: 1, localID: 2 } },
              fillPaints: [paint(0.8)]
            }
          ]
        }
      }
    ] as NodeChange[]).graph

    const nodes = [...graph.getAllNodes()]
    const styleB = nodes.find((node) => node.name === 'Style B')
    const component = nodes.find((node) => node.type === 'COMPONENT')
    const instance = nodes.find((node) => node.type === 'INSTANCE')
    if (!styleB || !component || !instance) throw new Error('Missing nodes')
    const copy = graph.getChildren(instance.id)[0]
    expect(copy.fillStyleId).toBe(styleB.id)

    graph.syncInstances(component.id)

    expect(graph.getNode(copy.id)?.fillStyleId).toBe(styleB.id)
  })
})
