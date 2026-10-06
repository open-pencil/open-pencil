import { describe, expect, test } from 'bun:test'

import {
  reconcileNumericVariableBindings,
  SceneGraph,
  variablesResolvingThrough
} from '@open-pencil/scene-graph'

/** Two layers saved at 10 while their bindings say otherwise, as layers in imported files can be. */
function drifted() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Size')
  const base = graph.createVariable('Base', 'FLOAT', collection.id, 40)
  const alias = graph.createVariable('Alias', 'FLOAT', collection.id, { aliasId: base.id })
  const other = graph.createVariable('Other', 'FLOAT', collection.id, 24)
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, { width: 10, boundVariables: { width: alias.id } })
  const child = graph.createNode('RECTANGLE', frame.id, {
    width: 10,
    boundVariables: { width: other.id }
  })
  const elsewhere = graph.createNode('RECTANGLE', page, {
    width: 10,
    boundVariables: { width: other.id }
  })
  return { graph, base, alias, other, frame, child, elsewhere }
}

describe('binding scopes', () => {
  test('a variable reaches the variables that alias it, at any depth', () => {
    const { graph, base, alias } = drifted()
    const deeper = graph.createVariable('Deeper', 'FLOAT', base.collectionId, {
      aliasId: alias.id
    })

    expect(variablesResolvingThrough(graph, [base.id])).toEqual(
      new Set([base.id, alias.id, deeper.id])
    )
  })

  test('a variable scope resolves only the layers bound to it or its aliases', () => {
    const { graph, base, frame, child, elsewhere } = drifted()

    expect(reconcileNumericVariableBindings(graph, { variables: [base.id] })).toEqual([frame.id])
    expect(frame.width).toBe(40)
    expect([child.width, elsewhere.width]).toEqual([10, 10])
  })

  test('a subtree scope resolves the layers inside it and nothing else', () => {
    const { graph, frame, child, elsewhere } = drifted()

    reconcileNumericVariableBindings(graph, { subtrees: [frame.id] })

    expect([frame.width, child.width, elsewhere.width]).toEqual([40, 24, 10])
  })
})
