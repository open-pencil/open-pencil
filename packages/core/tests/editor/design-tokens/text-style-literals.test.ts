import { expect, test } from 'bun:test'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

import { designSystem, exported, importInto } from './helpers'

function headingSizeInDark(graph: SceneGraph) {
  const theme = [...graph.variableCollections.values()].find((item) => item.name === 'Theme')
  const dark = theme?.modes.find((mode) => mode.name === 'Dark')
  if (!theme || !dark) {
    throw new Error('missing Theme/Dark')
  }
  const size = graph.createVariable('Type/H1', 'FLOAT', theme.id, 32)
  size.valuesByMode[dark.modeId] = 40
  return { modes: { [theme.id]: dark.modeId }, size }
}

test('a text style field a token writes as a literal lets its variable go', () => {
  const graph = designSystem()
  const { modes, size } = headingSizeInDark(graph)
  const [style] = getSharedStyles(graph, 'text')
  graph.bindVariable(style.nodeId, 'fontSize', size.id)
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, { variableModes: modes })
  const layer = graph.createNode('TEXT', frame.id, {
    text: 'Title',
    fontFamily: 'Inter',
    fontSize: 40,
    textStyleId: style.id
  })
  const source = designSystem()
  const [sourceStyle] = getSharedStyles(source, 'text')
  source.updateNode(sourceStyle.nodeId, { fontSize: 24 })

  importInto(graph, exported(source))

  expect(graph.getNode(style.nodeId)?.boundVariables.fontSize).toBeUndefined()
  reconcileVariableBindings(graph, { subtrees: [frame.id] })
  expect(graph.getNode(layer.id)).toMatchObject({ fontSize: 24, textStyleId: style.id })
})
