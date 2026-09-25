import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { applyDocumentLayoutBindings } from '#fig/document/layout-bindings'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

test('saved occurrence dimensions win over unscaled bindings without blocking spacing', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Sizes')
  const variable = graph.createVariable('Size', 'FLOAT', collection.id, 16)
  const node = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 14.253506660461426,
    height: 14.253506660461426,
    itemSpacing: 15,
    boundVariables: { width: variable.id, height: variable.id, itemSpacing: variable.id }
  })
  applyDocumentLayoutBindings(graph, new Set([node.id]), [node])
  expect(node.width).toBe(14.253506660461426)
  expect(node.height).toBe(14.253506660461426)
  expect(node.itemSpacing).toBe(16)
})

test('repeated instances resolve nested bindings using inherited collection modes', () => {
  const changes = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'VARIABLE_SET',
      key: 'collection',
      version: 'v1',
      variableSetModes: [
        { id: guid(10), name: 'Light' },
        { id: guid(11), name: 'Dark' }
      ]
    },
    {
      guid: guid(4),
      type: 'VARIABLE',
      key: 'width',
      version: 'v1',
      variableResolvedType: 'FLOAT',
      variableSetID: { assetRef: { key: 'collection', version: 'v1' } },
      variableDataValues: {
        entries: [10, 11].map((mode) => ({
          modeID: guid(mode),
          variableData: { dataType: 'FLOAT', value: { floatValue: mode * 10 } }
        }))
      }
    },
    { guid: guid(5), type: 'SYMBOL', parentIndex: { guid: guid(2), position: 'a' } },
    {
      guid: guid(6),
      type: 'RECTANGLE',
      size: { x: 50, y: 20 },
      parentIndex: { guid: guid(5), position: 'a' }
    },
    ...[7, 8].map((id, index) => ({
      guid: guid(id),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: String(id) },
      variableModeBySetMap: {
        entries: [
          {
            variableSetID: { assetRef: { key: 'collection', version: 'v1' } },
            variableModeID: guid(10 + index)
          }
        ]
      },
      symbolData: {
        symbolID: guid(5),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(6)] },
            variableConsumptionMap: {
              entries: [
                {
                  variableField: 'WIDTH',
                  variableData: { value: { alias: { assetRef: { key: 'width', version: 'v1' } } } }
                }
              ]
            }
          }
        ]
      }
    }))
  ] as NodeChange[]
  const { graph, sources } = materializeDocument(changes)
  for (const [sourceId, expected] of [
    ['1:7', 100],
    ['1:8', 110]
  ] as const) {
    const id = sources.get(sourceId)
    if (!id) throw new Error('Missing instance')
    const child = graph.getChildren(id)[0]
    expect(child.boundVariables.width).toBe('1:4')
    const mode = graph.getNodeVariableModeId(child.id, '1:3')
    expect(graph.resolveVariable(child.boundVariables.width, mode)).toBe(expected)
    expect(child.width).toBe(expected)
  }
})
