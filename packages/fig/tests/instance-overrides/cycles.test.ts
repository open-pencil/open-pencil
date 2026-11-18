import { describe, expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { materializeFigArchive } from '#fig/document/materialize'
import { inheritComponentPropertyDefinitions } from '#fig/document/property-inheritance'
import { createOccurrenceInterpreter } from '#fig/instance-overrides/interpret'
import {
  createReferenceGraph,
  recordsReachingLoops
} from '#fig/instance-overrides/loops/references'
import type { InstanceOccurrence } from '#fig/instance-overrides/occurrence/types'
import { createSourceIndex, parentIdOf } from '#fig/instance-overrides/source-index'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

// Each case is a set of records Figma was given by paste, and each expectation is the layers
// Figma kept: it leaves out an instance whose component would contain itself, choosing it by
// walking definitions in layer order, and expands a swap to an enclosing component once.

const guid = (localID: number): GUID => ({ sessionID: 1, localID })
const id = (localID: number) => `1:${localID}`

const DOCUMENT = 0
const PAGE = 1
const OTHER_PAGE = 2
const INNER = 10
const OUTER = 20
const NESTED = 21
const OUTER_INSTANCE = 30
const ICON = 40

function record(
  localID: number,
  type: string,
  parent: number | undefined,
  position: string,
  fields: Partial<NodeChange> = {}
): NodeChange {
  return {
    guid: guid(localID),
    type,
    phase: 'CREATED',
    name: `${type} ${localID}`,
    ...(parent === undefined ? {} : { parentIndex: { guid: guid(parent), position } }),
    ...fields
  } as NodeChange
}

const instance = (
  localID: number,
  parent: number,
  position: string,
  component: number,
  fields: Partial<NodeChange> = {}
) =>
  record(localID, 'INSTANCE', parent, position, {
    symbolData: { symbolID: guid(component), symbolOverrides: [] },
    ...fields
  } as Partial<NodeChange>)

/** Inner, then Outer holding an instance of Inner, then an instance of Outer, on one page. */
function components(fields: { nested?: Partial<NodeChange>; outer?: Partial<NodeChange> } = {}) {
  return [
    record(DOCUMENT, 'DOCUMENT', undefined, ''),
    record(PAGE, 'CANVAS', DOCUMENT, '!'),
    record(INNER, 'SYMBOL', PAGE, '!'),
    record(OUTER, 'SYMBOL', PAGE, '"', fields.outer),
    instance(NESTED, OUTER, '!', INNER, fields.nested)
  ]
}

/** An occurrence as the layers it shows: each layer's source and the component it expands. */
interface Shown {
  id: string
  main?: string
  children: Shown[]
}

function shown(occurrence: InstanceOccurrence): Shown {
  return {
    id: occurrence.sourceId,
    ...(occurrence.mainComponentId ? { main: occurrence.mainComponentId } : {}),
    children: occurrence.children.map(shown)
  }
}

function read(changes: NodeChange[]) {
  const leftOut: string[] = []
  const interpreter = createOccurrenceInterpreter(changes)
  // As a file session reads: a swap whose layer is gone is reported, not fatal.
  const options = {
    onCyclicComponent: ({ instanceId }: { instanceId: string }) => leftOut.push(instanceId),
    onUnresolvedAssignment: () => undefined
  }
  return {
    component: (localID: number) => shown(interpreter.component(id(localID), options)),
    instance: (localID: number) => shown(interpreter.instance(id(localID), options)),
    leftOut: () => [...new Set(leftOut)]
  }
}

describe('a swap to an enclosing component', () => {
  test('expands the component once more, with its own defaults', () => {
    const reader = read([
      ...components(),
      instance(OUTER_INSTANCE, PAGE, '#', OUTER, {
        symbolData: {
          symbolID: guid(OUTER),
          symbolOverrides: [
            { guidPath: { guids: [guid(NESTED)] }, overriddenSymbolID: guid(OUTER) }
          ]
        }
      } as Partial<NodeChange>)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(OUTER),
      children: [
        {
          id: id(NESTED),
          main: id(OUTER),
          children: [{ id: id(NESTED), main: id(INNER), children: [] }]
        }
      ]
    })
    expect(reader.leftOut()).toEqual([])
  })

  test('expands once per swap a chain of them makes', () => {
    const nested = { guids: [guid(NESTED)] }
    const reader = read([
      ...components(),
      instance(OUTER_INSTANCE, PAGE, '#', OUTER, {
        symbolData: {
          symbolID: guid(OUTER),
          symbolOverrides: [
            { guidPath: nested, overriddenSymbolID: guid(OUTER) },
            { guidPath: { guids: [guid(NESTED), guid(NESTED)] }, overriddenSymbolID: guid(OUTER) }
          ]
        }
      } as Partial<NodeChange>)
    ])

    const depth = (node: Shown): number =>
      1 + node.children.reduce((deepest, child) => Math.max(deepest, depth(child)), 0)
    expect(depth(reader.instance(OUTER_INSTANCE))).toBe(4)
  })

  test('expands a swap property value naming the enclosing component the same way', () => {
    const reader = read([
      ...components({
        outer: {
          componentPropDefs: [
            {
              id: guid(ICON),
              name: 'Icon',
              type: 'INSTANCE_SWAP',
              initialValue: { guidValue: guid(INNER) }
            }
          ]
        } as Partial<NodeChange>,
        nested: {
          componentPropRefs: [{ defID: guid(ICON), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
        } as Partial<NodeChange>
      }),
      instance(OUTER_INSTANCE, PAGE, '#', OUTER, {
        componentPropAssignments: [{ defID: guid(ICON), value: { guidValue: guid(OUTER) } }]
      } as Partial<NodeChange>)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(OUTER),
      children: [
        {
          id: id(NESTED),
          main: id(OUTER),
          children: [{ id: id(NESTED), main: id(INNER), children: [] }]
        }
      ]
    })
  })
})

describe('a component that would contain itself', () => {
  test('loses the instance of itself in its definition', () => {
    const reader = read(components({ nested: { symbolData: { symbolID: guid(OUTER) } } }))

    expect(reader.component(OUTER)).toEqual({ id: id(OUTER), children: [] })
    expect(reader.leftOut()).toEqual([id(NESTED)])
  })

  test('shows an instance of itself inside a component as empty, and keeps the component', () => {
    const reader = read(components({ nested: { symbolData: { symbolID: guid(NESTED) } } }))

    expect(reader.component(OUTER)).toEqual({
      id: id(OUTER),
      children: [{ id: id(NESTED), children: [] }]
    })
  })

  test('keeps an instance whose swap property default breaks the loop', () => {
    const reader = read(
      components({
        outer: {
          componentPropDefs: [
            {
              id: guid(ICON),
              name: 'Icon',
              type: 'INSTANCE_SWAP',
              initialValue: { guidValue: guid(INNER) }
            }
          ]
        } as Partial<NodeChange>,
        nested: {
          symbolData: { symbolID: guid(OUTER) },
          componentPropRefs: [{ defID: guid(ICON), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
        } as Partial<NodeChange>
      })
    )

    expect(reader.component(OUTER)).toEqual({
      id: id(OUTER),
      children: [{ id: id(NESTED), main: id(INNER), children: [] }]
    })
  })

  // Inner holds Outer and Outer holds Inner: whichever component comes first in the layers,
  // the instance that leads back into it goes, whichever definition a read starts from.
  test.each([
    { first: INNER, lost: NESTED },
    { first: OUTER, lost: 22 }
  ])('loses the instance that leads back into $first, which comes first', ({ first, lost }) => {
    const changes = components()
    changes.push(instance(22, INNER, '!', OUTER))
    const innerPosition = first === INNER ? '!' : '"'
    for (const change of changes) {
      if (change.guid?.localID === INNER)
        change.parentIndex = { guid: guid(PAGE), position: innerPosition }
      if (change.guid?.localID === OUTER)
        change.parentIndex = { guid: guid(PAGE), position: first === INNER ? '"' : '!' }
    }

    for (const start of [INNER, OUTER]) {
      const reader = read(changes)
      reader.component(start)
      expect(reader.leftOut()).toEqual([id(lost)])
    }
  })

  test('is decided by a component earlier in the layers that reaches the loop', () => {
    const changes = components()
    changes.push(
      instance(22, INNER, '!', OUTER),
      record(50, 'SYMBOL', PAGE, ' '),
      instance(51, 50, '!', OUTER)
    )
    const reader = read(changes)

    expect(reader.component(OUTER)).toEqual({
      id: id(OUTER),
      children: [{ id: id(NESTED), main: id(INNER), children: [] }]
    })
    expect(reader.leftOut()).toEqual([id(22)])
  })

  test('loses an instance whose own swap leads back into its definition', () => {
    const reader = read([
      ...components(),
      record(50, 'SYMBOL', PAGE, '$'),
      instance(51, 50, '!', OUTER, {
        symbolData: {
          symbolID: guid(OUTER),
          symbolOverrides: [{ guidPath: { guids: [guid(NESTED)] }, overriddenSymbolID: guid(50) }]
        }
      } as Partial<NodeChange>)
    ])

    expect(reader.component(50)).toEqual({ id: id(50), children: [] })
    expect(reader.leftOut()).toEqual([id(51)])
  })

  test('loses an instance whose assignment to a nested instance leads back into its definition', () => {
    // Inner shows its Icon swap property in a layer; an instance of Outer in another component
    // sets the Icon of Outer's instance of Inner to that component.
    const changes = components()
    for (const change of changes)
      if (change.guid?.localID === INNER)
        change.componentPropDefs = [
          {
            id: guid(ICON),
            name: 'Icon',
            type: 'INSTANCE_SWAP',
            initialValue: { guidValue: guid(60) }
          }
        ] as NodeChange['componentPropDefs']
    const reader = read([
      ...changes,
      record(60, 'SYMBOL', PAGE, '%'),
      instance(12, INNER, '!', 60, {
        componentPropRefs: [{ defID: guid(ICON), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
      } as Partial<NodeChange>),
      record(50, 'SYMBOL', PAGE, '$'),
      instance(51, 50, '!', OUTER, {
        symbolData: {
          symbolID: guid(OUTER),
          symbolOverrides: [
            {
              guidPath: { guids: [guid(NESTED)] },
              componentPropAssignments: [{ defID: guid(ICON), value: { guidValue: guid(50) } }]
            }
          ]
        }
      } as Partial<NodeChange>)
    ])

    expect(reader.component(50)).toEqual({ id: id(50), children: [] })
    expect(reader.leftOut()).toEqual([id(51)])
  })
})

const swapAt = (path: number[], to: number) => ({
  guidPath: { guids: path.map(guid) },
  overriddenSymbolID: guid(to)
})

describe('a repair that matches the definitions, whatever a read expands', () => {
  test('keeps an instance whose own swap replaces the component it would repeat', () => {
    const changes = [
      ...components({
        nested: {
          symbolData: { symbolID: guid(OUTER), symbolOverrides: [swapAt([OUTER], INNER)] }
        } as Partial<NodeChange>
      }),
      record(50, 'SYMBOL', PAGE, '#'),
      instance(51, 50, '!', 50)
    ]
    const reader = read(changes)
    reader.component(50)

    expect(reader.component(OUTER)).toEqual({
      id: id(OUTER),
      children: [{ id: id(NESTED), main: id(INNER), children: [] }]
    })
    expect(reader.leftOut()).toEqual([id(51)])
  })

  test('expands a repeat that a swap from further out led into', () => {
    const reader = read([
      ...components(),
      record(60, 'SYMBOL', PAGE, '#'),
      instance(61, 60, '!', OUTER),
      instance(OUTER_INSTANCE, PAGE, '$', OUTER, {
        symbolData: { symbolID: guid(OUTER), symbolOverrides: [swapAt([NESTED], 60)] }
      } as Partial<NodeChange>)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(OUTER),
      children: [
        {
          id: id(NESTED),
          main: id(60),
          children: [
            {
              id: id(61),
              main: id(OUTER),
              children: [{ id: id(NESTED), main: id(INNER), children: [] }]
            }
          ]
        }
      ]
    })
    expect(reader.leftOut()).toEqual([])
  })

  test('leaves the instance out wherever its component is used, swapped or not', () => {
    const changes = [
      ...components({ nested: { symbolData: { symbolID: guid(OUTER) } } as Partial<NodeChange> }),
      record(50, 'SYMBOL', PAGE, '#'),
      instance(51, 50, '!', OUTER, {
        symbolData: { symbolID: guid(OUTER), symbolOverrides: [swapAt([NESTED], INNER)] }
      } as Partial<NodeChange>)
    ]
    const expected = {
      id: id(50),
      children: [{ id: id(51), main: id(OUTER), children: [] }]
    }

    expect(read(changes).component(50)).toEqual(expected)
    const reader = read(changes)
    reader.component(OUTER)
    expect(reader.component(50)).toEqual(expected)
  })

  test('ignores overrides addressed to the instance it left out', () => {
    const reader = read([
      ...components({ nested: { symbolData: { symbolID: guid(OUTER) } } as Partial<NodeChange> }),
      instance(OUTER_INSTANCE, PAGE, '#', OUTER, {
        symbolData: {
          symbolID: guid(OUTER),
          symbolOverrides: [{ guidPath: { guids: [guid(NESTED)] }, visible: false }]
        }
      } as Partial<NodeChange>)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(OUTER),
      children: []
    })
  })

  test('still rejects a path to an instance left out of another component', () => {
    const reader = read([
      ...components({ nested: { symbolData: { symbolID: guid(OUTER) } } as Partial<NodeChange> }),
      instance(OUTER_INSTANCE, PAGE, '#', INNER, {
        symbolData: {
          symbolID: guid(INNER),
          symbolOverrides: [{ guidPath: { guids: [guid(NESTED)] }, visible: false }]
        }
      } as Partial<NodeChange>)
    ])
    // Repairing Outer leaves its instance of itself out; Inner never held that instance.
    reader.component(OUTER)

    expect(() => reader.instance(OUTER_INSTANCE)).toThrow('1:21')
  })

  test('does not count a swap whose layer is gone as a way back', () => {
    const reader = read([
      ...components({ nested: { symbolData: { symbolID: guid(OUTER) } } as Partial<NodeChange> }),
      instance(22, OUTER, '"', INNER, {
        symbolData: { symbolID: guid(INNER), symbolOverrides: [swapAt([999], OUTER)] }
      } as Partial<NodeChange>)
    ])

    expect(reader.component(OUTER)).toEqual({
      id: id(OUTER),
      children: [{ id: id(22), main: id(INNER), children: [] }]
    })
    expect(reader.leftOut()).toEqual([id(NESTED)])
  })

  test('reads later choices again once a deeper walk left out what they swapped through', () => {
    // A holds two instances of B, and B holds an instance of A. The second instance swaps B's
    // instance of A for C, then C's layer for A. Walking B from the first leaves B's instance of
    // A out, so the second's swaps have no layer left and do not lead back.
    const [A, X, Y, B, K, C, L, LEAF] = [50, 51, 52, 60, 61, 70, 71, 80]
    const reader = read([
      record(DOCUMENT, 'DOCUMENT', undefined, ''),
      record(PAGE, 'CANVAS', DOCUMENT, '!'),
      record(A, 'SYMBOL', PAGE, '!'),
      instance(X, A, '!', B),
      instance(Y, A, '"', B, {
        symbolData: {
          symbolID: guid(B),
          symbolOverrides: [swapAt([K], C), swapAt([K, L], A)]
        }
      } as Partial<NodeChange>),
      record(B, 'SYMBOL', PAGE, '"'),
      instance(K, B, '!', A),
      record(C, 'SYMBOL', PAGE, '#'),
      instance(L, C, '!', LEAF),
      record(LEAF, 'SYMBOL', PAGE, '$')
    ])

    expect(reader.component(A)).toEqual({
      id: id(A),
      children: [
        { id: id(X), main: id(B), children: [] },
        { id: id(Y), main: id(B), children: [] }
      ]
    })
    expect(reader.leftOut()).toEqual([id(K)])
  })

  test('walks every root of a document without a document record', () => {
    const changes = [
      record(1, 'CANVAS', undefined, '!'),
      record(2, 'CANVAS', undefined, '"'),
      record(10, 'SYMBOL', 2, '!'),
      instance(11, 10, '!', 20),
      record(20, 'SYMBOL', 2, '"'),
      instance(21, 20, '!', 10)
    ]
    for (const start of [10, 20]) {
      const reader = read(changes)
      reader.component(start)
      expect(reader.leftOut()).toEqual([id(21)])
    }
  })
})

test('a page read loses the instance a read of the whole document loses', async () => {
  // The component that decides the loop is on another page, outside what the page read needs.
  const changes = components()
  for (const change of changes)
    if (change.type === 'SYMBOL')
      change.parentIndex = { guid: guid(OTHER_PAGE), position: change.parentIndex?.position ?? '!' }
  changes.push(
    record(OTHER_PAGE, 'CANVAS', DOCUMENT, '"'),
    instance(22, INNER, '!', OUTER),
    record(50, 'SYMBOL', PAGE, '!'),
    instance(51, 50, '!', OUTER),
    instance(OUTER_INSTANCE, OTHER_PAGE, '#', INNER)
  )
  const bytes = await figArchiveOf(changes)
  const open = (pageIds?: ReadonlySet<string>) => {
    const instances: string[] = []
    const { graph, componentIds } = materializeFigArchive(bytes.slice(0), {
      pageIds,
      onCyclicComponent: ({ instanceId }) => instances.push(instanceId)
    })
    const layers = (componentId: number) =>
      graph.getNode(componentIds.get(id(componentId)) ?? '')?.childIds.map((child) => {
        const main = graph.getNode(child)?.componentId
        return main ? graph.getNode(main)?.name : undefined
      })
    return {
      leftOut: [...new Set(instances)],
      inner: layers(INNER),
      outer: layers(OUTER),
      decider: componentIds.has(id(50))
    }
  }

  // Inner loses its instance of Outer; Outer keeps its instance of Inner.
  const loop = { leftOut: [id(22)], inner: [], outer: [`SYMBOL ${INNER}`] }
  expect(open(new Set([id(OTHER_PAGE)]))).toEqual({ ...loop, decider: false })
  expect(open()).toEqual({ ...loop, decider: true })
})

test("a document opened from headers finds the loop a variant's inherited swap default makes", () => {
  // The set defines Icon with a default of its own variant; the variant's copy links to it, and
  // a layer of the variant shows Icon.
  const changes = () => [
    record(DOCUMENT, 'DOCUMENT', undefined, ''),
    record(PAGE, 'CANVAS', DOCUMENT, '!'),
    record(ICON, 'SYMBOL', PAGE, '!'),
    record(5, 'FRAME', PAGE, '"', {
      isStateGroup: true,
      componentPropDefs: [
        {
          id: guid(90),
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          initialValue: { guidValue: guid(INNER) }
        }
      ]
    } as Partial<NodeChange>),
    record(INNER, 'SYMBOL', 5, '!', {
      componentPropDefs: [{ id: guid(91), parentPropDefId: guid(90) }]
    } as Partial<NodeChange>),
    instance(11, INNER, '!', ICON, {
      componentPropRefs: [{ defID: guid(91), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    } as Partial<NodeChange>)
  ]
  // As the archive reader graphs them: each record as stored, before inheritance.
  const stored = changes()
  const { sources } = createSourceIndex(stored)
  const graph = createReferenceGraph((recordId) => {
    const found = sources.get(recordId)
    return found && parentIdOf(found)
  })
  for (const change of stored) graph.add(change)
  // As a read of the whole document graphs them: inheritance applied.
  const whole = changes()
  inheritComponentPropertyDefinitions(whole, createSourceIndex(whole).sources)

  expect(graph.reaching()).toEqual(recordsReachingLoops(createSourceIndex(whole)))
  expect(graph.reaching().has(id(INNER))).toBe(true)
})
