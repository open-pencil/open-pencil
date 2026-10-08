import { expect, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { Component, Frame, Instance, Rectangle } from '@open-pencil/design-jsx'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

test('overriding one instance dimension preserves the other inherited dimension', async () => {
  const graph = makeSceneGraph()
  const component = await renderTree(graph, Component({ flex: 'col', w: 280, h: 100 }))
  const result = await renderTree(graph, Instance({ of: component.id, w: 120 }))
  graph.syncInstances(component.id)
  computeAllLayouts(graph)
  const instance = getNodeOrThrow(graph, result.id)
  expect(instance.width).toBe(120)
  expect(instance.height).toBe(100)
  expect(instance.counterAxisSizing).toBe('FIXED')
  expect(instance.primaryAxisSizing).toBe('FIXED')
})

for (const flex of ['row', 'col'] as const) {
  test(`instances fill their parent across inherited fixed ${flex} dimensions`, async () => {
    const graph = makeSceneGraph()
    const component = await renderTree(
      graph,
      Component({ flex, w: 280, h: 100, children: Rectangle({ w: 20, h: 20 }) })
    )
    const parent = await renderTree(
      graph,
      Frame({
        flex: 'col',
        w: 220,
        h: 180,
        children: Instance({ of: component.id, w: 'fill', h: 'fill' })
      })
    )
    const instance = graph.getChildren(parent.id)[0]
    expect(instance.width).toBe(220)
    expect(instance.height).toBe(180)
    graph.syncInstances(component.id)
    computeAllLayouts(graph)
    expect(instance.width).toBe(220)
    expect(instance.height).toBe(180)
  })

  test(`explicit instance dimensions override inherited Hug ${flex} sizing`, async () => {
    const graph = makeSceneGraph()
    const component = await renderTree(
      graph,
      Component({ flex, w: 'hug', h: 'hug', children: Rectangle({ w: 20, h: 20 }) })
    )
    const result = await renderTree(graph, Instance({ of: component.id, w: 120, h: 80 }))
    const instance = getNodeOrThrow(graph, result.id)
    expect(instance.width).toBe(120)
    expect(instance.height).toBe(80)
    graph.syncInstances(component.id)
    computeAllLayouts(graph)
    expect(instance.width).toBe(120)
    expect(instance.height).toBe(80)
  })
}
