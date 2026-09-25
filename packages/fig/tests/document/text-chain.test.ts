import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

test('nested source instances inherit text geometry and paints without clone repair', () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const { graph, sources } = materializeDocument([
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 200, y: 40 }
    },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '!' },
      size: { x: 80, y: 20 },
      textData: { characters: 'Label' },
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      symbolData: { symbolID: guid(2) }
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '#' },
      symbolData: { symbolID: guid(4) }
    }
  ])
  for (const id of ['1:4', '1:5']) {
    const root = sources.get(id)
    if (!root) throw new Error('Missing instance')
    const child = graph.getChildren(root)[0]
    expect(child.width).toBe(80)
    expect(child.text).toBe('Label')
    expect(child.fills[0].color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  }
})
