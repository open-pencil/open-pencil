import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import fixture from './fixtures/export-contract.json'

test('Figma-authored minimal contract exports a decodable node stream', async () => {
  await initCodec()
  const { graph } = materializeDocument(
    fixture.records as NodeChange[],
    fixture.blobs.map((value) => new Uint8Array(Buffer.from(value, 'base64')))
  )
  const bytes = await exportFigFile(graph)
  const { nodeChanges } = parseFigBuffer(bytes.buffer as ArrayBuffer)
  expect(nodeChanges.length).toBeGreaterThan(0)
  const text = nodeChanges.find((node) => node.type === 'TEXT' && node.name === 'Styled label')
  expect(text?.parameterConsumptionMap).toEqual({
    entries: [
      {
        variableField: 'VISIBLE',
        variableData: {
          value: { propRefValue: { defId: { sessionID: 292486, localID: 0 } } },
          dataType: 'PROP_REF',
          resolvedDataType: 'BOOLEAN'
        }
      }
    ]
  })
})

test('reads Figma-authored modern property defaults and references', () => {
  const { graph, sources } = materializeDocument(
    fixture.records as NodeChange[],
    fixture.blobs.map((value) => new Uint8Array(Buffer.from(value, 'base64')))
  )
  const componentId = sources.get(fixture.ids.component)
  const textId = sources.get(fixture.ids.text)
  if (!componentId || !textId) throw new Error('Missing fixture nodes')
  const component = graph.getNode(componentId)
  const text = graph.getNode(textId)
  expect(component?.componentPropertyDefinitions[0]?.defaultValue).toBe('true')
  expect(text?.componentPropertyReferences).toEqual([{ propertyId: '292486:0', field: 'VISIBLE' }])
  const instanceId = sources.get(fixture.ids.instance)
  if (!instanceId) throw new Error('Missing instance')
  expect(graph.getChildren(instanceId)[0]?.visible).toBe(false)
})
