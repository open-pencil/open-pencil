import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'

const guid = (localID: number) => ({ sessionID: 1, localID })
const records = () => [
  { guid: guid(0), type: 'DOCUMENT' },
  { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
  { guid: guid(2), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '!' } },
  {
    guid: guid(3),
    type: 'TEXT',
    name: 'Label',
    fontSize: 12,
    opacity: 1,
    textData: { characters: 'Label' },
    parentIndex: { guid: guid(2), position: '!' }
  },
  {
    guid: guid(4),
    type: 'INSTANCE',
    parentIndex: { guid: guid(1), position: '"' },
    symbolData: {
      symbolID: guid(2),
      symbolOverrides: [
        { guidPath: { guids: [guid(3)] }, name: 'Custom', fontSize: 24, opacity: 0.5 }
      ]
    }
  }
]

test('scalar descendant claims survive synchronization and edited export', async () => {
  const { graph, sources } = materializeDocument(records())
  const root = graph.getNode(sources.get('1:4') ?? '')
  if (!root) throw new Error('Missing instance')
  const child = graph.getChildren(root.id)[0]
  expect(child).toMatchObject({ name: 'Custom', fontSize: 24, opacity: 0.5 })
  graph.syncInstances(root.componentId ?? '')
  expect(child).toMatchObject({ name: 'Custom', fontSize: 24, opacity: 0.5 })
  graph.updateNode(root.id, { x: 1 })
  await initCodec()
  const parsed = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs).graph
  const restored = reopened.getAllNodes().find((node) => node.type === 'INSTANCE')
  expect(restored && reopened.getChildren(restored.id)[0]).toMatchObject({
    name: 'Custom',
    fontSize: 24,
    opacity: 0.5
  })
})
