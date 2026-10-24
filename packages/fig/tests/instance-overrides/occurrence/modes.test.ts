import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'
import { createOccurrenceInterpreter } from '#fig/instance-overrides/interpret'
import { occurrences } from '#fig/instance-overrides/occurrence/path'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const SIZES = 3
const COMPACT = 10
const WIDE = 11
const THEME = 8
const LIGHT = 12
const DARK = 13
const WIDTH = 4
const THEMED_WIDTH = 9
const WIDTH_BY_MODE = { [COMPACT]: 40, [WIDE]: 64 }
const SAVED_WIDTH = 41

const LEAF = 20
const WIDE_LEAF = 21
const CARD = 5
const NESTED = 6
const OUTER = 7
const PANEL = 30
const PANEL_CARD = 31
const OUTER_PANEL = 32
const CARD_FRAME = 40

type Patches = Partial<Record<number, Partial<NodeChange>>>

function modes(...entries: [collection: number, mode: number][]): Partial<NodeChange> {
  return {
    variableModeBySetMap: {
      entries: entries.map(([collection, mode]) => ({
        variableSetID: { guid: guid(collection) },
        variableModeID: guid(mode)
      }))
    }
  }
}

function at(path: number[], props: Record<string, unknown>): Record<string, unknown> {
  return { guidPath: { guids: path.map((id) => guid(id)) }, ...props }
}

function instanceOf(component: number, symbolOverrides: unknown[] = []): Partial<NodeChange> {
  const symbolData = { symbolID: guid(component), symbolOverrides }
  return { symbolData: symbolData as NodeChange['symbolData'] }
}

function child(parent: number, position: string): { parentIndex: NodeChange['parentIndex'] } {
  return { parentIndex: { guid: guid(parent), position } }
}

function collection(id: number, modeIds: number[]): NodeChange {
  return {
    guid: guid(id),
    type: 'VARIABLE_SET',
    variableSetModes: modeIds.map((mode, index) => ({
      id: guid(mode),
      name: `Mode ${mode}`,
      sortPosition: String.fromCharCode(97 + index)
    }))
  }
}

function fixture(patches: Patches = {}): NodeChange[] {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', ...child(1, '!') },
    collection(SIZES, [COMPACT, WIDE]),
    collection(THEME, [LIGHT, DARK]),
    {
      guid: guid(WIDTH),
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: guid(SIZES) },
      variableDataValues: {
        entries: Object.entries(WIDTH_BY_MODE).map(([mode, width]) => ({
          modeID: guid(Number(mode)),
          variableData: { dataType: 'FLOAT', value: { floatValue: width } }
        }))
      }
    },
    {
      guid: guid(THEMED_WIDTH),
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: guid(THEME) },
      variableDataValues: {
        entries: [LIGHT, DARK].map((mode) => ({
          modeID: guid(mode),
          variableData: { dataType: 'ALIAS', value: { alias: { guid: guid(WIDTH) } } }
        }))
      }
    },
    { guid: guid(LEAF), type: 'SYMBOL', size: { x: 40, y: 10 }, ...child(2, 'a') },
    {
      guid: guid(WIDE_LEAF),
      type: 'SYMBOL',
      size: { x: 64, y: 10 },
      ...child(2, 'b'),
      ...modes([SIZES, WIDE])
    },
    { guid: guid(CARD_FRAME), type: 'FRAME', size: { x: 200, y: 10 }, ...child(2, 'c') },
    { guid: guid(CARD), type: 'SYMBOL', size: { x: 100, y: 10 }, ...child(2, 'd') },
    {
      guid: guid(NESTED),
      type: 'INSTANCE',
      size: { x: SAVED_WIDTH, y: 10 },
      ...child(CARD, 'a'),
      ...instanceOf(LEAF),
      variableConsumptionMap: {
        entries: [
          {
            variableField: 'WIDTH',
            variableData: { dataType: 'ALIAS', value: { alias: { guid: guid(WIDTH) } } }
          }
        ]
      }
    },
    {
      guid: guid(OUTER),
      type: 'INSTANCE',
      size: { x: 100, y: 10 },
      ...child(2, 'e'),
      ...instanceOf(CARD)
    },
    { guid: guid(PANEL), type: 'SYMBOL', size: { x: 100, y: 10 }, ...child(2, 'f') },
    {
      guid: guid(PANEL_CARD),
      type: 'INSTANCE',
      size: { x: 100, y: 10 },
      ...child(PANEL, 'a'),
      ...instanceOf(CARD)
    },
    {
      guid: guid(OUTER_PANEL),
      type: 'INSTANCE',
      size: { x: 100, y: 10 },
      ...child(2, 'g'),
      ...instanceOf(PANEL)
    }
  ]
  return changes.map((change) => ({ ...change, ...patches[change.guid?.localID ?? 0] }))
}

function nestedWidth(changes: NodeChange[], outer = OUTER, depth = 1): number {
  const { graph, sources } = materializeDocument(changes, [], { derivedBounds: true })
  let id = sources.get(`1:${outer}`)
  for (let level = 0; level < depth; level++) {
    id = id ? graph.getChildren(id)[0]?.id : undefined
  }
  const nested = id ? graph.nodes.get(id) : undefined
  if (!nested) {
    throw new Error('Missing nested instance')
  }
  return nested.width
}

test('a nested instance takes its bound size from the mode its outer instance sets', () => {
  expect(nestedWidth(fixture({ [OUTER]: modes([SIZES, WIDE]) }))).toBe(WIDTH_BY_MODE[WIDE])
})

test('a nested instance keeps its saved size where no outer mode differs', () => {
  expect(nestedWidth(fixture())).toBe(SAVED_WIDTH)
})

test('derived data the outer instance saved wins over the nested instance mode', () => {
  const derivedWidth = 70
  const derived = {
    derivedSymbolData: [{ guidPath: { guids: [guid(NESTED)] }, size: { x: derivedWidth, y: 10 } }]
  }
  expect(nestedWidth(fixture({ [OUTER]: { ...modes([SIZES, WIDE]), ...derived } }))).toBe(
    derivedWidth
  )
})

test('a mode the outer instance sets on the nested instance through its overrides applies', () => {
  const outer = instanceOf(CARD, [at([NESTED], modes([SIZES, WIDE]))])
  expect(nestedWidth(fixture({ [OUTER]: outer }))).toBe(WIDTH_BY_MODE[WIDE])
})

test('a mode set through overrides two instance levels down applies', () => {
  const outer = instanceOf(PANEL, [at([PANEL_CARD, NESTED], modes([SIZES, WIDE]))])
  expect(nestedWidth(fixture({ [OUTER_PANEL]: outer }), OUTER_PANEL, 2)).toBe(WIDTH_BY_MODE[WIDE])
})

test('an explicit default mode where the component is defined matches an absent one', () => {
  const patches = {
    [CARD_FRAME]: modes([SIZES, COMPACT]),
    [CARD]: child(CARD_FRAME, 'a')
  }
  expect(nestedWidth(fixture(patches))).toBe(SAVED_WIDTH)
})

test('an explicit default mode on the outer instance matches an absent one', () => {
  expect(nestedWidth(fixture({ [OUTER]: modes([SIZES, COMPACT]) }))).toBe(SAVED_WIDTH)
})

const SAVED_IN_WIDE = 63

function pinnedCard(outer: Partial<NodeChange>): Patches {
  return {
    [CARD]: modes([SIZES, WIDE]),
    [NESTED]: { size: { x: SAVED_IN_WIDE, y: 10 } },
    [OUTER]: outer
  }
}

test('an instance record that repeats its component root mode keeps the saved size', () => {
  const outer = modes([SIZES, WIDE], [THEME, LIGHT])
  expect(nestedWidth(fixture(pinnedCard(outer)))).toBe(SAVED_IN_WIDE)
})

test('an instance record mode map replaces the modes its component root sets', () => {
  expect(nestedWidth(fixture(pinnedCard(modes([THEME, LIGHT]))))).toBe(WIDTH_BY_MODE[COMPACT])
})

test('a swapped nested instance takes the mode of the component that replaced it', () => {
  const outer = instanceOf(CARD, [at([NESTED], { overriddenSymbolID: guid(WIDE_LEAF) })])
  expect(nestedWidth(fixture({ [OUTER]: outer }))).toBe(WIDTH_BY_MODE[WIDE])
})

test('a mode of a collection the nested instance does not bind keeps its saved size', () => {
  expect(nestedWidth(fixture({ [OUTER]: modes([THEME, DARK]) }))).toBe(SAVED_WIDTH)
})

test('a collection the nested binding reaches through an alias drops its saved size', () => {
  const themed = {
    variableConsumptionMap: {
      entries: [
        {
          variableField: 'WIDTH',
          variableData: { dataType: 'ALIAS', value: { alias: { guid: guid(THEMED_WIDTH) } } }
        }
      ]
    }
  }
  const changes = fixture({ [NESTED]: themed, [OUTER]: modes([SIZES, WIDE]) })
  const outer = createOccurrenceInterpreter(changes).instance(`1:${OUTER}`)
  const nested = [...occurrences(outer)].find(({ sourceId }) => sourceId === `1:${NESTED}`)

  expect(nested?.properties.size).toEqual({ x: SAVED_WIDTH, y: 10 })
  expect(nested?.derivedSize).toBeUndefined()
})

function modeUnset(collection: number): Partial<NodeChange> {
  return { variableModeBySetMap: { entries: [{ variableSetID: { guid: guid(collection) } }] } }
}

function nestedNode(changes: NodeChange[]) {
  const { graph, sources } = materializeDocument(changes, [], { derivedBounds: true })
  const outer = sources.get(`1:${OUTER}`)
  const nested = outer ? graph.getChildren(outer)[0] : undefined
  if (!nested) {
    throw new Error('Missing nested instance')
  }
  return { graph, nested }
}

test('an override naming a collection without a mode clears the nested component mode', () => {
  const patches = {
    [NESTED]: { ...instanceOf(WIDE_LEAF), size: { x: WIDTH_BY_MODE[WIDE], y: 10 } },
    [OUTER]: instanceOf(CARD, [at([NESTED], modeUnset(SIZES))])
  }
  const { graph, nested } = nestedNode(fixture(patches))

  expect(graph.getNodeVariableModeId(nested.id, `1:${SIZES}`)).toBe(`1:${COMPACT}`)
})

test('an override naming a collection without a mode clears the nested layer mode', () => {
  const patches = {
    [NESTED]: { ...modes([SIZES, WIDE]), size: { x: WIDTH_BY_MODE[WIDE], y: 10 } },
    [OUTER]: instanceOf(CARD, [at([NESTED], modeUnset(SIZES))])
  }
  expect(nestedWidth(fixture(patches))).toBe(WIDTH_BY_MODE[COMPACT])
})

test('a cleared component mode drops the saved size of the nested instance', () => {
  const patches = {
    [NESTED]: { ...instanceOf(WIDE_LEAF), size: { x: WIDTH_BY_MODE[WIDE], y: 10 } },
    [OUTER]: instanceOf(CARD, [at([NESTED], modeUnset(SIZES))])
  }
  expect(nestedWidth(fixture(patches))).toBe(WIDTH_BY_MODE[COMPACT])
})

test('a cleared mode takes the mode the outer instance sets', () => {
  const patches = {
    [NESTED]: { ...modes([SIZES, COMPACT]), size: { x: WIDTH_BY_MODE[COMPACT], y: 10 } },
    [OUTER]: { ...modes([SIZES, WIDE]), ...instanceOf(CARD, [at([NESTED], modeUnset(SIZES))]) }
  }
  expect(nestedWidth(fixture(patches))).toBe(WIDTH_BY_MODE[WIDE])
})

test('an override mode replaces the nested layer mode of the same collection', () => {
  const patches = {
    [NESTED]: { ...modes([SIZES, WIDE]), size: { x: WIDTH_BY_MODE[WIDE], y: 10 } },
    [OUTER]: instanceOf(CARD, [at([NESTED], modes([SIZES, COMPACT]))])
  }
  expect(nestedWidth(fixture(patches))).toBe(WIDTH_BY_MODE[COMPACT])
})

test('an override of one collection keeps the nested layer mode of another', () => {
  const patches = {
    [NESTED]: { ...modes([SIZES, WIDE], [THEME, DARK]), size: { x: WIDTH_BY_MODE[WIDE], y: 10 } },
    [OUTER]: instanceOf(CARD, [at([NESTED], modeUnset(THEME))])
  }
  const { graph, nested } = nestedNode(fixture(patches))

  expect(nested.width).toBe(WIDTH_BY_MODE[WIDE])
  expect(nested.variableModes).toEqual({ [`1:${SIZES}`]: `1:${WIDE}` })
  expect(graph.getNodeVariableModeId(nested.id, `1:${THEME}`)).toBe(`1:${LIGHT}`)
})

test('an instance record mode map stands for all of its modes', () => {
  const patches = {
    [NESTED]: { ...instanceOf(WIDE_LEAF), ...modes([THEME, DARK]) },
    [OUTER]: instanceOf(CARD)
  }
  const { nested } = nestedNode(fixture(patches))

  expect(nested.variableModes).toEqual({ [`1:${THEME}`]: `1:${DARK}` })
})
