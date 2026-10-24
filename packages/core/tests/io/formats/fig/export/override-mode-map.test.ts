import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { SymbolData } from '@open-pencil/fig/instance-overrides'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })
const child = (parent: number, position: string) => ({
  parentIndex: { guid: guid(parent), position }
})

const SIZES = { guid: guid(3) }
const COMPACT = 10
const WIDE = 11
const clearSizes = { variableModeBySetMap: { entries: [{ variableSetID: SIZES }] } }
const wideSizes = { entries: [{ variableSetID: SIZES, variableModeID: guid(WIDE) }] }

function pin(mode: number | undefined): Partial<NodeChange> {
  return mode === undefined
    ? {}
    : { variableModeBySetMap: { entries: [{ variableSetID: SIZES, variableModeID: guid(mode) }] } }
}

interface Fixture {
  leafPin?: number
  nestedPin?: number
  nestedOverride?: Record<string, unknown>
}

function records({ leafPin = WIDE, nestedPin, nestedOverride }: Fixture = {}): NodeChange[] {
  const symbolOverrides = nestedOverride
    ? [{ guidPath: { guids: [guid(6)] }, ...nestedOverride }]
    : []
  return [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', name: 'Page', ...child(1, '!') },
    {
      guid: guid(3),
      type: 'VARIABLE_SET',
      name: 'Sizes',
      variableSetModes: [
        { id: guid(COMPACT), name: 'Compact', sortPosition: 'a' },
        { id: guid(WIDE), name: 'Wide', sortPosition: 'b' }
      ]
    },
    {
      guid: guid(20),
      type: 'SYMBOL',
      name: 'Leaf',
      size: { x: 64, y: 10 },
      ...child(2, 'a'),
      ...pin(leafPin)
    },
    { guid: guid(5), type: 'SYMBOL', name: 'Card', size: { x: 100, y: 10 }, ...child(2, 'b') },
    {
      guid: guid(6),
      type: 'INSTANCE',
      name: 'Nested',
      size: { x: 64, y: 10 },
      ...child(5, 'a'),
      symbolData: { symbolID: guid(20) },
      ...pin(nestedPin)
    },
    {
      guid: guid(7),
      type: 'INSTANCE',
      name: 'Outer',
      size: { x: 100, y: 10 },
      ...child(2, 'c'),
      symbolData: { symbolID: guid(5), symbolOverrides } as NodeChange['symbolData']
    }
  ]
}

function nestedOf(graph: SceneGraph): SceneNode {
  const outer = expectDefined(
    [...graph.getAllNodes()].find((node) => node.type === 'INSTANCE' && node.name === 'Outer'),
    'outer instance'
  )
  return expectDefined(graph.getChildren(outer.id)[0], 'nested instance')
}

function sizesOf(graph: SceneGraph) {
  return expectDefined(
    [...graph.variableCollections.values()].find((collection) => collection.name === 'Sizes'),
    'collection'
  )
}

function nestedModeName(graph: SceneGraph): string | undefined {
  const sizes = sizesOf(graph)
  const modeId = graph.getNodeVariableModeId(nestedOf(graph).id, sizes.id)
  return sizes.modes.find((mode) => mode.modeId === modeId)?.name
}

function setNestedMode(graph: SceneGraph, name: string): void {
  const sizes = sizesOf(graph)
  const mode = expectDefined(
    sizes.modes.find((candidate) => candidate.name === name),
    'mode'
  )
  const nested = new FigmaAPI(graph).wrapNode(nestedOf(graph).id)
  nested.setExplicitVariableModeForCollection(sizes.id, mode.modeId)
}

function clearNestedMode(graph: SceneGraph): void {
  const nested = new FigmaAPI(graph).wrapNode(nestedOf(graph).id)
  nested.clearExplicitVariableModeForCollection(sizesOf(graph).id)
}

async function exported(graph: SceneGraph) {
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer)
  const outer = parsed.nodeChanges.find((node) => node.name === 'Outer')
  const overrides = (outer?.symbolData as SymbolData | undefined)?.symbolOverrides ?? []
  const { graph: reopened } = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  })
  return {
    modeMaps: overrides.flatMap((override) => override.variableModeBySetMap ?? []),
    reopened
  }
}

function opened(fixture?: Fixture): SceneGraph {
  return materializeDocument(records(fixture), [], { derivedBounds: true }).graph
}

test('an override that clears the component mode round trips through export', async () => {
  const graph = opened({ nestedOverride: clearSizes })
  expect(nestedModeName(graph)).toBe('Compact')

  const { modeMaps, reopened } = await exported(graph)

  expect(modeMaps).toEqual([clearSizes.variableModeBySetMap])
  expect(nestedModeName(reopened)).toBe('Compact')
})

test('an override that repeats the component mode stays explicit through export', async () => {
  const graph = opened({ nestedOverride: pin(WIDE) })

  const { modeMaps, reopened } = await exported(graph)

  expect(modeMaps).toEqual([wideSizes])
  expect(nestedModeName(reopened)).toBe('Wide')
})

test('a component mode cleared in the session is exported as cleared', async () => {
  const graph = opened()
  expect(nestedModeName(graph)).toBe('Wide')
  clearNestedMode(graph)

  const { modeMaps, reopened } = await exported(graph)

  expect(modeMaps).toEqual([clearSizes.variableModeBySetMap])
  expect(nestedModeName(reopened)).toBe('Compact')
})

test('a mode set over the nested layer of the outer component survives export', async () => {
  const graph = opened({ leafPin: WIDE, nestedPin: COMPACT })
  expect(nestedModeName(graph)).toBe('Compact')
  setNestedMode(graph, 'Wide')

  const { reopened } = await exported(graph)

  expect(nestedModeName(reopened)).toBe('Wide')
})

test('a cleared mode of the nested layer in the outer component survives export', async () => {
  const graph = opened({ leafPin: undefined, nestedPin: WIDE })
  expect(nestedModeName(graph)).toBe('Wide')
  clearNestedMode(graph)

  const { reopened } = await exported(graph)

  expect(nestedModeName(reopened)).toBe('Compact')
})

test('a component mode the nested instance only inherits is not written as an override', async () => {
  const graph = opened()

  const { modeMaps, reopened } = await exported(graph)

  expect(modeMaps).toEqual([])
  expect(nestedModeName(reopened)).toBe('Wide')
})

interface TwoLevelFixture {
  leafPin?: number
  swappedPin?: number
}

function twoLevelRecords({ leafPin, swappedPin }: TwoLevelFixture): NodeChange[] {
  const leaf = { guid: guid(31), type: 'INSTANCE', name: 'Leaf', size: { x: 64, y: 10 } } as const
  return [
    ...records().slice(0, 3),
    {
      guid: guid(20),
      type: 'SYMBOL',
      name: 'Plain',
      size: { x: 64, y: 10 },
      ...child(2, 'a'),
      ...pin(leafPin)
    },
    {
      guid: guid(21),
      type: 'SYMBOL',
      name: 'Swapped',
      size: { x: 64, y: 10 },
      ...child(2, 'b'),
      ...pin(swappedPin)
    },
    { guid: guid(30), type: 'SYMBOL', name: 'Inner', size: { x: 80, y: 10 }, ...child(2, 'c') },
    { ...leaf, ...child(30, 'a'), symbolData: { symbolID: guid(20) } },
    { guid: guid(5), type: 'SYMBOL', name: 'Card', size: { x: 100, y: 10 }, ...child(2, 'd') },
    {
      guid: guid(6),
      type: 'INSTANCE',
      name: 'Middle',
      size: { x: 80, y: 10 },
      ...child(5, 'a'),
      symbolData: {
        symbolID: guid(30),
        symbolOverrides: [{ guidPath: { guids: [guid(31)] }, overriddenSymbolID: guid(21) }]
      } as NodeChange['symbolData']
    },
    {
      guid: guid(7),
      type: 'INSTANCE',
      name: 'Outer',
      size: { x: 100, y: 10 },
      ...child(2, 'e'),
      symbolData: { symbolID: guid(5), symbolOverrides: [] } as NodeChange['symbolData']
    }
  ]
}

function swappedLeafOf(graph: SceneGraph): SceneNode {
  return expectDefined(graph.getChildren(nestedOf(graph).id)[0], 'swapped leaf')
}

function swappedModeName(graph: SceneGraph): string | undefined {
  const sizes = sizesOf(graph)
  const modeId = graph.getNodeVariableModeId(swappedLeafOf(graph).id, sizes.id)
  return sizes.modes.find((mode) => mode.modeId === modeId)?.name
}

function openTwoLevel(fixture: TwoLevelFixture): SceneGraph {
  return materializeDocument(twoLevelRecords(fixture), [], { derivedBounds: true }).graph
}

test('a swap two levels down keeps the mode of the component it swaps in through export', async () => {
  const graph = openTwoLevel({ leafPin: WIDE, swappedPin: COMPACT })
  expect(swappedModeName(graph)).toBe('Compact')

  const { reopened } = await exported(graph)

  expect(swappedModeName(reopened)).toBe('Compact')
})

test('a mode set on a layer swapped two levels down survives export', async () => {
  const graph = openTwoLevel({ leafPin: WIDE, swappedPin: COMPACT })
  const sizes = sizesOf(graph)
  const wide = expectDefined(
    sizes.modes.find((mode) => mode.name === 'Wide'),
    'mode'
  )
  new FigmaAPI(graph)
    .wrapNode(swappedLeafOf(graph).id)
    .setExplicitVariableModeForCollection(sizes.id, wide.modeId)

  const { reopened } = await exported(graph)

  expect(swappedModeName(reopened)).toBe('Wide')
})

test('a mode cleared on a layer swapped two levels down survives export', async () => {
  const graph = openTwoLevel({ swappedPin: WIDE })
  expect(swappedModeName(graph)).toBe('Wide')
  new FigmaAPI(graph)
    .wrapNode(swappedLeafOf(graph).id)
    .clearExplicitVariableModeForCollection(sizesOf(graph).id)

  const { reopened } = await exported(graph)

  expect(swappedModeName(reopened)).toBe('Compact')
})
