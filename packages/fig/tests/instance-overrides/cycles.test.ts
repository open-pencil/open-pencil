import { describe, expect, test } from 'bun:test'

import {
  PAGE,
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
  read
} from '#fig-tests/helpers/component-loops'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

// Each case is a set of records Figma was given by paste, and each expectation is the layers
// Figma kept: it leaves out an instance whose component would contain itself, choosing it by

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
