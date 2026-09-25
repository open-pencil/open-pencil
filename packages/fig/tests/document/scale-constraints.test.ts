import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

for (const image of [false, true]) {
  test(`SCALE constrained occurrence resizes ${image ? 'rectangle' : 'vector'} without changing MIN sibling`, () => {
    const guid = (localID: number) => ({ sessionID: 1, localID })
    const { graph, sources } = materializeDocument([
      { guid: guid(0), type: 'DOCUMENT' },
      { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
      {
        guid: guid(2),
        type: 'SYMBOL',
        parentIndex: { guid: guid(1), position: '!' },
        size: { x: 100, y: 100 }
      },
      {
        guid: guid(3),
        type: image ? 'ROUNDED_RECTANGLE' : 'VECTOR',
        parentIndex: { guid: guid(2), position: '!' },
        size: { x: 20, y: 10 },
        horizontalConstraint: 'SCALE',
        verticalConstraint: 'SCALE'
      },
      {
        guid: guid(4),
        type: 'RECTANGLE',
        parentIndex: { guid: guid(2), position: '"' },
        size: { x: 10, y: 10 }
      },
      {
        guid: guid(5),
        type: 'INSTANCE',
        parentIndex: { guid: guid(1), position: '"' },
        symbolData: { symbolID: guid(2) },
        size: { x: 50, y: 50 }
      }
    ])
    const root = sources.get('1:5')
    if (!root) throw new Error('Missing instance')
    const [scaled, sibling] = graph.getChildren(root)
    expect([scaled.width, scaled.height]).toEqual([10, 5])
    expect([sibling.width, sibling.height]).toEqual([10, 10])
  })
}
