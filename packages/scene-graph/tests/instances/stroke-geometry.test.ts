import { describe, expect, test } from 'bun:test'

import {
  instanceOverrideFields,
  recordInstanceOverride,
  SceneGraph,
  type SceneNode,
  type Stroke
} from '@open-pencil/scene-graph'

const black = { r: 0, g: 0, b: 0, a: 1 }
const red = { r: 1, g: 0, b: 0, a: 1 }

function stroke(color: Stroke['color'], weight: number): Stroke {
  return { type: 'SOLID', color, opacity: 1, visible: true, weight, align: 'INSIDE' }
}

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const component = graph.createNode('COMPONENT', page)
  graph.createNode('RECTANGLE', component.id, {
    strokes: [stroke(black, 1), stroke(black, 1)]
  })
  const instance = graph.createInstance(component.id, page)
  if (!instance) throw new Error('Missing instance')
  const [layer] = graph.getChildren(instance.id)
  const [source] = graph.getChildren(component.id)
  const edit = (id: string, changes: Partial<SceneNode>) => {
    const node = graph.getNode(id)
    if (!node) throw new Error('Missing node')
    const fields = instanceOverrideFields(node, changes)
    graph.updateNode(id, changes)
    recordInstanceOverride(graph, id, fields)
    return fields
  }
  return { graph, component, layer, source, edit }
}

describe('stroke geometry on instance layers', () => {
  test('reweighting strokes overrides the weight, not the paint', () => {
    const { layer, edit } = setup()
    expect(edit(layer.id, { strokes: [stroke(black, 4), stroke(black, 1)] })).toEqual([
      'strokeWeight'
    ])
  })

  test('each stroke keeps its own overridden weight when the component repaints', () => {
    const { graph, component, layer, source, edit } = setup()
    edit(layer.id, { strokeWeight: 4, strokes: [stroke(black, 4), stroke(black, 2)] })
    graph.updateNode(source.id, { strokes: [stroke(red, 1), stroke(red, 1)] })
    graph.syncInstances(component.id)
    const strokes = graph.getNode(layer.id)?.strokes ?? []
    expect(strokes.map((s) => [s.color.r, s.weight])).toEqual([
      [1, 4],
      [1, 2]
    ])
  })
})
