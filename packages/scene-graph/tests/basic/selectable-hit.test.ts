import { describe, expect, test } from 'bun:test'

import { SceneGraph, type NodeType, type SceneNode } from '@open-pencil/scene-graph'

import { pageId } from './helpers'

// Each expectation matches a click observed in Figma desktop 126 with real pointer input.

const FILL = [
  { type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
]

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
  const inSection = add('FRAME', 'In section', section.id, {
    x: 50,
    y: 50,
    width: 200,
    height: 200
  })
  const sectionLeaf = add('RECTANGLE', 'sl', inSection.id, { x: 20, y: 20, width: 60, height: 60 })
  const component = add('COMPONENT', 'Component', page, { x: 800, width: 200, height: 200 })
  add('RECTANGLE', 'cr', component.id, { x: 20, y: 20, width: 60, height: 60 })
  const card = add('FRAME', 'Card', page, {
    x: 1100,
    width: 300,
    height: 400,
    layoutMode: 'VERTICAL'
  })
  const cardTitle = add('RECTANGLE', 'Card title', card.id, {
    x: 20,
    y: 20,
    width: 260,
    height: 40
  })
  const cardBody = add('FRAME', 'Card body', card.id, { x: 20, y: 80, width: 260, height: 200 })
  add('RECTANGLE', 'Card body leaf', cardBody.id, { x: 20, y: 20, width: 60, height: 60 })
  const grid = add('FRAME', 'Grid', page, {
    x: 1500,
    width: 200,
    height: 200,
    layoutMode: 'GRID',
    fills: []
  })
  add('RECTANGLE', 'Cell', grid.id, { x: 10, y: 10, width: 60, height: 60 })
  const sectionCard = add('FRAME', 'Section card', section.id, {
    x: 300,
    y: 20,
    width: 150,
    height: 150,
    layoutMode: 'HORIZONTAL'
  })
  add('RECTANGLE', 'sc', sectionCard.id, { x: 20, y: 20, width: 40, height: 40 })
  return {
    graph,
    page,
    nodes: {
      top,
      nested,
      leaf,
      deeper,
      deepLeaf,
      direct,
      group,
      g1,
      g2,
      empty,
      inSection,
      sectionLeaf,
      component,
      card,
      cardTitle,
      cardBody
    }
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

  test('selects a top-level auto-layout frame by its empty area', () => {
    const { click, nodes } = setup()
    expect(click(1120, 350)).toBe('Card')
    expect(click(1110, 70)).toBe('Card')
    expect(click(1550, 150)).toBe('Grid')
    expect(click(1150, 30)).toBe('Card title')
    expect(click(1130, 110)).toBe('Card body')
    expect(click(1110, 70, [nodes.card.id])).toBe('Card')
    expect(click(1150, 30, [nodes.card.id])).toBe('Card title')
    expect(click(1120, 350, [nodes.cardTitle.id])).toBe('Card')
  })

  test('selects an auto-layout frame in a section by its empty area', () => {
    const { click } = setup()
    expect(click(420, 750)).toBe('Section card')
    expect(click(330, 650)).toBe('sc')
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
    // A container opened by the selection is selected where nothing inside it is hit.
    expect(click(330, 100, [nodes.leaf.id])).toBe('Nested')
    expect(click(20, 450, [nodes.nested.id])).toBeNull()
  })

  test('opens a selected container, so repeated clicks reach deeper layers', () => {
    const { click, nodes } = setup()
    expect(click(230, 230)).toBe('Nested')
    expect(click(230, 230, [nodes.nested.id])).toBe('Deeper')
    expect(click(230, 230, [nodes.deeper.id])).toBe('Deep leaf')
    // Its empty area keeps it selected.
    expect(click(300, 300, [nodes.deeper.id])).toBe('Deeper')
    // A selected group stays closed.
    expect(click(420, 70, [nodes.group.id])).toBe('Group')
  })

  test('finds the open container a marquee starts in', () => {
    const { graph, page, nodes } = setup()
    expect(graph.hitTestOpenContainer(20, 450, page)?.name).toBe('Top')
    expect(graph.hitTestOpenContainer(200, 700, page)?.name).toBe('In section')
    expect(graph.hitTestOpenContainer(130, 130, page)).toBeNull()
    // Dragging the empty area of an auto-layout frame moves it instead of starting a marquee.
    expect(graph.hitTestOpenContainer(1120, 350, page)).toBeNull()
    expect(graph.hitTestOpenContainer(420, 750, page)).toBeNull()
    expect(graph.isOpenContainer(nodes.top.id)).toBe(true)
    expect(graph.isOpenContainer(nodes.empty.id)).toBe(false)
  })
})

describe('unfilled frames inside a top-level frame', () => {
  /** A card, with or without auto layout, holding an unfilled auto layout row and plain box. */
  function cards() {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const add = (type: NodeType, name: string, parent: string, props: Partial<SceneNode>) =>
      graph.createNode(type, parent, { name, fills: FILL, ...props })
    for (const [x, layoutMode] of [
      [0, 'VERTICAL'],
      [400, 'NONE']
    ] as const) {
      const card = add('FRAME', `${layoutMode} card`, page, {
        x,
        width: 320,
        height: 360,
        layoutMode
      })
      const row = add('FRAME', `${layoutMode} row`, card.id, {
        x: 24,
        y: 24,
        width: 272,
        height: 100,
        fills: [],
        layoutMode: 'HORIZONTAL'
      })
      add('RECTANGLE', 'Chip', row.id, { x: 30, y: 30, width: 40, height: 40 })
      const box = add('FRAME', `${layoutMode} box`, card.id, {
        x: 24,
        y: 148,
        width: 272,
        height: 100,
        fills: []
      })
      add('RECTANGLE', 'Dot', box.id, { x: 30, y: 30, width: 40, height: 40 })
    }
    const section = add('SECTION', 'Section', page, { y: 600, width: 500, height: 400 })
    const board = add('FRAME', 'Board', section.id, {
      x: 50,
      y: 50,
      width: 300,
      height: 300,
      fills: []
    })
    add('RECTANGLE', 'Board leaf', board.id, { x: 20, y: 20, width: 60, height: 60 })
    add('FRAME', 'Empty in section', section.id, {
      x: 380,
      y: 50,
      width: 100,
      height: 100,
      fills: []
    })
    add('FRAME', 'Empty on page', page, { x: 800, width: 100, height: 100, fills: [] })
    const click = (x: number, y: number) =>
      graph.hitTestSelectable(x, y, page, new Set())?.name ?? null
    const deep = (x: number, y: number) => graph.hitTestDeep(x, y)?.name ?? null
    return { click, deep }
  }

  test('a click selects them by their empty area, with or without auto layout', () => {
    const { click } = cards()
    expect(click(224, 74)).toBe('VERTICAL row')
    expect(click(224, 198)).toBe('VERTICAL box')
    expect(click(624, 74)).toBe('NONE row')
    expect(click(624, 198)).toBe('NONE box')
  })

  test('a deep click looks through their empty area to the card', () => {
    const { deep } = cards()
    expect(deep(224, 74)).toBe('VERTICAL card')
    expect(deep(224, 198)).toBe('VERTICAL card')
    expect(deep(624, 74)).toBe('NONE card')
    expect(deep(624, 198)).toBe('NONE card')
  })

  test('the empty area of an unfilled board in a section stays background', () => {
    const { click } = cards()
    expect(click(250, 900)).toBeNull()
  })

  test('a click selects an empty unfilled frame on the page or in a section', () => {
    const { click } = cards()
    expect(click(850, 50)).toBe('Empty on page')
    expect(click(430, 700)).toBe('Empty in section')
  })
})

describe('a click just outside a shape', () => {
  // Figma desktop 126 takes a click up to 3.5 screen pixels outside any shape, at every zoom,
  // whatever its size; the caller gives that distance in canvas units.
  test('selects the shape within the pad, and nothing beyond it', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const dot = graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 100,
      width: 6,
      height: 6,
      fills: FILL
    })
    const line = graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 200,
      width: 100,
      height: 1,
      fills: FILL
    })
    const hit = (x: number, y: number, zoom: number) =>
      graph.hitTestSelectable(x, y, page, new Set(), { pad: 3.5 / zoom })?.name ?? null
    for (const zoom of [0.5, 1, 4]) {
      const inside = 3.4 / zoom
      const outside = 3.6 / zoom
      expect([hit(106 + inside, 103, zoom), hit(106 + outside, 103, zoom)]).toEqual([
        dot.name,
        null
      ])
      expect([hit(150, 201 + inside, zoom), hit(150, 201 + outside, zoom)]).toEqual([
        line.name,
        null
      ])
    }
  })

  test('a group’s empty area takes no click, so a layer under the group shows through', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const line = graph.createNode('RECTANGLE', page, {
      name: 'Line',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      fills: FILL
    })
    const group = graph.createNode('GROUP', page, { name: 'Dots', x: 150, y: 150, width: 300, height: 200 })
    graph.createNode('ELLIPSE', group.id, { name: 'Dot', width: 20, height: 20, fills: FILL })
    expect(graph.hitTestSelectable(160, 160, page, new Set())?.name).toBe('Dots')
    expect(graph.hitTestSelectable(300, 250, page, new Set())?.id).toBe(line.id)
    expect(graph.hitTestDeep(300, 250, page)?.id).toBe(line.id)
    graph.updateNode(line.id, { visible: false })
    expect(graph.hitTestSelectable(300, 250, page, new Set())).toBeNull()
  })

  test('reaches a shape at its group’s edge, and the group only through its shapes', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const group = graph.createNode('GROUP', page, {
      name: 'Group',
      x: 100,
      y: 100,
      width: 50,
      height: 50
    })
    graph.createNode('RECTANGLE', group.id, { name: 'Box', width: 50, height: 50, fills: FILL })
    expect(graph.hitTestSelectable(152, 120, page, new Set(), { pad: 3.5 })?.name).toBe('Group')
    expect(graph.hitTestDeep(152, 120, page, 3.5)?.name).toBe('Box')
    expect(graph.hitTestSelectable(155, 120, page, new Set(), { pad: 3.5 })).toBeNull()
  })

  test('leaves a frame’s edge exact, so the page around it starts a marquee', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('FRAME', page, { name: 'Empty', width: 100, height: 100, fills: FILL })
    expect(graph.hitTestSelectable(102, 50, page, new Set(), { pad: 3.5 })).toBeNull()
  })

  // FigJam board, Figma desktop: a click on a layer inside a frame selects the frame.
  test('selects a top-level frame whole when frames stay closed, as on a board', () => {
    const { graph, page } = scene()
    const click = (framesOpen: boolean) =>
      graph.hitTestSelectable(170, 170, page, new Set(), { framesOpen })?.name ?? null
    // In a design the click looks into the top-level frame and takes the frame inside it.
    expect([click(true), click(false)]).toEqual(['Nested', 'Top'])
    // Selected, it stays closed: another click inside keeps the frame.
    const top = [...graph.nodes.values()].find((node) => node.name === 'Top')
    if (!top) throw new Error('Missing Top')
    expect(graph.hitTestSelectable(170, 170, page, new Set([top.id]), { framesOpen: false })?.name).toBe('Top')
    // Entered by a double-click, it is open from the page: the click reaches the frame inside.
    const entered = { framesOpen: false, enteredId: top.id }
    expect(graph.hitTestSelectable(170, 170, page, new Set(), entered)?.name).toBe('Nested')
    // A click outside the entered frame still lands as a click from nothing does.
    expect(graph.hitTestSelectable(850, 50, page, new Set(), entered)?.name).toBe('Component')
  })
})
