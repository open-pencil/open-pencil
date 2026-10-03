import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

test('nested component swap changes descendants through source instance chains', () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const { graph, sources } = materializeDocument([
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    { guid: guid(2), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '!' },
      textData: { characters: 'Source' }
    },
    { guid: guid(4), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '"' } },
    {
      guid: guid(5),
      type: 'TEXT',
      parentIndex: { guid: guid(4), position: '!' },
      textData: { characters: 'Target' }
    },
    { guid: guid(6), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '#' } },
    {
      guid: guid(7),
      type: 'INSTANCE',
      parentIndex: { guid: guid(6), position: '!' },
      symbolData: { symbolID: guid(4) }
    },
    {
      guid: guid(8),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '$' },
      symbolData: {
        symbolID: guid(6),
        symbolOverrides: [{ guidPath: { guids: [guid(7)] }, overriddenSymbolID: guid(2) }]
      }
    },
    {
      guid: guid(9),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '%' },
      symbolData: { symbolID: guid(8) }
    }
  ])
  for (const id of ['1:8', '1:9']) {
    const root = sources.get(id)
    if (!root) throw new Error('Missing source instance')
    const nested = graph.getChildren(root)[0]
    expect(nested.componentId).toBe(sources.get('1:2'))
    expect(graph.getChildren(nested.id).map((node) => node.text)).toEqual(['Source'])
    expect(graph.getChildren(nested.id)[0].componentId).toBe(
      graph.getChildren(sources.get('1:2') ?? '')[0].id
    )
  }
})
