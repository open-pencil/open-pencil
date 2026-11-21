import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

import { parseDocument } from '../helpers/document'

const tab: PenNode = {
  id: 'tab',
  type: 'frame',
  reusable: true,
  width: 60,
  height: 30,
  fill: '#FFFFFF'
}

const tabs: PenNode = {
  id: 'tabs',
  type: 'frame',
  reusable: true,
  slot: [],
  layout: 'horizontal',
  padding: 4,
  gap: 4,
  fill: '#888888'
}

// A component that is itself a ref to another component, carrying its own children.
const bar: PenNode = {
  id: 'bar',
  type: 'ref',
  ref: 'tabs',
  reusable: true,
  x: 400,
  theme: {},
  children: [
    { id: 'first', type: 'ref', ref: 'tab' },
    { id: 'second', type: 'ref', ref: 'tab' }
  ]
}

describe('parsePenFile — components that are refs', () => {
  test('draws a use as the base component with the middle component’s children', () => {
    const graph = parseDocument([tab, tabs, bar, { id: 'use', type: 'ref', ref: 'bar' }])
    const use = getNodeOrThrow(graph, 'use')
    expect(use).toMatchObject({ layoutMode: 'HORIZONTAL', itemSpacing: 4, paddingLeft: 4 })
    expect(graph.getChildren('use').map((child) => child.componentId)).toEqual(['tab', 'tab'])
  })

  test('gives the copied children IDs of their own', () => {
    const graph = parseDocument([tab, tabs, bar, { id: 'use', type: 'ref', ref: 'bar' }])
    const ids = graph.getChildren('use').map((child) => child.id)
    expect(ids).not.toContain('first')
    expect(new Set(ids).size).toBe(2)
    expect(graph.getChildren('bar').map((child) => child.id)).toContain('first')
  })

  test('keeps the use’s own position and children over the middle component’s', () => {
    const graph = parseDocument([
      tab,
      tabs,
      bar,
      {
        id: 'use',
        type: 'ref',
        ref: 'bar',
        x: 10,
        children: [{ id: 'only', type: 'ref', ref: 'tab' }]
      }
    ])
    expect(getNodeOrThrow(graph, 'use').x).toBe(10)
    expect(graph.getChildren('use')).toHaveLength(1)
  })
})

describe('parsePenFile — overrides and copies through components that are refs', () => {
  test('keeps the middle component’s override fields under the use’s on the same path', () => {
    const row: PenNode = {
      id: 'row',
      type: 'frame',
      reusable: true,
      children: [{ id: 'cell', type: 'ref', ref: 'tab' }]
    }
    const graph = parseDocument([
      tab,
      row,
      {
        id: 'styled',
        type: 'ref',
        ref: 'row',
        reusable: true,
        descendants: { cell: { width: 90, height: 20 } }
      },
      { id: 'use', type: 'ref', ref: 'styled', descendants: { cell: { width: 70 } } }
    ])
    const [cell] = graph.getChildren('use')
    expect(cell).toMatchObject({ width: 70, height: 20 })
  })

  test('draws a middle component’s children when the base component is not a frame', () => {
    const group: PenNode = { id: 'group', type: 'group', reusable: true }
    const graph = parseDocument([
      tab,
      group,
      { id: 'pair', type: 'ref', ref: 'group', reusable: true, children: bar.children },
      { id: 'use', type: 'ref', ref: 'pair' }
    ])
    expect(graph.getChildren('use')).toHaveLength(2)
  })

  test('ends a cycle of components that are refs instead of copying without end', () => {
    const graph = parseDocument([
      { id: 'f', type: 'frame', reusable: true, width: 10, height: 10 },
      { id: 'a', type: 'ref', ref: 'b', reusable: true },
      {
        id: 'b',
        type: 'ref',
        ref: 'f',
        reusable: true,
        children: [{ id: 'c', type: 'ref', ref: 'a' }]
      },
      { id: 'use', type: 'ref', ref: 'a' }
    ])
    expect(getNodeOrThrow(graph, 'use')).toBeDefined()
    expect(graph.nodes.size).toBeLessThan(50)
  })
})

describe('parsePenFile — layers a component that is a ref puts in', () => {
  const dialog: PenNode = {
    id: 'dialog',
    type: 'frame',
    reusable: true,
    children: [{ id: 'body', type: 'frame', width: 10, height: 10 }]
  }
  // A component that is a ref, replacing its base's body with a layer of its own.
  const form: PenNode = {
    id: 'form',
    type: 'ref',
    ref: 'dialog',
    reusable: true,
    descendants: {
      body: {
        id: 'fields',
        type: 'frame',
        children: [{ id: 'field', type: 'frame', width: 20, height: 20 }]
      }
    }
  }

  test('gives each use its own copy of the layer instead of sharing its ID', () => {
    const graph = parseDocument([
      dialog,
      form,
      { id: 'one', type: 'ref', ref: 'form' },
      { id: 'two', type: 'ref', ref: 'form' }
    ])
    const parents = new Map<string, string[]>()
    for (const node of graph.nodes.values()) {
      for (const child of node.childIds)
        parents.set(child, [...(parents.get(child) ?? []), node.id])
    }
    expect([...parents.values()].filter((list) => list.length > 1)).toEqual([])
    expect(graph.getChildren('one')).toHaveLength(1)
    expect(graph.getChildren('two')).toHaveLength(1)
  })

  test('applies a use’s override keyed by the layer’s own ID', () => {
    const graph = parseDocument([
      dialog,
      form,
      { id: 'use', type: 'ref', ref: 'form', descendants: { fields: { opacity: 0.5 } } }
    ])
    expect(graph.getChildren('use')[0]?.opacity).toBe(0.5)
  })
})

describe('parsePenFile — uses of components that are not frames', () => {
  const group: PenNode = {
    id: 'group',
    type: 'group',
    reusable: true,
    children: [{ id: 'label', type: 'text', content: 'Base' }]
  }

  test('gives the copies a middle component’s overrides', () => {
    const graph = parseDocument([
      group,
      {
        id: 'middle',
        type: 'ref',
        ref: 'group',
        reusable: true,
        descendants: { label: { content: 'Middle' } }
      },
      { id: 'use', type: 'ref', ref: 'middle' }
    ])
    expect(graph.getChildren('use')[0]?.text).toBe('Middle')
  })

  test('ends a cycle that runs through a plain copy of a group', () => {
    const graph = parseDocument([
      {
        id: 'g',
        type: 'group',
        reusable: true,
        children: [{ id: 'r', type: 'ref', ref: 'm' }]
      },
      { id: 'f', type: 'frame', reusable: true, width: 10, height: 10 },
      {
        id: 'm',
        type: 'ref',
        ref: 'f',
        reusable: true,
        children: [{ id: 'c', type: 'ref', ref: 'g' }]
      },
      { id: 'use', type: 'ref', ref: 'g' }
    ])
    expect(graph.nodes.size).toBeLessThan(50)
  })

  test('ends a ring of components that are refs longer than the depth limit', () => {
    const ring: PenNode[] = Array.from({ length: 17 }, (_, index) => ({
      id: `r${index}`,
      type: 'ref',
      ref: `r${(index + 1) % 17}`,
      reusable: true,
      children: [{ id: `c${index}`, type: 'ref', ref: `r${(index + 2) % 17}` }]
    }))
    const graph = parseDocument([...ring, { id: 'use', type: 'ref', ref: 'r0' }])
    expect(graph.nodes.size).toBeLessThan(2000)
  })
})

describe('parsePenFile — overrides on copies of components that are refs', () => {
  const card: PenNode = {
    id: 'card',
    type: 'frame',
    reusable: true,
    children: [{ id: 'slot', type: 'frame', width: 10, height: 10 }]
  }

  test('gives each use its own copies of children a property override puts in', () => {
    const graph = parseDocument([
      card,
      {
        id: 'filled',
        type: 'ref',
        ref: 'card',
        reusable: true,
        descendants: { slot: { children: [{ id: 'item', type: 'frame', width: 5, height: 5 }] } }
      },
      { id: 'one', type: 'ref', ref: 'filled' },
      { id: 'two', type: 'ref', ref: 'filled' }
    ])
    const parents = new Map<string, number>()
    for (const node of graph.nodes.values()) {
      for (const child of node.childIds) parents.set(child, (parents.get(child) ?? 0) + 1)
    }
    expect([...parents.values()].filter((count) => count > 1)).toEqual([])
  })

  const badge: PenNode = {
    id: 'badge',
    type: 'frame',
    reusable: true,
    children: [{ id: 'text', type: 'text', content: 'Badge', fontSize: 10 }]
  }

  test('merges a use’s nested override into the one its copy already carries', () => {
    const graph = parseDocument([
      badge,
      {
        id: 'group',
        type: 'group',
        reusable: true,
        children: [
          { id: 'inner', type: 'ref', ref: 'badge', descendants: { text: { content: 'Group' } } }
        ]
      },
      { id: 'use', type: 'ref', ref: 'group', descendants: { 'inner/text': { fontSize: 20 } } }
    ])
    const [inner] = graph.getChildren('use')
    const text = inner && graph.getChildren(inner.id)[0]
    expect(text).toMatchObject({ text: 'Group', fontSize: 20 })
  })

  test('ends a loop through a layer an override puts in', () => {
    const graph = parseDocument([
      { id: 'g', type: 'group', reusable: true, children: [{ id: 'spot', type: 'frame' }] },
      {
        id: 'm',
        type: 'ref',
        ref: 'g',
        reusable: true,
        descendants: { spot: { id: 'loop', type: 'ref', ref: 'm' } }
      },
      { id: 'use', type: 'ref', ref: 'm' }
    ])
    expect(graph.nodes.size).toBeLessThan(50)
  })
})
