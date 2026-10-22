import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

beforeAll(initCodec)

function named(graph: SceneGraph, name: string): SceneNode {
  return expectDefined([...graph.getAllNodes()].find((node) => node.name === name))
}

function layerIn(graph: SceneGraph, root: SceneNode, name: string): SceneNode {
  const pending = [...root.childIds]
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const node = expectDefined(graph.getNode(id))
    if (node.name === name) {
      return node
    }
    pending.push(...node.childIds)
  }
  throw new Error(`Missing layer ${name}`)
}

function placedTwoLevelsDeep(): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', page, {
    name: 'Badge',
    componentPropertyDefinitions: [
      { id: '8:1', name: 'Size', type: 'VARIANT', defaultValue: 'small' }
    ]
  })
  const small = graph.createNode('COMPONENT', set.id, {
    name: 'Size=small',
    componentPropertyValues: { Size: 'small' }
  })
  graph.createNode('RECTANGLE', small.id, { name: 'Dot', width: 4, height: 4 })
  const large = graph.createNode('COMPONENT', set.id, {
    name: 'Size=large',
    componentPropertyValues: { Size: 'large' }
  })
  graph.createNode('RECTANGLE', large.id, { name: 'Ring', width: 8, height: 8 })
  const middle = graph.createNode('COMPONENT', page, { name: 'Middle', x: 100 })
  graph.createInstance(small.id, middle.id, { name: 'Badge' })
  const outer = graph.createNode('COMPONENT', page, { name: 'Outer', x: 200 })
  graph.createInstance(middle.id, outer.id, { name: 'Middle copy' })
  const placed = expectDefined(graph.createInstance(outer.id, page, { name: 'Placed', x: 400 }))
  const dot = layerIn(graph, placed, 'Dot')
  graph.updateNode(dot.id, { opacity: 0.5 })
  setInstanceOverride(placed.instanceOverrides, placed.id, dot.id, 'opacity')
  graph.updateNode(placed.id, { instanceOverrides: placed.instanceOverrides })
  return graph
}

function opacityOverrides(file: Uint8Array): number {
  const record = parseFigBuffer(file.slice().buffer).nodeChanges.find(
    (change) => change.name === 'Placed'
  )
  return symbolOverridesOf(expectDefined(record)).filter((override) => 'opacity' in override).length
}

test('a nested swap saves without the overrides an outer instance held on removed layers', async () => {
  const file = await exportFigFile(placedTwoLevelsDeep())
  expect(opacityOverrides(file)).toBe(1)
  const opened = await parseFigFile(file.slice().buffer)
  const placed = named(opened, 'Placed')

  opened.swapInstanceComponent(layerIn(opened, placed, 'Badge').id, named(opened, 'Size=large').id)

  expect(opacityOverrides(await exportFigFile(opened))).toBe(0)
})
