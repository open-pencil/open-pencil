import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

for (const autoLayout of [false, true]) {
  for (const pinned of [false, true]) {
    test(`nested resized occurrences preserve ${pinned ? 'pinned offsets' : 'text insets'} (auto-layout=${autoLayout})`, () => {
      const guid = (localID: number) => ({ sessionID: 1, localID })
      const changes: NodeChange[] = [
        { guid: guid(0), type: 'DOCUMENT' },
        { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
        {
          guid: guid(2),
          type: 'SYMBOL',
          stackMode: autoLayout ? 'HORIZONTAL' : 'NONE',
          size: { x: pinned ? 442 : 280, y: 40 },
          parentIndex: { guid: guid(1), position: '!' }
        },
        {
          guid: guid(3),
          type: 'TEXT',
          textData: { characters: 'Placeholder' },
          parentIndex: { guid: guid(2), position: '!' },
          size: { x: pinned ? 14 : 248, y: 20 },
          transform: { m00: 1, m01: 0, m02: pinned ? 420 : 16, m10: 0, m11: 1, m12: 10 },
          horizontalConstraint: pinned ? 'MAX' : 'MIN',
          stackPositioning: 'ABSOLUTE'
        },
        {
          guid: guid(4),
          type: 'INSTANCE',
          parentIndex: { guid: guid(1), position: '"' },
          size: { x: 240, y: 40 },
          symbolData: { symbolID: guid(2) }
        },
        {
          guid: guid(5),
          type: 'INSTANCE',
          parentIndex: { guid: guid(1), position: '#' },
          size: { x: 180, y: 40 },
          symbolData: { symbolID: guid(4) }
        }
      ]
      const { graph, sources } = materializeDocument(changes)
      const root = sources.get('1:5')
      if (!root) throw new Error('Missing occurrence')
      const child = graph.getChildren(root)[0]
      expect({ x: child.x, y: child.y, text: child.text }).toEqual({
        x: pinned ? 158 : 16,
        y: 10,
        text: 'Placeholder'
      })
      expect(child.width).toBe(pinned ? 14 : 248)
    })
  }
}
