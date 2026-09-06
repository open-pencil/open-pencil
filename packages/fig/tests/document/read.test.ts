import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'
import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('reads pages independently through one index with cross-page component expansion', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    {
      guid: guid(2),
      type: 'CANVAS',
      name: 'Components',
      parentIndex: { guid: guid(1), position: 'b' }
    },
    {
      guid: guid(3),
      type: 'CANVAS',
      name: 'Design',
      parentIndex: { guid: guid(1), position: 'a' }
    },
    { guid: guid(4), type: 'SYMBOL', parentIndex: { guid: guid(2), position: 'a' } },
    {
      guid: guid(5),
      type: 'TEXT',
      parentIndex: { guid: guid(4), position: 'a' },
      textData: { characters: 'Label' }
    },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: 'a' },
      symbolData: { symbolID: guid(4) }
    }
  ]
  const reader = createDocumentReader(changes)
  expect(reader.pages.map((page) => page.name)).toEqual(['Design', 'Components'])
  const page = reader.readPage('1:3')
  expect(page.children[0].mainComponentId).toBe('1:4')
  expect(page.children[0].children[0].properties.textData?.characters).toBe('Label')
  page.children[0].children[0].properties.opacity = 0.2
  expect(reader.readPage('1:3').children[0].children[0].properties.opacity).toBeUndefined()
  expect(reader.readPage('1:2').children[0].sourceId).toBe('1:4')
  const plan = reader.planComponents([page, reader.readPage('1:2')])
  expect(
    plan.map(({ sourceId, parentSourceId, pageSourceId }) => ({
      sourceId,
      parentSourceId,
      pageSourceId
    }))
  ).toEqual([{ sourceId: '1:4', parentSourceId: '1:2', pageSourceId: '1:2' }])
  expect(reader.planComponents([page]).map((component) => component.sourceId)).toEqual(['1:4'])
  const { graph, sources } = materializeDocument(changes)
  expect(graph.getPages().map((node) => node.name)).toEqual(['Design', 'Components'])
  const componentId = sources.get('1:4')
  const instanceId = sources.get('1:6')
  if (!componentId || !instanceId) throw new Error('Missing assembled nodes')
  expect(graph.getNode(instanceId)?.componentId).toBe(componentId)
  expect(graph.getNode(componentId)?.parentId).toBe(sources.get('1:2'))
  expect([...graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(1)
  expect(graph.getChildren(instanceId)[0].text).toBe('Label')
  expect(() => reader.readPage('1:4')).toThrow('Unknown page')
})
