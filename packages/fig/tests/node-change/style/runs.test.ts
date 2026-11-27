import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'
import { importStyleRuns } from '#fig/node-change/style/runs'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type StyleRun } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

// Field names and shapes from the Kiwi schema (`packages/kiwi/src/fig/schema/fig.kiwi`): a style
// override is a NodeChange, which holds `textCase`, `hyperlink`, `styleIdForText`,
// `styleIdForFill`, and variable consumption entries the way a layer does.
const SIZE_ALIAS = {
  variableField: 'FONT_SIZE',
  variableData: {
    dataType: 'ALIAS',
    resolvedDataType: 'FLOAT',
    value: { alias: { guid: { sessionID: 7, localID: 1 } } }
  }
}

function textChange(overrides: NodeChange[], ids: number[], fields: NodeChange = {}): NodeChange {
  return {
    type: 'TEXT',
    fontSize: 12,
    textData: { characters: 'Hello world', characterStyleIDs: ids, styleOverrideTable: overrides },
    ...fields
  }
}

describe('character ranges in .fig style overrides', () => {
  test('read case, links, styles, and bindings from the overrides', () => {
    const runs = importStyleRuns(
      textChange(
        [
          {
            styleID: 1,
            textCase: 'UPPER',
            hyperlink: { url: 'https://openpencil.dev' },
            styleIdForText: { guid: { sessionID: 1, localID: 20 } },
            parameterConsumptionMap: { entries: [SIZE_ALIAS] }
          },
          {
            styleID: 2,
            hyperlink: { guid: { sessionID: 3, localID: 4 } },
            styleIdForFill: { guid: { ...UNSET_GUID } },
            textCase: 'SMALL_CAPS'
          }
        ],
        [1, 1, 1, 1, 1, 0, 2, 2],
        { styleIdForFill: { guid: { sessionID: 1, localID: 30 } } }
      )
    )
    expect(runs).toEqual([
      {
        start: 0,
        length: 5,
        style: {
          textCase: 'UPPER',
          hyperlink: { type: 'URL', value: 'https://openpencil.dev' },
          textStyleId: '1:20',
          boundVariables: { fontSize: '7:1' }
        }
      },
      {
        start: 6,
        length: 2,
        style: { hyperlink: { type: 'NODE', value: '3:4' }, fillStyleId: null }
      }
    ])
  })

  test('give a link the text keeps for itself to every character', () => {
    const runs = importStyleRuns(
      textChange([{ styleID: 1, fontSize: 20 }], [1, 1], { hyperlink: { url: 'https://a.b' } })
    )
    const link = { type: 'URL' as const, value: 'https://a.b' }
    expect(runs).toEqual([
      { start: 0, length: 2, style: { fontSize: 20, hyperlink: link } },
      { start: 2, length: 9, style: { hyperlink: link } }
    ])
  })

  test('write them back as Figma reads them', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Type')
    const size = graph.createVariable('size', 'FLOAT', collection.id, 20)
    const styleRuns: StyleRun[] = [
      {
        start: 0,
        length: 5,
        style: {
          textCase: 'TITLE',
          hyperlink: { type: 'URL', value: 'https://openpencil.dev' },
          textStyleId: '1:20',
          fillStyleId: null,
          boundVariables: { fontSize: size.id }
        }
      }
    ]
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Hello world',
      fillStyleId: '1:30',
      styleRuns
    })
    const varIdToGuid = new Map([[size.id, { sessionID: 7, localID: 1 }]])
    const [change] = sceneNodeToKiwi(
      node,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      [],
      {
        varIdToGuid
      }
    )
    const [override] = change.textData?.styleOverrideTable ?? []
    expect(override).toMatchObject({
      styleID: 1,
      textCase: 'TITLE',
      hyperlink: { url: 'https://openpencil.dev' },
      styleIdForText: { guid: { sessionID: 1, localID: 20 } },
      styleIdForFill: { guid: UNSET_GUID },
      parameterConsumptionMap: {
        entries: [
          {
            variableField: 'FONT_SIZE',
            variableData: {
              dataType: 'ALIAS',
              value: { alias: { guid: { sessionID: 7, localID: 1 } } }
            }
          }
        ]
      }
    })
    // The binding is written with the value it resolves to, which the range then holds.
    const [run] = importStyleRuns({ ...change, fontSize: 12 })
    expect(run).toMatchObject({ start: 0, length: 5 })
    expect(run.style).toMatchObject({
      ...styleRuns[0].style,
      fontSize: 20,
      boundVariables: { fontSize: '7:1' }
    })
  })

  test('keep a range whose fills were all removed, which Figma draws as nothing', () => {
    // As Figma stores it (copied from Figma desktop): the override holds an empty paint list.
    const runs = importStyleRuns(textChange([{ styleID: 1, fillPaints: [] }], [0, 0, 1, 1]))
    expect(runs).toEqual([{ start: 2, length: 2, style: { fills: [] } }])

    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Hello world',
      styleRuns: runs
    })
    const [change] = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const [override] = change.textData?.styleOverrideTable ?? []
    expect(override).toMatchObject({ styleID: 1, fillPaints: [] })
  })

  test("read and write the colour variable a range's own fill is bound to", () => {
    // As Figma stores it: the range's paint carries the variable, as a layer's paint does.
    const colorVar = {
      dataType: 'ALIAS',
      resolvedDataType: 'COLOR',
      value: { alias: { guid: { sessionID: 7, localID: 2 } } }
    } as const
    const paint = { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, colorVar }
    const runs = importStyleRuns(
      textChange([{ styleID: 1, fillPaints: [paint] } as NodeChange], [0, 0, 1, 1])
    )
    expect(runs[0]?.style.boundVariables).toEqual({ 'fills/0/color': '7:2' })

    const graph = new SceneGraph()
    const collection = graph.createCollection('Brand')
    const red = graph.createVariable('Red', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Hello world',
      styleRuns: [
        {
          ...expectDefined(runs[0], 'run'),
          style: { ...runs[0]?.style, boundVariables: { 'fills/0/color': red.id } }
        }
      ]
    })
    const varIdToGuid = new Map([[red.id, { sessionID: 7, localID: 2 }]])
    const [change] = sceneNodeToKiwi(
      node,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      [],
      {
        varIdToGuid
      }
    )
    const [override] = change.textData?.styleOverrideTable ?? []
    expect(override?.fillPaints?.[0]?.colorVar?.value?.alias).toEqual({
      guid: { sessionID: 7, localID: 2 }
    })
  })
})
