import { expect, test } from 'bun:test'

import { applyDocumentTextStyleBindings } from '#fig/document/bindings/style'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import type { GUID } from '@open-pencil/scene-graph/primitives'
import { guid } from '@open-pencil/test-support/fig/guid'

const page = guid(1)
const frame = guid(2)
const text = guid(3)
const style = guid(4)
const compact = guid(10)
const roomy = guid(11)
const collection = guid(12)
const size = guid(13)

function floatIn(modeID: GUID, value: number) {
  return { modeID, variableData: { dataType: 'FLOAT', value: { floatValue: value } } }
}

function boundSize() {
  return {
    entries: [
      {
        variableField: 'FONT_SIZE',
        variableData: {
          dataType: 'ALIAS',
          resolvedDataType: 'FLOAT',
          value: { alias: { guid: size } }
        }
      }
    ]
  }
}

function records(): NodeChange[] {
  return [
    {
      guid: collection,
      type: 'VARIABLE_SET',
      variableSetModes: [
        { id: compact, name: 'Compact', sortPosition: 'a' },
        { id: roomy, name: 'Roomy', sortPosition: 'b' }
      ]
    },
    {
      guid: size,
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: collection },
      variableDataValues: { entries: [floatIn(compact, 14), floatIn(roomy, 20)] }
    },
    { guid: page, type: 'CANVAS' },
    {
      guid: style,
      type: 'TEXT',
      name: 'Body',
      styleType: 'TEXT',
      parentIndex: { guid: page, position: '!' },
      fontSize: 14,
      parameterConsumptionMap: boundSize()
    },
    {
      guid: frame,
      type: 'FRAME',
      parentIndex: { guid: page, position: '"' },
      variableModeBySetMap: {
        entries: [{ variableSetID: { guid: collection }, variableModeID: roomy }]
      }
    },
    {
      guid: text,
      type: 'TEXT',
      name: 'Label',
      parentIndex: { guid: frame, position: '!' },
      textData: { characters: 'Hello' },
      fontSize: 14,
      styleIdForText: { guid: style }
    }
  ] as NodeChange[]
}

test('a text takes the size its style binds in the mode it is placed in', () => {
  const { graph } = materializeDocument(records())
  const label = graph.getNode(guidToString(text))

  expect(label?.fontSize).toBe(20)
  expect(label?.textStyleId).toBe(guidToString(style))
  expect(label?.boundVariables).toEqual({})
  expect(graph.getNode(guidToString(style))?.boundVariables.fontSize).toBe(guidToString(size))
})

function savedText(glyphSize: number) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const types = graph.createCollection('Type scale')
  const big = graph.createMode(types.id, 'Roomy') ?? ''
  const bodySize = graph.createVariable('Body size', 'FLOAT', types.id, 14)
  bodySize.valuesByMode[big] = 20
  const body = graph.createNodeWithId('style:body', 'TEXT', page, {
    sharedStyleType: 'TEXT',
    fontSize: 14,
    boundVariables: { fontSize: bodySize.id }
  })
  body.source.id = 'style:body'
  const label = graph.createNode('TEXT', page, {
    text: 'A',
    fontSize: 14,
    textStyleId: 'style:body',
    variableModes: { [types.id]: big },
    derivedLayout: { width: 12, height: 24 },
    derivedTextGlyphs: [{ commandsBlob: new Uint8Array(), x: 0, y: 18, fontSize: glyphSize }]
  })
  applyDocumentTextStyleBindings(graph, [label])
  return label
}

test('a text keeps the layout Figma saved when it was shaped at the size its style resolves to', () => {
  const label = savedText(20)

  expect(label.fontSize).toBe(20)
  expect(label.derivedLayout).toEqual({ width: 12, height: 24 })
  expect(label.derivedTextGlyphs).toHaveLength(1)
})

test('a text whose style binds only its spacing drops the saved layout, which cannot show the mode', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const types = graph.createCollection('Type scale')
  const roomy = graph.createMode(types.id, 'Roomy') ?? ''
  const leading = graph.createVariable('Body leading', 'FLOAT', types.id, 18)
  leading.valuesByMode[roomy] = 26
  graph.createNode('TEXT', page, {
    sharedStyleType: 'TEXT',
    fontSize: 14,
    lineHeight: { value: 18, unit: 'PIXELS' },
    boundVariables: { lineHeight: leading.id },
    source: { ...createDefaultSourceMetadata(), id: 'style:body' }
  })
  const label = graph.createNode('TEXT', page, {
    text: 'A',
    fontSize: 14,
    lineHeight: { value: 18, unit: 'PIXELS' },
    textStyleId: 'style:body',
    variableModes: { [types.id]: roomy },
    derivedLayout: { width: 12, height: 24 },
    derivedTextGlyphs: [{ commandsBlob: new Uint8Array(), x: 0, y: 18, fontSize: 14 }]
  })

  applyDocumentTextStyleBindings(graph, [label])

  expect(label.lineHeight).toEqual({ value: 26, unit: 'PIXELS' })
  expect(label.derivedLayout).toBeNull()
  expect(label.derivedTextGlyphs).toBeNull()
})

test('a text drops a saved layout shaped at another size', () => {
  const label = savedText(14)

  expect(label.fontSize).toBe(20)
  expect(label.derivedLayout).toBeNull()
  expect(label.derivedTextGlyphs).toBeNull()
})
