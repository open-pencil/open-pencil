import { describe, expect, test } from 'bun:test'

import {
  DOCUMENT,
  PAGE,
  OTHER_PAGE,
  INNER,
  OUTER,
  NESTED,
  OUTER_INSTANCE,
  ICON,
  guid,
  id,
  record,
  instance,
  components,
  read,
  swapAt
} from '#fig-tests/helpers/component-loops'
import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { materializeFigArchive } from '#fig/document/materialize'
import { inheritComponentPropertyDefinitions } from '#fig/document/property-inheritance'
import { createReferenceGraph, loopReferences } from '#fig/instance-overrides/loops/references'
import { createSourceIndex, parentIdOf } from '#fig/instance-overrides/source-index'
import { DEFAULT_SLOT_CONTENT } from '#fig/instance-overrides/types'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

// How the repair walks a document's definitions, which every read and save must agree with. The
// walk is the one measured in Figma; cases Figma's editor cannot produce, such as a component
// defined inside another, follow the same walk.

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

  test('walks a component defined inside another where it lies', () => {
    // Outer defines Inner among its layers, and Inner holds an instance of Outer.
    const reader = read([
      record(DOCUMENT, 'DOCUMENT', undefined, ''),
      record(PAGE, 'CANVAS', DOCUMENT, '!'),
      record(OUTER, 'SYMBOL', PAGE, '!'),
      record(INNER, 'SYMBOL', OUTER, '!'),
      instance(NESTED, INNER, '!', OUTER),
      instance(OUTER_INSTANCE, PAGE, '"', INNER)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(INNER),
      children: []
    })
    expect(reader.leftOut()).toEqual([id(NESTED)])
  })

  test('leaves out the instance, not the component, when a walk reaches the nesting late', () => {
    // A component placed first holds an instance of Inner, so the walk enters Inner before the
    // Outer that defines it; Inner's instance of Outer still closes the loop.
    const FIRST = 50
    const reader = read([
      record(DOCUMENT, 'DOCUMENT', undefined, ''),
      record(PAGE, 'CANVAS', DOCUMENT, '!'),
      record(FIRST, 'SYMBOL', PAGE, '!'),
      instance(51, FIRST, '!', INNER),
      record(OUTER, 'SYMBOL', PAGE, '"'),
      record(INNER, 'SYMBOL', OUTER, '!'),
      instance(NESTED, INNER, '!', OUTER)
    ])

    expect(reader.component(OUTER)).toEqual({
      id: id(OUTER),
      children: [{ id: id(INNER), children: [] }]
    })
    expect(reader.leftOut()).toEqual([id(NESTED)])
  })

  test('ignores an override that reaches the left-out instance through a frame', () => {
    const FRAME = 60
    const reader = read([
      record(DOCUMENT, 'DOCUMENT', undefined, ''),
      record(PAGE, 'CANVAS', DOCUMENT, '!'),
      record(OUTER, 'SYMBOL', PAGE, '!'),
      record(FRAME, 'FRAME', OUTER, '!'),
      instance(NESTED, FRAME, '!', OUTER),
      instance(OUTER_INSTANCE, PAGE, '"', OUTER, {
        symbolData: {
          symbolID: guid(OUTER),
          symbolOverrides: [{ guidPath: { guids: [guid(FRAME), guid(NESTED)] }, visible: false }]
        }
      } as Partial<NodeChange>)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(OUTER),
      children: [{ id: id(FRAME), children: [] }]
    })
  })

  test('ignores an override that reaches the left-out instance through slot content', () => {
    // Outer holds a frame with an instance of Outer in it, and a placed card assigns that frame
    // to its slot; an override on the card addresses the instance the repair leaves out. The
    // slot's binding is written as a read prepares it, as a property reference.
    const [CARD, SLOT, SLOT_PROPERTY, CONTENT] = [3, 4, 5, 60]
    const slotValue = (target: GUID) => ({
      value: { slotContentIdValue: { guid: target } },
      dataType: 'SLOT_CONTENT_ID',
      resolvedDataType: 'SLOT_CONTENT_ID'
    })
    const reader = read([
      record(DOCUMENT, 'DOCUMENT', undefined, ''),
      record(PAGE, 'CANVAS', DOCUMENT, '!'),
      record(CARD, 'SYMBOL', PAGE, '!', {
        componentPropDefs: [
          {
            id: guid(SLOT_PROPERTY),
            name: 'Content',
            type: 'SLOT',
            varValue: slotValue(DEFAULT_SLOT_CONTENT)
          }
        ]
      } as Partial<NodeChange>),
      record(SLOT, 'FRAME', CARD, '!', {
        componentPropRefs: [
          { defID: guid(SLOT_PROPERTY), componentPropNodeField: 'SLOT_CONTENT_ID' }
        ]
      } as Partial<NodeChange>),
      record(OUTER, 'SYMBOL', PAGE, '"'),
      record(CONTENT, 'FRAME', OUTER, '!'),
      instance(NESTED, CONTENT, '!', OUTER),
      record(61, 'RECTANGLE', CONTENT, '"'),
      instance(OUTER_INSTANCE, PAGE, '#', CARD, {
        symbolData: {
          symbolID: guid(CARD),
          symbolOverrides: [{ guidPath: { guids: [guid(NESTED)] }, visible: false }]
        },
        componentPropAssignments: [
          { defID: guid(SLOT_PROPERTY), varValue: slotValue(guid(CONTENT)) }
        ]
      } as Partial<NodeChange>)
    ])
    reader.component(OUTER)

    expect(reader.instance(OUTER_INSTANCE)).toEqual({
      id: id(OUTER_INSTANCE),
      main: id(CARD),
      children: [{ id: id(SLOT), children: [{ id: id(61), children: [] }] }]
    })
    expect(reader.leftOut()).toEqual([id(NESTED)])
  })

  test('leaves out the instance whose slot content leads back into its component', () => {
    // Measured in Figma: Outer holds a Card whose assigned slot content holds an instance of
    // Outer. Figma deletes the Card instance, not the instance inside the content, and keeps an
    // Outer instance in the slot of a Card placed outside Outer.
    const [CARD, SLOT, SLOT_PROPERTY, INTERNAL, CONTENT, OUTSIDE, OUTSIDE_CONTENT] = [
      3, 4, 5, 6, 60, 70, 71
    ]
    const slotValue = (target: GUID) => ({
      value: { slotContentIdValue: { guid: target } },
      dataType: 'SLOT_CONTENT_ID',
      resolvedDataType: 'SLOT_CONTENT_ID'
    })
    const assignSlot = (content: number) =>
      ({
        componentPropAssignments: [
          { defID: guid(SLOT_PROPERTY), varValue: slotValue(guid(content)) }
        ]
      }) as Partial<NodeChange>
    const reader = read([
      record(DOCUMENT, 'DOCUMENT', undefined, ''),
      record(PAGE, 'CANVAS', DOCUMENT, '!'),
      record(INTERNAL, 'CANVAS', DOCUMENT, '"'),
      record(CARD, 'SYMBOL', PAGE, '!', {
        componentPropDefs: [
          {
            id: guid(SLOT_PROPERTY),
            name: 'Content',
            type: 'SLOT',
            varValue: slotValue(DEFAULT_SLOT_CONTENT)
          }
        ]
      } as Partial<NodeChange>),
      record(SLOT, 'FRAME', CARD, '!', {
        componentPropRefs: [
          { defID: guid(SLOT_PROPERTY), componentPropNodeField: 'SLOT_CONTENT_ID' }
        ]
      } as Partial<NodeChange>),
      record(OUTER, 'SYMBOL', PAGE, '"'),
      instance(NESTED, OUTER, '!', CARD, assignSlot(CONTENT)),
      record(CONTENT, 'FRAME', INTERNAL, '!'),
      record(61, 'ELLIPSE', CONTENT, '!'),
      instance(62, CONTENT, '"', OUTER),
      instance(OUTSIDE, PAGE, '#', CARD, assignSlot(OUTSIDE_CONTENT)),
      record(OUTSIDE_CONTENT, 'FRAME', INTERNAL, '"'),
      instance(72, OUTSIDE_CONTENT, '!', OUTER)
    ])

    expect(reader.component(OUTER)).toEqual({ id: id(OUTER), children: [] })
    expect(reader.instance(OUTSIDE)).toEqual({
      id: id(OUTSIDE),
      main: id(CARD),
      children: [{ id: id(SLOT), children: [{ id: id(72), main: id(OUTER), children: [] }] }]
    })
    expect(reader.leftOut()).toEqual([id(NESTED)])
  })

  test('reads an instance whose base was left out as one whose base is gone', () => {
    // Outer holds an instance of itself, which a placement also uses as its base. Saving the
    // repair deletes that record, so the first read already treats it as missing.
    const reader = read([
      ...components({ nested: { symbolData: { symbolID: guid(OUTER) } } as Partial<NodeChange> }),
      instance(OUTER_INSTANCE, PAGE, '#', NESTED)
    ])

    expect(reader.instance(OUTER_INSTANCE)).toEqual({ id: id(OUTER_INSTANCE), children: [] })
    expect(reader.leftOut()).toEqual([id(NESTED)])
    expect(reader.missing()).toEqual([`${id(OUTER_INSTANCE)} -> ${id(NESTED)}`])
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

  expect(graph.reaching()).toEqual(new Set(loopReferences(createSourceIndex(whole)).reaching))
  expect(graph.reaching().has(id(INNER))).toBe(true)
})
