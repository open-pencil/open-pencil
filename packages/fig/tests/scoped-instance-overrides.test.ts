import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'
import type { InstanceNodeChange } from '#fig/instance-overrides'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('scoped instance property assignments', () => {
  test('interprets source assignments outside the requested page before propagating clones', () => {
    const graph = new SceneGraph()
    const library = graph.getPages()[0].id
    const page = graph.addPage('Dashboard')
    const icon = graph.createNode('COMPONENT', library)
    const glyph = graph.createNode('TEXT', icon.id, { text: 'dashboard' })
    const item = graph.createNode('COMPONENT', library)
    const label = graph.createNode('TEXT', item.id, { name: 'Rótulo', text: 'Área' })
    const nestedIcon = graph.createNode('INSTANCE', item.id, { componentId: icon.id })
    const sidebar = graph.createNode('COMPONENT', library)
    const navigation = graph.createNode('FRAME', sidebar.id)
    const cadastro = graph.createNode('INSTANCE', navigation.id, { componentId: item.id })
    const instance = graph.createNode('INSTANCE', page.id, { componentId: sidebar.id })
    const unrelated = graph.createNode('INSTANCE', library, { componentId: item.id })
    // Reduced protocol payloads from EP-06: label def 207:1 and nested icon def 3:2.
    const changes = new Map<string, InstanceNodeChange>([
      [
        '127:3027',
        {
          componentPropRefs: [
            { defID: { sessionID: 207, localID: 1 }, componentPropNodeField: 'TEXT_DATA' }
          ]
        }
      ],
      [
        '125:10929',
        {
          componentPropRefs: [
            { defID: { sessionID: 3, localID: 2 }, componentPropNodeField: 'TEXT_DATA' }
          ]
        }
      ],
      ['127:3026', { overrideKey: { sessionID: 207, localID: 373 } }],
      [
        '159:14269',
        {
          componentPropAssignments: [
            {
              defID: { sessionID: 207, localID: 1 },
              value: {},
              varValue: { value: { textDataValue: { characters: 'Cadastro' } } }
            }
          ],
          symbolData: {
            symbolOverrides: [
              {
                guidPath: { guids: [{ sessionID: 207, localID: 373 }] },
                componentPropAssignments: [
                  {
                    defID: { sessionID: 3, localID: 2 },
                    value: { textValue: { characters: 'how_to_reg' } }
                  }
                ]
              }
            ]
          }
        }
      ]
    ])
    const ids = new Map([
      ['127:3027', label.id],
      ['125:10929', glyph.id],
      ['127:3026', nestedIcon.id],
      ['159:14269', cadastro.id]
    ])

    const sourceIds = new Map([...ids].map(([sourceId, nodeId]) => [nodeId, sourceId]))
    for (const node of graph.getAllNodes()) {
      if (!sourceIds.has(node.id)) sourceIds.set(node.id, node.id)
    }
    const guid = (nodeId: string) => {
      const sourceId = sourceIds.get(nodeId) ?? nodeId
      const [sessionID, localID] = sourceId.split(':').map(Number)
      return { sessionID, localID }
    }
    const records: NodeChange[] = [...graph.getAllNodes()].map((node) => ({
      guid: guid(node.id),
      type: node.type === 'COMPONENT' ? 'SYMBOL' : node.type,
      parentIndex: node.parentId ? { guid: guid(node.parentId), position: node.id } : undefined,
      textData: node.type === 'TEXT' ? { characters: node.text } : undefined,
      ...changes.get(sourceIds.get(node.id) ?? node.id),
      ...(node.componentId
        ? {
            symbolData: {
              ...changes.get(sourceIds.get(node.id) ?? node.id)?.symbolData,
              symbolID: guid(node.componentId)
            }
          }
        : {})
    }))
    const assembled = materializeDocument(records, [], {
      pageIds: new Set([sourceIds.get(page.id) ?? page.id])
    })
    const instanceId = assembled.sources.get(sourceIds.get(instance.id) ?? instance.id)
    if (!instanceId) throw new Error('Missing materialized instance')
    const descendants = [...assembled.graph.getChildren(instanceId)]
    for (const node of descendants) descendants.push(...assembled.graph.getChildren(node.id))
    const texts = descendants.filter((node) => node.type === 'TEXT').map((node) => node.text)
    expect(texts).toContain('Cadastro')
    expect(texts).toContain('how_to_reg')
    expect(texts).not.toContain('Área')
    expect(texts).not.toContain('dashboard')
    const unrelatedId = assembled.sources.get(sourceIds.get(unrelated.id) ?? unrelated.id)
    expect(unrelatedId ? assembled.graph.getChildren(unrelatedId) : []).toHaveLength(0)
  })
})
