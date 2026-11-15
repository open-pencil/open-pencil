import { describe, expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { materializeDocument, materializeFigArchive } from '#fig/document/materialize'
import { CLEARED_STYLE } from '#fig/instance-overrides/fields'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })
const under = (parent: number, position = '!') => ({ guid: guid(parent), position })
const heading = { assetRef: { key: 'heading', version: '2:0' } }
const missingLibraryStyle = { assetRef: { key: 'missing', version: '1:0' } }
const STYLE_LETTER_SPACING = { value: 2, units: 'PERCENT' as const }
const CLAIMED_LETTER_SPACING = { value: 0, units: 'PIXELS' as const }
const CLAIMED_LINE_HEIGHT = { value: 24, units: 'PIXELS' as const }

function text(localID: number, parent: number, fields: Partial<NodeChange>): NodeChange {
  return {
    guid: guid(localID),
    type: 'TEXT',
    parentIndex: under(parent),
    overrideKey: guid(localID),
    textData: { characters: 'Label' },
    fontName: { family: 'Inter', style: 'Regular', postscript: '' },
    ...fields
  }
}

function instance(
  localID: number,
  symbol: number,
  position: string,
  overrides: NodeChange[]
): NodeChange {
  return {
    guid: guid(localID),
    type: 'INSTANCE',
    parentIndex: under(1, position),
    symbolData: { symbolID: guid(symbol), symbolOverrides: overrides }
  } as NodeChange
}

const claim = (path: number[], fields: Partial<NodeChange>): NodeChange =>
  ({ guidPath: { guids: path.map(guid) }, ...fields }) as NodeChange

const STYLE_VARIABLE = 42
const CLAIMED_VARIABLE = 43
const STYLE_VARIABLE_SIZE = 30
const CLAIMED_VARIABLE_SIZE = 44

function sizeVariable(localID: number, size: number): NodeChange {
  return {
    guid: guid(localID),
    type: 'VARIABLE',
    variableResolvedType: 'FLOAT',
    variableSetID: { guid: guid(40) },
    variableDataValues: {
      entries: [
        { modeID: guid(41), variableData: { dataType: 'FLOAT', value: { floatValue: size } } }
      ]
    }
  } as NodeChange
}

const LINE_HEIGHT_VARIABLE = 45

const bound = (variableField: string, variable: number): NodeChange['variableConsumptionMap'] => ({
  entries: [
    {
      variableField,
      variableData: {
        dataType: 'ALIAS',
        resolvedDataType: 'FLOAT',
        value: { alias: { guid: guid(variable) } }
      }
    }
  ]
})

const boundSize = (variable: number) => bound('FONT_SIZE', variable)

const claimedVariableSize = {
  fontSize: CLAIMED_VARIABLE_SIZE,
  variableConsumptionMap: boundSize(CLAIMED_VARIABLE)
}

const records: NodeChange[] = [
  { guid: guid(0), type: 'DOCUMENT' },
  { guid: guid(1), type: 'CANVAS', parentIndex: under(0) },
  {
    guid: guid(40),
    type: 'VARIABLE_SET',
    variableSetModes: [{ id: guid(41), name: 'Default' }]
  } as NodeChange,
  sizeVariable(STYLE_VARIABLE, STYLE_VARIABLE_SIZE),
  sizeVariable(CLAIMED_VARIABLE, CLAIMED_VARIABLE_SIZE),
  sizeVariable(LINE_HEIGHT_VARIABLE, 36),
  {
    guid: guid(3),
    type: 'TEXT',
    parentIndex: under(1, ' '),
    styleType: 'TEXT',
    key: 'bound',
    version: '1:0',
    fontSize: 28,
    lineHeight: { value: 32, units: 'PIXELS' },
    variableConsumptionMap: boundSize(STYLE_VARIABLE)
  },
  {
    guid: guid(2),
    type: 'TEXT',
    parentIndex: under(1, ' '),
    styleType: 'TEXT',
    key: 'heading',
    version: '2:0',
    fontSize: 28,
    letterSpacing: STYLE_LETTER_SPACING,
    fontName: { family: 'Inter', style: 'Bold', postscript: '' }
  },
  { guid: guid(10), type: 'SYMBOL', parentIndex: under(1, '!') },
  text(11, 10, { fontSize: 28, letterSpacing: STYLE_LETTER_SPACING, styleIdForText: heading }),
  text(12, 10, { fontSize: 16, styleIdForText: missingLibraryStyle }),
  text(13, 10, { fontSize: 28, styleIdForText: { assetRef: { key: 'bound', version: '1:0' } } }),
  text(14, 10, {
    fontSize: 28,
    styleIdForText: { assetRef: { key: 'bound', version: '1:0' } },
    variableConsumptionMap: bound('LINE_HEIGHT', LINE_HEIGHT_VARIABLE)
  }),
  { guid: guid(20), type: 'SYMBOL', parentIndex: under(1, '"') },
  {
    guid: guid(21),
    type: 'INSTANCE',
    parentIndex: under(20),
    overrideKey: guid(21),
    symbolData: { symbolID: guid(10) }
  } as NodeChange,
  instance(30, 10, '#', [
    claim([11], {
      fontSize: 20,
      letterSpacing: CLAIMED_LETTER_SPACING,
      lineHeight: CLAIMED_LINE_HEIGHT,
      textDecoration: 'UNDERLINE',
      textCase: 'UPPER'
    }),
    claim([12], { fontSize: 12 })
  ]),
  instance(31, 10, '$', [claim([11], { styleIdForText: CLEARED_STYLE, fontSize: 20 })]),
  instance(32, 20, '%', [claim([21, 11], { fontSize: 20 })]),
  instance(33, 10, '&', [claim([11], claimedVariableSize), claim([13], claimedVariableSize)]),
  instance(34, 10, "'", [claim([13], { variableConsumptionMap: boundSize(STYLE_VARIABLE) })]),
  instance(35, 10, '(', [claim([14], { fontSize: 20 })])
]

function textOf(
  graph: SceneGraph,
  sources: ReadonlyMap<string, string>,
  instanceId: string,
  childIndexes: number[]
) {
  let id = sources.get(instanceId) ?? ''
  for (const index of childIndexes) id = graph.getChildren(id)[index]?.id ?? ''
  const node = graph.getNode(id)
  if (node?.type !== 'TEXT') throw new Error(`No text in ${instanceId}`)
  return node
}

const ignoreUnresolvedBindings = { onUnresolvedBinding: () => undefined }

async function readers() {
  return {
    'records read whole': materializeDocument(records, [], ignoreUnresolvedBindings),
    'archive read by headers': materializeFigArchive(
      await figArchiveOf(records),
      ignoreUnresolvedBindings
    )
  }
}

describe('an instance text that keeps its inherited text style', async () => {
  for (const [reader, { graph, sources }] of Object.entries(await readers())) {
    test(`draws the style's size over a claimed one (${reader})`, () => {
      expect(textOf(graph, sources, '1:30', [0]).fontSize).toBe(28)
      expect(textOf(graph, sources, '1:32', [0, 0]).fontSize).toBe(28)
    })

    test(`draws the style's other fields over claimed ones (${reader})`, () => {
      expect(textOf(graph, sources, '1:30', [0]).letterSpacing).toEqual({
        value: STYLE_LETTER_SPACING.value,
        unit: 'PERCENT'
      })
    })

    test(`draws the default decoration and case a style leaves out over claimed ones (${reader})`, () => {
      // Figma saves a decoration or case set after the style in the text's runs, not as a claim.
      const text = textOf(graph, sources, '1:30', [0])
      expect([text.textDecoration, text.textCase]).toEqual(['NONE', 'ORIGINAL'])
    })

    test(`draws the style's value over a claimed variable (${reader})`, () => {
      const text = textOf(graph, sources, '1:33', [0])
      expect(text.fontSize).toBe(28)
      expect(text.boundVariables.fontSize).toBeUndefined()
    })

    test(`draws the style's variable over a claimed one (${reader})`, () => {
      const text = textOf(graph, sources, '1:33', [2])
      expect(text.fontSize).toBe(STYLE_VARIABLE_SIZE)
      expect(text.boundVariables.fontSize).toBe(`1:${STYLE_VARIABLE}`)
    })

    test(`yields only the fields a claim touches (${reader})`, () => {
      const text = textOf(graph, sources, '1:35', [3])
      expect(text.fontSize).toBe(STYLE_VARIABLE_SIZE)
      expect(text.boundVariables.lineHeight).toBe(`1:${LINE_HEIGHT_VARIABLE}`)
    })

    test(`keeps a claimed variable that repeats the style's (${reader})`, () => {
      const text = textOf(graph, sources, '1:34', [2])
      expect(text.fontSize).toBe(STYLE_VARIABLE_SIZE)
      expect(text.boundVariables.fontSize).toBe(`1:${STYLE_VARIABLE}`)
    })

    test(`keeps a claimed field the style leaves unset (${reader})`, () => {
      expect(textOf(graph, sources, '1:30', [0]).lineHeight).toEqual({
        value: CLAIMED_LINE_HEIGHT.value,
        unit: 'PIXELS'
      })
    })

    test(`takes claimed values once the style is cleared or missing (${reader})`, () => {
      expect(textOf(graph, sources, '1:31', [0]).fontSize).toBe(20)
      expect(textOf(graph, sources, '1:30', [1]).fontSize).toBe(12)
    })
  }
})
