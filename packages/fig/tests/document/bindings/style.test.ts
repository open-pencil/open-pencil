import { expect, test } from 'bun:test'

import { applyDocumentTextStyleBindings } from '#fig/document/bindings/style'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import type { GUID } from '@open-pencil/scene-graph/primitives'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'
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

function savedText(glyphSize: number, componentScale = 1) {
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
  const holder = graph.createNode(componentScale === 1 ? 'FRAME' : 'INSTANCE', page, {})
  const label = graph.createNode('TEXT', holder.id, {
    text: 'A',
    fontSize: 14,
    textStyleId: 'style:body',
    variableModes: { [types.id]: big },
    componentScale,
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

function typeScale() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const types = graph.createCollection('Type scale')
  const roomy = graph.createMode(types.id, 'Roomy') ?? ''
  const bodySize = graph.createVariable('Body size', 'FLOAT', types.id, 14)
  bodySize.valuesByMode[roomy] = 20
  const leading = graph.createVariable('Body leading', 'FLOAT', types.id, 18)
  leading.valuesByMode[roomy] = 26
  graph.createNode('TEXT', page, {
    sharedStyleType: 'TEXT',
    fontSize: 14,
    lineHeight: { value: 18, unit: 'PIXELS' },
    boundVariables: { fontSize: bodySize.id, lineHeight: leading.id },
    source: { ...createDefaultSourceMetadata(), id: 'style:body' }
  })
  return { graph, page, modes: { [types.id]: roomy } }
}

function savedGlyphs(fontSize: number) {
  return {
    derivedLayout: { width: 12, height: 26 },
    derivedTextGlyphs: [{ commandsBlob: new Uint8Array(), x: 0, y: 20, fontSize }]
  }
}

test('a text keeps the layout Figma saved in its mode when its style binds size and leading', () => {
  const { graph, page, modes } = typeScale()
  const label = graph.createNode('TEXT', page, {
    text: 'A',
    fontSize: 14,
    lineHeight: { value: 18, unit: 'PIXELS' },
    textStyleId: 'style:body',
    variableModes: modes,
    ...savedGlyphs(20)
  })

  applyDocumentTextStyleBindings(graph, [label])

  expect(label).toMatchObject({ fontSize: 20, lineHeight: { value: 26, unit: 'PIXELS' } })
  expect(label.derivedLayout).toEqual({ width: 12, height: 26 })
})

test('characters on a style keep the layout Figma saved in their mode', () => {
  const { graph, page, modes } = typeScale()
  const label = graph.createNode('TEXT', page, {
    text: 'AB',
    fontSize: 10,
    styleRuns: [
      {
        start: 0,
        length: 1,
        style: {
          textStyleId: 'style:body',
          fontSize: 14,
          lineHeight: { value: 18, unit: 'PIXELS' }
        }
      }
    ],
    variableModes: modes,
    ...savedGlyphs(20)
  })

  applyDocumentTextStyleBindings(graph, [label])

  expect(label.styleRuns[0].style.fontSize).toBe(20)
  expect(label.derivedLayout).toEqual({ width: 12, height: 26 })
})

test('a text drops a saved layout when its size matches but its style bound leading changes', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const types = graph.createCollection('Type scale')
  const roomy = graph.createMode(types.id, 'Roomy') ?? ''
  const bodySize = graph.createVariable('Body size', 'FLOAT', types.id, 20)
  const leading = graph.createVariable('Body leading', 'FLOAT', types.id, 18)
  leading.valuesByMode[roomy] = 26
  graph.createNode('TEXT', page, {
    sharedStyleType: 'TEXT',
    fontSize: 20,
    lineHeight: { value: 18, unit: 'PIXELS' },
    boundVariables: { fontSize: bodySize.id, lineHeight: leading.id },
    source: { ...createDefaultSourceMetadata(), id: 'style:body' }
  })
  const label = graph.createNode('TEXT', page, {
    text: 'A',
    fontSize: 20,
    lineHeight: { value: 18, unit: 'PIXELS' },
    textStyleId: 'style:body',
    variableModes: { [types.id]: roomy },
    derivedLayout: { width: 12, height: 18 },
    derivedTextGlyphs: [{ commandsBlob: new Uint8Array(), x: 0, y: 14, fontSize: 20 }]
  })

  applyDocumentTextStyleBindings(graph, [label])

  expect(label.lineHeight).toEqual({ value: 26, unit: 'PIXELS' })
  expect(label.derivedLayout).toBeNull()
  expect(label.derivedTextGlyphs).toBeNull()
})

test('a text in a scaled instance keeps the layout Figma saved at the scaled size', () => {
  const label = savedText(60, 3)

  expect(label.fontSize).toBe(60)
  expect(label.derivedLayout).toEqual({ width: 12, height: 24 })
  expect(label.derivedTextGlyphs).toHaveLength(1)
})

test('a text drops a saved layout shaped at another size', () => {
  const label = savedText(14)

  expect(label.fontSize).toBe(20)
  expect(label.derivedLayout).toBeNull()
  expect(label.derivedTextGlyphs).toBeNull()
})

const leading = guid(14)
const component = guid(20)
const componentText = guid(21)
const tripled = guid(22)
const plain = guid(23)
const pair = guid(24)
const doubledInPair = guid(25)
const tripledPair = guid(26)
const holder = guid(27)
const tracking = guid(28)
const caption = guid(29)
const ownSized = guid(30)

function alias(variableField: string, variable: GUID) {
  return {
    variableField,
    variableData: {
      dataType: 'ALIAS',
      resolvedDataType: 'FLOAT',
      value: { alias: { guid: variable } }
    }
  }
}

function instance(id: GUID, parent: GUID, position: string, symbol: GUID, scale: number) {
  return {
    guid: id,
    type: 'INSTANCE',
    parentIndex: { guid: parent, position },
    symbolData: { symbolID: symbol, uniformScaleFactor: scale },
    size: { x: 40 * scale, y: 20 * scale }
  }
}

function scaledRecords(): NodeChange[] {
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
      variableDataValues: { entries: [floatIn(compact, 10), floatIn(roomy, 20)] }
    },
    {
      guid: leading,
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: collection },
      variableDataValues: { entries: [floatIn(compact, 12), floatIn(roomy, 24)] }
    },
    {
      guid: tracking,
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: collection },
      variableDataValues: { entries: [floatIn(compact, 1), floatIn(roomy, 2)] }
    },
    { guid: page, type: 'CANVAS' },
    {
      guid: style,
      type: 'TEXT',
      name: 'Body',
      styleType: 'TEXT',
      parentIndex: { guid: page, position: '!' },
      fontSize: 10,
      lineHeight: { value: 12, units: 'PIXELS' },
      parameterConsumptionMap: {
        entries: [
          alias('FONT_SIZE', size),
          alias('LINE_HEIGHT', leading),
          alias('LETTER_SPACING', tracking)
        ]
      }
    },
    {
      guid: component,
      type: 'SYMBOL',
      parentIndex: { guid: page, position: '"' },
      size: { x: 40, y: 20 }
    },
    {
      guid: componentText,
      type: 'TEXT',
      name: 'Label',
      parentIndex: { guid: component, position: '!' },
      size: { x: 40, y: 20 },
      textData: { characters: 'Hello' },
      fontSize: 10,
      lineHeight: { value: 12, units: 'PIXELS' },
      styleIdForText: { guid: style }
    },
    {
      guid: pair,
      type: 'SYMBOL',
      parentIndex: { guid: page, position: '#' },
      size: { x: 80, y: 40 }
    },
    instance(doubledInPair, pair, '!', component, 2),
    { guid: holder, type: 'FRAME', parentIndex: { guid: page, position: '$' } },
    instance(tripled, holder, '!', component, 3),
    instance(plain, holder, '"', component, 1),
    instance(tripledPair, holder, '#', pair, 3)
  ] as NodeChange[]
}

function scaledLabels() {
  const { graph, sources } = materializeDocument(scaledRecords())
  const placed = (record: GUID) => {
    const id = sources.get(guidToString(record))
    if (!id) {
      throw new Error('Expected the instance to be placed')
    }
    return id
  }
  const textIn = (id: string): SceneNode => {
    const [child] = graph.getChildren(id)
    if (!child) {
      throw new Error('Expected the instance to hold a layer')
    }
    return child.type === 'TEXT' ? child : textIn(child.id)
  }
  return {
    graph,
    holder: placed(holder),
    tripled: textIn(placed(tripled)),
    plain: textIn(placed(plain)),
    nested: textIn(placed(tripledPair))
  }
}

test('a text in a scaled instance takes its style bound size and leading at that scale', () => {
  const { tripled } = scaledLabels()

  expect(tripled.fontSize).toBe(30)
  expect(tripled.lineHeight).toEqual({ value: 36, unit: 'PIXELS' })
  expect(tripled.letterSpacing).toEqual({ value: 3, unit: 'PIXELS' })
})

test('a text in an unscaled instance takes its style bound size and leading as they are', () => {
  const { plain } = scaledLabels()

  expect(plain.fontSize).toBe(10)
  expect(plain.lineHeight).toEqual({ value: 12, unit: 'PIXELS' })
})

test('a text in an instance nested in a scaled instance takes both scales', () => {
  const { nested } = scaledLabels()

  expect(nested.fontSize).toBe(60)
  expect(nested.lineHeight).toEqual({ value: 72, unit: 'PIXELS' })
})

test('a text in a scaled instance keeps the scale when its mode changes', () => {
  const { graph, holder: frame, tripled } = scaledLabels()

  graph.updateNode(frame, {
    variableModes: { [guidToString(collection)]: guidToString(roomy) }
  })
  reconcileVariableBindings(graph, { subtrees: [frame] })

  expect(tripled.fontSize).toBe(60)
  expect(tripled.lineHeight).toEqual({ value: 72, unit: 'PIXELS' })
})

// Figma saves a styled text's own binding beside the style and draws the style's variable.
test("a loaded text binding its own size takes its style's size and keeps its binding", () => {
  const { graph } = materializeDocument([
    ...records(),
    {
      guid: caption,
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: collection },
      variableDataValues: { entries: [floatIn(compact, 11), floatIn(roomy, 12)] }
    },
    {
      guid: ownSized,
      type: 'TEXT',
      name: 'Caption',
      parentIndex: { guid: frame, position: '"' },
      textData: { characters: 'Hi' },
      fontSize: 11,
      styleIdForText: { guid: style },
      parameterConsumptionMap: {
        entries: [alias('FONT_SIZE', caption)]
      }
    }
  ] as NodeChange[])

  const label = graph.getNode(guidToString(ownSized))
  expect(label?.fontSize).toBe(20)
  expect(label?.boundVariables.fontSize).toBe(guidToString(caption))
})
