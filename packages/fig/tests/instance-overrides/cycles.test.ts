import { describe, expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { materializeFigArchive } from '#fig/document/materialize'
import { createOccurrenceInterpreter } from '#fig/instance-overrides/interpret'
import type { InstanceOccurrence } from '#fig/instance-overrides/occurrence/types'

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
  const options = {
    onCyclicComponent: ({ instanceId }: { instanceId: string }) => leftOut.push(instanceId)
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
  const leftOut = (pageIds?: ReadonlySet<string>) => {
    const instances: string[] = []
    materializeFigArchive(bytes.slice(0), {
      pageIds,
      onCyclicComponent: ({ instanceId }) => instances.push(instanceId)
    })
    return [...new Set(instances)]
  }

  expect(leftOut(new Set([id(OTHER_PAGE)]))).toEqual([id(22)])
  expect(leftOut()).toEqual([id(22)])
})
