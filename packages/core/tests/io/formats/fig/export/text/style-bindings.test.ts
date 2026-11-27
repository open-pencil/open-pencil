import { beforeAll, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

beforeAll(async () => {
  await initCodec()
})

function boundFields(record: {
  parameterConsumptionMap?: unknown
  variableConsumptionMap?: unknown
}) {
  return [record.parameterConsumptionMap, record.variableConsumptionMap]
    .flatMap(
      (map) => (map as { entries?: { variableField?: string }[] } | undefined)?.entries ?? []
    )
    .map((entry) => entry.variableField)
}

test('a text keeps the binding on its style through export and import', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const collection = graph.createCollection('Type scale')
  const roomy = graph.createMode(collection.id, 'Roomy') ?? ''
  const size = graph.createVariable('Body size', 'FLOAT', collection.id, 14)
  size.valuesByMode[roomy] = 20
  const style = graph.createNode('TEXT', page.id, {
    name: 'Body',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontSize: 14,
    boundVariables: { fontSize: size.id }
  })
  style.source.id = 'style:body'
  const frame = graph.createNode('FRAME', page.id, {
    name: 'Roomy frame',
    variableModes: { [collection.id]: roomy }
  })
  graph.createNode('TEXT', frame.id, { name: 'Label', text: 'Hello', textStyleId: 'style:body' })
  reconcileVariableBindings(graph)

  const saved = await exportFigFile(graph)
  const records = parseFigBuffer(saved.slice().buffer).nodeChanges
  const reopened = await parseFigFile(saved.slice().buffer)
  const label = [...reopened.nodes.values()].find((node) => node.name === 'Label')
  const body = [...reopened.nodes.values()].find((node) => node.name === 'Body')

  expect(boundFields(records.find((record) => record.name === 'Label') ?? {})).toEqual([])
  expect(boundFields(records.find((record) => record.name === 'Body') ?? {})).toContain('FONT_SIZE')
  expect(label?.fontSize).toBe(20)
  expect(label?.boundVariables).toEqual({})
  expect(label?.textStyleId).toBe(body?.source.id)
  expect(Object.keys(body?.boundVariables ?? {})).toEqual(['fontSize'])
})
