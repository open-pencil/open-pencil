import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

/** A text layer with shared styles whose letter spacing a variable drives. */
function styledText() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Type')
  const spacing = graph.createVariable('Spacing', 'FLOAT', collection.id, 2)
  const text = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Label',
    textStyleId: 'style:text',
    fillStyleId: 'style:fill'
  })
  graph.bindVariable(text.id, 'letterSpacing', spacing.id)
  return { graph, text }
}

test('resolving bindings keeps the shared styles', () => {
  const { graph, text } = styledText()
  reconcileVariableBindings(graph)
  expect(graph.getNode(text.id)).toMatchObject({
    letterSpacing: { value: 2, unit: 'PIXELS' },
    textStyleId: 'style:text',
    fillStyleId: 'style:fill'
  })
})

test('a graph write keeps the styles, which only an edit leaves', () => {
  const { graph, text } = styledText()
  graph.updateNode(text.id, { letterSpacing: { value: 4, unit: 'PIXELS' } })
  expect(graph.getNode(text.id)).toMatchObject({
    textStyleId: 'style:text',
    fillStyleId: 'style:fill'
  })
})
