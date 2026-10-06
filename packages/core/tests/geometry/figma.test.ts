import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  panelPosition,
  panelPositionChange,
  panelRotation,
  panelRotationChange
} from '@open-pencil/core/geometry'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

// Recorded in Figma desktop 126 by reading and typing into the properties panel's X, Y, and
// rotation fields for layers a script made.

const round = (value: number) => Math.round(value * 1000) / 1000

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const rect = (rotation = 0) => {
    const node = figma.createRectangle()
    node.x = 100
    node.y = 100
    node.resize(100, 50)
    node.rotation = rotation
    return node
  }
  const raw = (id: string): SceneNode => {
    const node = graph.getNode(id)
    if (!node) throw new Error(`Missing ${id}`)
    return node
  }
  const shown = (id: string) => {
    const { x, y } = panelPosition(raw(id), graph)
    return [round(x), round(y), round(panelRotation(raw(id), graph))]
  }
  return { graph, figma, rect, raw, shown }
}

describe('properties panel position and rotation', () => {
  test('X and Y are the top-left of the turned layer’s box, rotation counterclockwise', () => {
    const { rect, shown } = setup()
    expect(shown(rect().id)).toEqual([100, 100, 0])
    expect(shown(rect(30).id)).toEqual([100, 50, 30])
    expect(shown(rect(-30).id)).toEqual([75, 100, -30])
  })

  test('a horizontal flip reads as 180°', () => {
    const { figma, shown } = setup()
    const node = figma.createRectangle()
    node.resize(100, 50)
    node.relativeTransform = [
      [-1, 0, 200],
      [0, 1, 100]
    ]
    expect(shown(node.id)).toEqual([100, 100, 180])
  })

  test('inside groups and turned frames, positions are measured from the container’s box', () => {
    const { figma, shown } = setup()
    const frame = figma.createFrame()
    frame.x = 500
    frame.y = 40
    frame.resize(300, 300)
    const inner = figma.createRectangle()
    frame.appendChild(inner)
    inner.x = 30
    inner.y = 60
    inner.resize(40, 20)
    const other = figma.createRectangle()
    frame.appendChild(other)
    other.x = 120
    other.y = 80
    const group = figma.group([inner, other], frame)
    expect(shown(inner.id)).toEqual([30, 60, 0])
    expect(shown(group.id)).toEqual([30, 60, 0])

    const turned = figma.createFrame()
    turned.x = 900
    turned.y = 40
    turned.resize(200, 200)
    turned.rotation = 90
    const child = figma.createRectangle()
    turned.appendChild(child)
    child.x = 10
    child.y = 20
    child.resize(40, 20)
    expect(shown(child.id)).toEqual([20, 150, 90])
  })

  test('typing a rotation turns the layer about its center, typing X or Y moves its box', () => {
    const { graph, rect, raw, shown } = setup()
    const { id } = rect()
    const apply = (changes: Partial<SceneNode>) => graph.updateNode(id, changes)

    apply(panelRotationChange(raw(id), graph, 30))
    expect(shown(id)).toEqual([94.199, 78.349, 30])
    apply(panelPositionChange(raw(id), graph, 'x', 0))
    expect(shown(id)).toEqual([0, 78.349, 30])
    apply(panelPositionChange(raw(id), graph, 'y', 0))
    expect(shown(id)).toEqual([0, 0, 30])
    apply(panelRotationChange(raw(id), graph, -45))
    expect(shown(id)).toEqual([2.768, -6.382, -45])
  })
})
