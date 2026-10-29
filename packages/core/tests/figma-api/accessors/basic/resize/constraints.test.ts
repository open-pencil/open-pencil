import { expect, test } from 'bun:test'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'

// Recorded with the same script in Figma desktop 126.

function setup(kind: 'frame' | 'component', graph = new SceneGraph()) {
  const figma = new FigmaAPI(graph)
  const host = kind === 'component' ? figma.createComponent() : figma.createFrame()
  host.resize(100, 100)
  for (const [name, constraint] of [
    ['max', 'MAX'],
    ['stretch', 'STRETCH'],
    ['scale', 'SCALE']
  ] as const) {
    const layer = figma.createRectangle()
    layer.name = name
    host.appendChild(layer)
    layer.x = 10
    layer.y = 10
    layer.resize(30, 30)
    layer.constraints = { horizontal: constraint, vertical: constraint }
  }
  return host
}

const places = (node: FigmaNodeProxy) =>
  (node.children as FigmaNodeProxy[]).map((child) => [
    child.name,
    child.x,
    child.y,
    child.width,
    child.height
  ])

const CONSTRAINED = [
  ['max', 110, 60, 30, 30],
  ['stretch', 10, 10, 130, 80],
  ['scale', 20, 15, 60, 45]
]

test('resize places a frame’s layers by their constraints; resizeWithoutConstraints does not', () => {
  const frame = setup('frame')
  frame.resize(200, 150)
  expect(places(frame)).toEqual(CONSTRAINED)
  const still = setup('frame')
  still.resizeWithoutConstraints(200, 150)
  expect(places(still).map(([, ...rect]) => rect)).toEqual([
    [10, 10, 30, 30],
    [10, 10, 30, 30],
    [10, 10, 30, 30]
  ])
})

test('an instance’s layers follow their constraints either way, claiming only its own size', () => {
  const graph = new SceneGraph()
  const component = setup('component', graph)
  for (const resize of ['resize', 'resizeWithoutConstraints'] as const) {
    const instance = component.createInstance()
    instance[resize](200, 150)
    expect(places(instance)).toEqual(CONSTRAINED)
    expect(hasInstanceOverride(graph, instance.id, 'width')).toBe(true)
    for (const layer of instance.children as FigmaNodeProxy[])
      expect(hasInstanceOverride(graph, layer.id, 'width')).toBe(false)
  }
})
