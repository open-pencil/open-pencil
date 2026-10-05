import { describe, expect, test } from 'bun:test'

import { SceneGraph, type NodeType, type SceneNode } from '@open-pencil/scene-graph'

import { pageId } from './helpers'

// Each expectation matches a click observed in Figma desktop 126 with real pointer input.

const FILL = [{ type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]

function scene() {
  const graph = new SceneGraph()
  const page = pageId(graph)
  const add = (type: NodeType, name: string, parent: string, props: Partial<SceneNode>) =>
    graph.createNode(type, parent, { name, fills: FILL, ...props })
  const top = add('FRAME', 'Top', page, { width: 500, height: 500 })
  const nested = add('FRAME', 'Nested', top.id, { x: 50, y: 50, width: 300, height: 300 })
  const leaf = add('RECTANGLE', 'Leaf', nested.id, { x: 50, y: 50, width: 60, height: 60 })
  const deeper = add('FRAME', 'Deeper', nested.id, { x: 150, y: 150, width: 120, height: 120 })
  const deepLeaf = add('RECTANGLE', 'Deep leaf', deeper.id, { x: 20, y: 20, width: 40, height: 40 })
  const direct = add('RECTANGLE', 'Direct', top.id, { x: 400, y: 400, width: 60, height: 60 })
  const group = add('GROUP', 'Group', top.id, { x: 400, y: 50, width: 80, height: 110, fills: [] })
  const g1 = add('RECTANGLE', 'g1', group.id, { width: 40, height: 40 })
  const g2 = add('RECTANGLE', 'g2', group.id, { x: 40, y: 70, width: 40, height: 40 })
  const empty = add('FRAME', 'Empty', page, { x: 600, width: 100, height: 100 })
  const section = add('SECTION', 'Section', page, { y: 600, width: 500, height: 300 })
  const inSection = add('FRAME', 'In section', section.id, { x: 50, y: 50, width: 200, height: 200 })
  const sectionLeaf = add('RECTANGLE', 'sl', inSection.id, { x: 20, y: 20, width: 60, height: 60 })
  const component = add('COMPONENT', 'Component', page, { x: 800, width: 200, height: 200 })
  add('RECTANGLE', 'cr', component.id, { x: 20, y: 20, width: 60, height: 60 })
  return {
    graph,
    page,
    nodes: { top, nested, leaf, deeper, deepLeaf, direct, group, g1, g2, empty, inSection, sectionLeaf, component }
  }
}

/** A scene and a click on it, reporting the selected layer's name. */
function setup() {
  const built = scene()
  const click = (x: number, y: number, selected: string[] = []) =>
    built.graph.hitTestSelectable(x, y, built.page, new Set(selected))?.name ?? null
  return { ...built, click }
}

describe('hitTestSelectable', () => {
  test('selects the direct child of a top-level frame, however deep the click', () => {
    const { click } = setup()
    expect(click(130, 130)).toBe('Nested')
    expect(click(250, 250)).toBe('Nested')
    expect(click(430, 430)).toBe('Direct')
    expect(click(420, 70)).toBe('Group')
  })

  test('selects nothing in the empty part of a top-level frame or section with layers', () => {
    const { click } = setup()
    expect(click(20, 450)).toBeNull()
    expect(click(450, 850)).toBeNull()
    expect(click(200, 700)).toBeNull()
  })

  test('selects empty top-level frames and components whole', () => {
    const { click } = setup()
    expect(click(650, 50)).toBe('Empty')
    expect(click(850, 50)).toBe('Component')
  })

  test('treats a frame in a section as top-level', () => {
    const { click } = setup()
    expect(click(100, 700)).toBe('sl')
  })

  test('opens the ancestors of the selection', () => {
    const { click, nodes } = setup()
    expect(click(250, 250, [nodes.leaf.id])).toBe('Deeper')
    expect(click(130, 130, [nodes.deepLeaf.id])).toBe('Leaf')
    expect(click(460, 140, [nodes.g1.id])).toBe('g2')
    expect(click(230, 230, [nodes.deeper.id])).toBe('Deeper')
    // A container opened by the selection is selected where nothing inside it is hit.
    expect(click(330, 100, [nodes.leaf.id])).toBe('Nested')
    expect(click(20, 450, [nodes.nested.id])).toBeNull()
  })

  test('finds the open container a marquee starts in', () => {
    const { graph, page, nodes } = setup()
    expect(graph.hitTestOpenContainer(20, 450, page)?.name).toBe('Top')
    expect(graph.hitTestOpenContainer(200, 700, page)?.name).toBe('In section')
    expect(graph.hitTestOpenContainer(130, 130, page)).toBeNull()
    expect(graph.isOpenContainer(nodes.top.id)).toBe(true)
    expect(graph.isOpenContainer(nodes.empty.id)).toBe(false)
  })
})
