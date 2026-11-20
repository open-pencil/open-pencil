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
