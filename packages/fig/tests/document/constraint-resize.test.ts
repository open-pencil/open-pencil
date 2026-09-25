import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

for (const autoLayout of [false, true]) {
  for (const horizontalConstraint of ['MAX', 'STRETCH'] as const) {
    test(`resized occurrence applies ${horizontalConstraint} constraints without repair (auto-layout=${autoLayout})`, () => {
      const guid = (localID: number) => ({ sessionID: 1, localID })
      const changes: NodeChange[] = [
        { guid: guid(0), type: 'DOCUMENT' },
        { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
        {
          guid: guid(2),
          type: 'SYMBOL',
          stackMode: autoLayout ? 'HORIZONTAL' : 'NONE',
          size: { x: 100, y: 80 },
          parentIndex: { guid: guid(1), position: '!' }
        },
        {
          guid: guid(3),
          type: 'RECTANGLE',
          parentIndex: { guid: guid(2), position: '!' },
          size: { x: horizontalConstraint === 'MAX' ? 10 : 80, y: 60 },
          transform: {
            m00: 1,
            m01: 0,
            m02: horizontalConstraint === 'MAX' ? 80 : 10,
            m10: 0,
            m11: 1,
            m12: 10
          },
          horizontalConstraint,
          stackPositioning: 'ABSOLUTE',
          verticalConstraint: 'STRETCH'
        },
        {
          guid: guid(4),
          type: 'INSTANCE',
          parentIndex: { guid: guid(1), position: '"' },
          size: { x: 200, y: 120 },
          symbolData: { symbolID: guid(2) }
        }
      ]
      const { graph, sources } = materializeDocument(changes)
      const instance = sources.get('1:4')
      if (!instance) throw new Error('Missing instance')
      expect(graph.getChildren(instance)[0]).toMatchObject({
        x: horizontalConstraint === 'MAX' ? 180 : 10,
        y: 10,
        width: horizontalConstraint === 'MAX' ? 10 : 180,
        height: 100
      })
      const placed = changes.find((node) => node.type === 'INSTANCE')
      if (!placed) throw new Error('Missing source instance')
      placed.derivedSymbolData = [
        {
          guidPath: { guids: [guid(3)] },
          size: { x: 37, y: 42 },
          transform: { m00: 1, m01: 0, m02: 19, m10: 0, m11: 1, m12: 23 }
        }
      ]
      const saved = materializeDocument(changes, [], { derivedBounds: true })
      const savedId = saved.sources.get('1:4')
      if (!savedId) throw new Error('Missing saved instance')
      expect(saved.graph.getChildren(savedId)[0]).toMatchObject({
        x: 19,
        y: 23,
        width: 37,
        height: 42
      })
    })
  }
}
