import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'

describe('exporting variable bindings of imported layers', () => {
  test('keeps colorVar bindings on imported nodes with stale raw paints', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Tokens')
    const brand = graph.createVariable('brand', 'COLOR', collection.id, {
      r: 0.2,
      g: 0.4,
      b: 0.9,
      a: 1
    })
    const color = { r: 0.2, g: 0.4, b: 0.9, a: 1 }
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImportedBound',
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
    })
    const current = graph.getNode(node.id)
    if (!current) throw new Error('Expected rectangle node')
    // Simulate an imported node whose raw paints predate the binding.
    graph.updateNode(node.id, {
      boundVariables: { 'fills/0/color': brand.id },
      source: {
        ...current.source,
        id: '1:2',
        fig: {
          ...current.source.fig,
          rawNodeFields: {
            ...current.source.fig.rawNodeFields,
            fillPaints: [
              {
                type: 'SOLID',
                color,
                opacity: 1,
                visible: true,
                blendMode: 'NORMAL'
              }
            ]
          }
        }
      }
    })
    const updated = graph.getNode(node.id)
    if (!updated) throw new Error('Expected updated node')

    const [change] = sceneNodeToKiwi(
      updated,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(change.fillPaints?.[0]?.colorVar?.resolvedDataType).toBe('COLOR')
  })

  test('drops a raw colorVar when the imported node is no longer bound', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const color = { r: 0.2, g: 0.4, b: 0.9, a: 1 }
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImportedUnbound',
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
    })
    const current = graph.getNode(node.id)
    if (!current) throw new Error('Expected rectangle node')
    // Simulate an imported node that Figma saved with a binding the user has since removed.
    graph.updateNode(node.id, {
      boundVariables: {},
      source: {
        ...current.source,
        id: '1:2',
        fig: {
          ...current.source.fig,
          rawNodeFields: {
            ...current.source.fig.rawNodeFields,
            fillPaints: [
              {
                type: 'SOLID',
                color,
                opacity: 1,
                visible: true,
                blendMode: 'NORMAL',
                colorVar: {
                  value: { alias: { guid: { sessionID: 0, localID: 12 } } },
                  dataType: 'ALIAS',
                  resolvedDataType: 'COLOR'
                }
              }
            ]
          }
        }
      }
    })
    const updated = graph.getNode(node.id)
    if (!updated) throw new Error('Expected updated node')

    const [change] = sceneNodeToKiwi(
      updated,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(change.fillPaints?.[0]).toMatchObject({ type: 'SOLID', blendMode: 'NORMAL' })
    expect(change.fillPaints?.[0]?.colorVar).toBeUndefined()
  })

  test('drops the OpenPencil bindings entry when an imported node is no longer bound', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImportedPluginBinding',
      width: 40,
      height: 40,
      boundVariables: {},
      pluginData: [
        { pluginId: 'open-pencil', key: 'boundVariables', value: '{"fills/0/color":"0:12"}' },
        { pluginId: 'other-plugin', key: 'boundVariables', value: 'kept' }
      ]
    })

    const [change] = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    const bindingEntries = (change.pluginData ?? []).filter(
      (entry) => entry.key === 'boundVariables'
    )
    expect(bindingEntries).toEqual([
      { pluginID: 'other-plugin', key: 'boundVariables', value: 'kept' }
    ])
  })

  // Figma saved the style bound; one face entry clears it, whether it named the style or the weight.
  test('clears the face and paragraph bindings an imported text style let go of', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Type')
    const spacing = graph.createVariable('spacing', 'FLOAT', collection.id, 4)
    const alias = (variableField: string, resolvedDataType: string) => ({
      variableField,
      variableData: {
        dataType: 'ALIAS',
        resolvedDataType,
        value: { alias: { guid: { sessionID: 1, localID: 9 } } }
      }
    })
    const style = graph.createNode('TEXT', page.id, { name: 'Body', sharedStyleType: 'TEXT' })
    graph.updateNode(style.id, {
      boundVariables: { paragraphIndent: spacing.id },
      source: {
        ...style.source,
        id: '1:5',
        fig: {
          ...style.source.fig,
          rawNodeFields: {
            parameterConsumptionMap: {
              entries: [
                alias('FONT_STYLE', 'FLOAT'),
                alias('PARAGRAPH_SPACING', 'FLOAT'),
                alias('PARAGRAPH_INDENT', 'FLOAT')
              ]
            }
          }
        }
      }
    })
    const updated = graph.getNode(style.id)
    if (!updated) throw new Error('Expected the style node')

    const [change] = sceneNodeToKiwi(
      updated,
      { sessionID: 1, localID: 5 },
      0,
      { value: 2 },
      graph,
      []
    )

    const entries = change.parameterConsumptionMap?.entries ?? []
    expect(
      entries
        .map((entry) => `${entry.variableField} ${entry.variableData?.dataType ?? 'cleared'}`)
        .toSorted()
    ).toEqual(['FONT_STYLE cleared', 'PARAGRAPH_INDENT ALIAS', 'PARAGRAPH_SPACING cleared'])
  })
})
