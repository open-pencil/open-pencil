import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

for (const wrapper of [false, true]) {
  test(`target-aspect metadata does not override child constraints (wrapper=${wrapper})`, () => {
    const guid = (localID: number) => ({ sessionID: 1, localID })
    const width = wrapper ? 310 : 24,
      height = wrapper ? 62 : 24
    const changes: NodeChange[] = [
      { guid: guid(0), type: 'DOCUMENT' },
      { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
      {
        guid: guid(2),
        type: 'SYMBOL',
        parentIndex: { guid: guid(1), position: '!' },
        size: { x: width, y: height }
      },
      {
        guid: guid(4),
        type: 'VECTOR',
        parentIndex: { guid: guid(wrapper ? 3 : 2), position: '"' },
        size: { x: wrapper ? 56.392 : 6, y: wrapper ? 61.214 : 6 },
        transform: { m00: 1, m01: 0, m02: wrapper ? 0 : 9, m10: 0, m11: 1, m12: wrapper ? 0 : 3 },
        horizontalConstraint: 'SCALE',
        verticalConstraint: 'SCALE'
      },
      {
        guid: guid(5),
        type: 'INSTANCE',
        parentIndex: { guid: guid(1), position: '"' },
        symbolData: { symbolID: guid(2) },
        size: { x: wrapper ? 100 : 14, y: wrapper ? 20 : 14 },
        targetAspectRatio: { value: { x: wrapper ? 310 : 32, y: wrapper ? 62 : 32 } }
      }
    ]
    if (wrapper)
      changes.push(
        {
          guid: guid(3),
          type: 'FRAME',
          parentIndex: { guid: guid(2), position: '!' },
          size: { x: 310, y: 61.214 }
        },
        {
          guid: guid(6),
          type: 'RECTANGLE',
          parentIndex: { guid: guid(3), position: '!' },
          size: { x: 20, y: 20 },
          transform: { m00: 1, m01: 0, m02: 250, m10: 0, m11: 1, m12: 10 },
          horizontalConstraint: 'MAX'
        }
      )
    const { graph, sources } = materializeDocument(changes)
    const id = sources.get('1:5')
    if (!id) throw new Error('Missing instance')
    const child = graph.getChildren(id)[0]
    if (wrapper) {
      expect(child.width).toBeCloseTo(310)
      expect(child.height).toBeCloseTo(61.214)
      const [inset, vector] = graph.getChildren(child.id)
      expect({ x: inset.x, y: inset.y, width: inset.width, height: inset.height }).toEqual({
        x: 250,
        y: 10,
        width: 20,
        height: 20
      })
      expect(vector.width).toBeCloseTo(56.392)
      expect(vector.height).toBeCloseTo(61.214)
    } else {
      expect({ x: child.x, y: child.y, width: child.width, height: child.height }).toEqual({
        x: (9 * 14) / 24,
        y: (3 * 14) / 24,
        width: (6 * 14) / 24,
        height: (6 * 14) / 24
      })
    }
  })
}
