import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

// Recorded with the same script in Figma desktop 126: children of groups report positions in their
// container's space, and groups refit whenever a script moves, resizes, adds, or removes a child.

function setup() {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  frame.resize(800, 800)
  frame.x = 1000
  const rect = (x: number, y: number) => {
    const node = figma.createRectangle()
    node.resize(60, 60)
    frame.appendChild(node)
    node.x = x
    node.y = y
    return node
  }
  const a = rect(100, 100)
  const b = rect(200, 200)
  const group = figma.group([a, b], frame)
  return { figma, frame, group, a, b, rect }
}

const box = (node: Rect) => [node.x, node.y, node.width, node.height]

describe('group children in the plugin API', () => {
  test('report positions and transforms in the container', () => {
    const { group, a } = setup()
    expect(box(group)).toEqual([100, 100, 160, 160])
    expect([a.x, a.y]).toEqual([100, 100])
    expect(a.relativeTransform).toEqual([
      [1, 0, 100],
      [0, 1, 100]
    ])
  })

  test('refit the group when a child moves or resizes', () => {
    const { group, a, b } = setup()
    a.x = 50
    expect(box(group)).toEqual([50, 100, 210, 160])
    expect([a.x, a.y, b.x, b.y]).toEqual([50, 100, 200, 200])
    b.resize(100, 60)
    expect(box(group)).toEqual([50, 100, 250, 160])
  })

  test('moving the group moves its children', () => {
    const { group, a, b } = setup()
    group.x = 300
    expect([a.x, a.y, b.x, b.y]).toEqual([300, 100, 400, 200])
  })

  test('nested groups report through every level', () => {
    const { figma, group, b } = setup()
    const inner = figma.group([b], group)
    expect([inner.x, inner.y, inner.width]).toEqual([200, 200, 60])
    expect([b.x, b.y]).toEqual([200, 200])
  })

  test('adding, removing, and taking out children refit the group, and an emptied group goes', () => {
    const { frame, group, a, b, rect } = setup()
    const c = rect(500, 500)
    group.appendChild(c)
    expect(box(group)).toEqual([100, 100, 460, 460])
    expect([c.x, c.y]).toEqual([500, 500])
    frame.appendChild(c)
    expect(box(group)).toEqual([100, 100, 160, 160])
    b.remove()
    expect(box(group)).toEqual([100, 100, 60, 60])
    a.remove()
    expect(group.removed).toBe(true)
  })
})

// Recorded in Figma desktop 126 on the page: a group spans only the layers it shows.
describe('hidden group children in the plugin API', () => {
  function pageRects(...boxes: Array<[number, number, number, number]>) {
    const figma = new FigmaAPI(new SceneGraph())
    const nodes = boxes.map(([x, y, width, height]) => {
      const node = figma.createRectangle()
      node.resize(width, height)
      node.x = x
      node.y = y
      return node
    })
    return { figma, nodes }
  }

  test('hiding and showing a child refits the group; with none shown it is empty in place', () => {
    const { figma, nodes } = pageRects([200, 200, 50, 50], [300, 300, 30, 30])
    const [a, b] = nodes
    const group = figma.group(nodes, figma.currentPage)
    a.visible = false
    expect(box(group)).toEqual([300, 300, 30, 30])
    b.visible = false
    expect(box(group)).toEqual([300, 300, 0, 0])
    expect([box(a), box(b)]).toEqual([
      [200, 200, 50, 50],
      [300, 300, 30, 30]
    ])
    a.visible = true
    expect(box(group)).toEqual([200, 200, 50, 50])
  })

  test('a hidden child of a nested group leaves both groups', () => {
    const { figma, nodes } = pageRects([0, 0, 50, 50], [100, 100, 30, 30], [200, 0, 10, 10])
    const [a, b, c] = nodes
    const inner = figma.group([a, b], figma.currentPage)
    const outer = figma.group([inner, c], figma.currentPage)
    b.visible = false
    expect(box(inner)).toEqual([0, 0, 50, 50])
    expect(box(outer)).toEqual([0, 0, 210, 50])
    inner.visible = false
    expect(box(outer)).toEqual([200, 0, 10, 10])
  })

  test('a hidden mask stops limiting the group', () => {
    const { figma, nodes } = pageRects([0, 0, 40, 40], [20, 20, 100, 100])
    const [mask] = nodes
    const group = figma.group(nodes, figma.currentPage)
    mask.isMask = true
    expect(box(group)).toEqual([0, 0, 40, 40])
    mask.visible = false
    expect(box(group)).toEqual([20, 20, 100, 100])
  })

  test('grouping spans the shown layers, or none at the origin', () => {
    const { figma, nodes } = pageRects([500, 500, 50, 50], [600, 600, 30, 30])
    nodes[0].visible = false
    expect(box(figma.group(nodes, figma.currentPage))).toEqual([600, 600, 30, 30])

    const hidden = pageRects([500, 500, 50, 50], [600, 600, 30, 30])
    for (const node of hidden.nodes) node.visible = false
    expect(box(hidden.figma.group(hidden.nodes, hidden.figma.currentPage))).toEqual([0, 0, 0, 0])
  })
})
