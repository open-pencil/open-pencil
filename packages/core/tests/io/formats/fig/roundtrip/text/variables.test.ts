import { beforeAll, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

beforeAll(async () => {
  await initCodec()
})

// Figma binds a number variable to text content through STRINGIFY (#1110).
test('text bound to a number variable saves as STRINGIFY and reopens following the variable', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Sizes')
  const small = graph.createMode(collection.id, 'Small')
  if (!small) throw new Error('Missing mode')
  const size = graph.createVariable('Body', 'FLOAT', collection.id, 16)
  size.valuesByMode[small] = 12.5
  const label = graph.createNode('TEXT', graph.getPages()[0].id, { name: 'Size', text: '16' })
  graph.updateNode(label.id, { boundVariables: { text: size.id } })

  const bytes = await exportFigFile(graph)
  const change = parseFigBuffer(bytes.slice().buffer).nodeChanges.find(
    (node) => node.name === 'Size'
  )
  const [entry] = change?.variableConsumptionMap?.entries ?? []
  expect(entry?.variableField).toBe('TEXT_DATA')
  expect(entry?.variableData?.value?.expressionValue?.expressionFunction).toBe('STRINGIFY')

  const reopened = await parseFigFile(bytes.slice().buffer)
  const copy = [...reopened.getAllNodes()].find((node) => node.name === 'Size')
  if (!copy) throw new Error('Missing text')
  expect(copy.text).toBe('16')
  const variableId = copy.boundVariables.text
  const variable = variableId ? reopened.variables.get(variableId) : undefined
  expect(variable?.name).toBe('Body')

  const page = reopened.getPages()[0]
  const collectionId = variable?.collectionId ?? ''
  const smallMode = reopened.variableCollections
    .get(collectionId)
    ?.modes.find((mode) => mode.name === 'Small')
  reopened.updateNode(page.id, { variableModes: { [collectionId]: smallMode?.modeId ?? '' } })
  reconcileVariableBindings(reopened)
  expect(copy.text).toBe('12.50')
})
