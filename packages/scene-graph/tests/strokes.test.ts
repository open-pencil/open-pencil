import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { instanceOverrideFields, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { changesMoreThanStrokeLines, strokeLineChanges } from '@open-pencil/scene-graph/strokes'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

const BLUE = { r: 0, g: 0, b: 1, a: 1 }
const RED = { r: 1, g: 0, b: 0, a: 1 }

function stroke(changes: Partial<Stroke> = {}): Stroke {
  return {
    type: 'SOLID',
    color: BLUE,
    opacity: 1,
    visible: true,
    weight: 1,
    align: 'INSIDE',
    cap: 'NONE',
    join: 'MITER',
    dashPattern: [],
    ...changes
  }
}

function layerWith(strokes: Stroke[]) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('RECTANGLE', page.id, { width: 10, height: 10, strokes })
  return { graph, node }
}

describe('a layer and its strokes keep the same line fields', () => {
  test('new strokes give the layer the first stroke’s weight, alignment, cap, join, and dash', () => {
    const { graph, node } = layerWith([stroke()])
    graph.updateNode(node.id, {
      strokes: [
        stroke({ weight: 3, align: 'OUTSIDE', cap: 'ROUND', join: 'BEVEL', dashPattern: [6, 4] })
      ]
    })
    expect(node).toMatchObject({
      strokeWeight: 3,
      strokeAlign: 'OUTSIDE',
      strokeCap: 'ROUND',
      strokeJoin: 'BEVEL',
      dashPattern: [6, 4]
    })
  })

  test('a layer field set without strokes goes to every stroke', () => {
    const { graph, node } = layerWith([stroke(), stroke({ color: RED })])
    graph.updateNode(node.id, { strokeWeight: 4, dashPattern: [2, 2] })
    expect(node.strokes.map((s) => [s.weight, s.dashPattern])).toEqual([
      [4, [2, 2]],
      [4, [2, 2]]
    ])
  })

  test('strokes win over a layer field the same write sets, so restoring strokes restores them', () => {
    const { graph, node } = layerWith([stroke()])
    graph.updateNode(node.id, { strokes: [stroke({ weight: 5 })], strokeWeight: 2 })
    expect(node.strokeWeight).toBe(5)
    expect(node.strokes[0]?.weight).toBe(5)
  })

  test('a paint change leaves the layer’s fields alone, so an instance overrides only the paint', () => {
    const { node } = layerWith([stroke({ weight: 2 })])
    expect(strokeLineChanges(node, { strokes: [stroke({ weight: 2, color: RED })] })).toEqual({})
  })

  test('a layer without strokes keeps its fields for the next stroke', () => {
    const { graph, node } = layerWith([stroke({ weight: 3 })])
    graph.updateNode(node.id, { strokes: [] })
    expect(node.strokeWeight).toBe(3)
    graph.updateNode(node.id, { strokeWeight: 6 })
    expect(node.strokeWeight).toBe(6)
    expect(node.strokes).toEqual([])
  })

  test('strokes without their own cap or join take the layer’s', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('VECTOR', graph.getPages()[0].id, {
      strokeCap: 'ROUND',
      strokeJoin: 'BEVEL',
      strokes: [{ ...stroke(), cap: undefined, join: undefined }]
    })
    expect(node.strokes[0]).toMatchObject({ cap: 'ROUND', join: 'BEVEL' })
  })

  test('a new layer’s fields follow the strokes it is created with', () => {
    const { node } = layerWith([stroke({ weight: 7, dashPattern: [3, 1] })])
    expect(node.strokeWeight).toBe(7)
    expect(node.dashPattern).toEqual([3, 1])
  })
})

describe('instances keep stroke line overrides apart from paint overrides', () => {
  function component() {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const main = graph.createNode('COMPONENT', page.id, { width: 100, height: 100 })
    const shape = graph.createNode('RECTANGLE', main.id, {
      name: 'Shape',
      width: 50,
      height: 50,
      strokes: [stroke({ weight: 1 })]
    })
    const instance = graph.createInstance(main.id, page.id)
    if (!instance) throw new Error('instance not created')
    const copy = graph.getNode(instance.childIds[0])
    if (!copy) throw new Error('instance child not created')
    return { graph, main, shape, copy }
  }

  test('a weight the component changes reaches a copy that overrides only the color', () => {
    const { graph, main, shape, copy } = component()
    graph.updateNode(copy.id, { strokes: [stroke({ weight: 1, color: RED })] })
    recordInstanceOverride(graph, copy.id, ['strokes'])

    graph.updateNode(shape.id, { strokeWeight: 4 })
    graph.syncInstances(main.id)

    expect(copy.strokes[0]).toMatchObject({ weight: 4, color: RED })
    expect(copy.strokeWeight).toBe(4)
  })

  test('a copy that overrides only the weight keeps it when the component’s color changes', () => {
    const { graph, main, shape, copy } = component()
    // As a .fig file claims it: the weight alone, not the paints.
    graph.updateNode(copy.id, { strokeWeight: 5 })
    recordInstanceOverride(graph, copy.id, ['strokeWeight'])

    graph.updateNode(shape.id, { strokes: [stroke({ weight: 1, color: RED })] })
    graph.syncInstances(main.id)

    expect(copy.strokes[0]).toMatchObject({ weight: 5, color: RED })
    expect(copy.strokeWeight).toBe(5)
  })
})

describe('which overrides a stroke edit records', () => {
  /** An edit's write with what it also sets, as the editor records it. */
  function written(node: SceneNode, changes: Partial<SceneNode>): Partial<SceneNode> {
    return { ...changes, ...strokeLineChanges(node, changes) }
  }

  test('a weight or dash on every stroke overrides that field, not the paints', () => {
    const { node } = layerWith([stroke()])
    const changes = written(node, { strokes: [stroke({ weight: 5, dashPattern: [6, 4] })] })
    expect(changesMoreThanStrokeLines(node, changes)).toBe(false)
    expect(instanceOverrideFields(node, changes).toSorted()).toEqual([
      'dashPattern',
      'strokeWeight'
    ])
  })

  test('a dash over strokes of different weights overrides the dash alone', () => {
    const { node } = layerWith([stroke({ weight: 1 }), stroke({ weight: 3 })])
    const changes = written(node, { dashPattern: [6, 4] })
    expect(instanceOverrideFields(node, changes)).not.toContain('strokes')
  })

  test('a line no layer field records, such as a later stroke’s dash, overrides the strokes', () => {
    const { node } = layerWith([stroke(), stroke({ dashPattern: [6, 4] })])
    const changes = written(node, { strokes: [stroke(), stroke({ dashPattern: [] })] })
    expect(instanceOverrideFields(node, changes)).toContain('strokes')
  })

  test('a new paint, a stroke weighted apart, or a removed stroke overrides the strokes', () => {
    const { node } = layerWith([stroke(), stroke()])
    const records = (next: Stroke[]) =>
      changesMoreThanStrokeLines(node, written(node, { strokes: next }))
    expect(records([stroke({ color: RED }), stroke()])).toBe(true)
    expect(records([stroke(), stroke({ weight: 3 })])).toBe(true)
    expect(records([stroke()])).toBe(true)
  })
})

describe('copies keep their own stroke lines through swaps and modes', () => {
  test('an instance that overrides its weight keeps it when swapped to another component', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const outlined = (name: string, color: typeof BLUE) =>
      graph.createNode('COMPONENT', page.id, {
        name,
        width: 40,
        height: 40,
        strokes: [stroke({ color })]
      })
    const blue = outlined('Blue', BLUE)
    const red = outlined('Red', RED)
    const instance = graph.createInstance(blue.id, page.id)
    if (!instance) throw new Error('instance not created')
    graph.updateNode(instance.id, { strokeWeight: 5 })
    recordInstanceOverride(graph, instance.id, ['strokeWeight'])

    graph.swapInstanceComponent(instance.id, red.id)

    expect(instance.strokes[0]).toMatchObject({ weight: 5, color: RED })
    expect(instance.strokeWeight).toBe(5)
  })

  test('a swapped instance gives its own weight to every stroke of the new component', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const plain = graph.createNode('COMPONENT', page.id, {
      width: 40,
      height: 40,
      strokes: [stroke({ weight: 1 })]
    })
    const doubled = graph.createNode('COMPONENT', page.id, {
      width: 40,
      height: 40,
      strokes: [stroke({ weight: 5 }), stroke({ weight: 2, color: RED })]
    })
    const instance = graph.createInstance(plain.id, page.id)
    if (!instance) throw new Error('instance not created')
    graph.updateNode(instance.id, { strokeWeight: 5 })
    recordInstanceOverride(graph, instance.id, ['strokeWeight'])

    graph.swapInstanceComponent(instance.id, doubled.id)

    expect(instance.strokes.map((s) => s.weight)).toEqual([5, 5])
  })

  test('a copy keeps a bound weight in its own mode when the component’s color changes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Size')
    const large = graph.createMode(collection.id, 'L')
    if (!large) throw new Error('mode not created')
    const weight = graph.createVariable('Stroke', 'FLOAT', collection.id, 2)
    weight.valuesByMode[large] = 6
    const main = graph.createNode('COMPONENT', page.id, { width: 100, height: 100 })
    const shape = graph.createNode('RECTANGLE', main.id, {
      width: 50,
      height: 50,
      strokes: [stroke({ weight: 2 })]
    })
    graph.bindVariable(shape.id, 'strokeWeight', weight.id)
    const instance = graph.createInstance(main.id, page.id)
    if (!instance) throw new Error('instance not created')
    setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'variableModes')
    graph.updateNode(instance.id, { variableModes: { [collection.id]: large } })
    reconcileVariableBindings(graph)
    const copy = graph.getNode(instance.childIds[0])
    if (!copy) throw new Error('instance child not created')
    expect(copy.strokes[0]?.weight).toBe(6)

    graph.updateNode(shape.id, { strokes: [stroke({ weight: 2, color: RED })] })
    graph.syncInstances(main.id)

    expect(copy.strokes[0]).toMatchObject({ weight: 6, color: RED })
    expect(copy.strokeWeight).toBe(6)
  })
})
