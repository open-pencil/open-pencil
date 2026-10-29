import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { independentCornerChanges } from '@open-pencil/scene-graph/variables'

function rectangle() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const radius = graph.createVariable('Radius', 'FLOAT', collection.id, 8)
  const corner = graph.createVariable('Corner', 'FLOAT', collection.id, 2)
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, { cornerRadius: 8 })
  return { graph, node, radius, corner }
}

describe('drawing a radius corner by corner', () => {
  test('gives each corner the radius the layer shows', () => {
    const { node } = rectangle()
    expect(independentCornerChanges(node)).toEqual({
      independentCorners: true,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 8,
      bottomLeftRadius: 8
    })
  })

  test('moves a binding of the whole radius to the corners not bound alone', () => {
    const { graph, node, radius, corner } = rectangle()
    graph.bindVariable(node.id, 'cornerRadius', radius.id)
    graph.bindVariable(node.id, 'topLeftRadius', corner.id)
    const changes = independentCornerChanges(graph.getNode(node.id) ?? node)

    expect(changes.boundVariables).toEqual({
      topLeftRadius: corner.id,
      topRightRadius: radius.id,
      bottomRightRadius: radius.id,
      bottomLeftRadius: radius.id
    })
    expect(Object.keys(changes.variableBindingScales ?? {}).toSorted()).toEqual([
      'bottomLeftRadius',
      'bottomRightRadius',
      'topLeftRadius',
      'topRightRadius'
    ])
  })

  test('leaves the radius of a corner bound on its own', () => {
    const { graph, node, radius, corner } = rectangle()
    graph.bindVariable(node.id, 'cornerRadius', radius.id)
    graph.bindVariable(node.id, 'topLeftRadius', corner.id)
    graph.updateNode(node.id, { topLeftRadius: 2 })
    const changes = independentCornerChanges(graph.getNode(node.id) ?? node)
    expect(changes).not.toHaveProperty('topLeftRadius')
    expect(changes).toMatchObject({ topRightRadius: 8, bottomLeftRadius: 8, bottomRightRadius: 8 })
  })

  test('changes nothing on corners already drawn alone and bound alone', () => {
    const { graph, node } = rectangle()
    graph.updateNode(node.id, { independentCorners: true })
    expect(independentCornerChanges(graph.getNode(node.id) ?? node)).toEqual({})
  })
})
