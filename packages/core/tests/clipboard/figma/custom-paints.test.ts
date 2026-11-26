import { beforeAll, expect, test } from 'bun:test'

import { buildFigmaClipboardHTML, importClipboardNodes } from '@open-pencil/core/clipboard'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { encodeFigmaClipboard, parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec, type NodeChange, type Paint } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'
import {
  SHADER_ASSET,
  shaderDefinitionRecords,
  writtenShaderDefinitions
} from '@open-pencil/test-support/fig/shader-definition'

const ASSIGNMENTS = [
  { defID: { sessionID: 7, localID: 8 }, varValue: { value: { floatValue: 0.25 } } }
]

const SHADER: Paint = {
  type: 'CUSTOM',
  opacity: 0.5,
  visible: true,
  blendMode: 'NORMAL',
  customEffectId: { assetRef: SHADER_ASSET },
  componentPropAssignments: ASSIGNMENTS
}

function figmaCopy(withDefinition = false): string {
  const records = [
    { guid: guid(0, 0), type: 'DOCUMENT', phase: 'CREATED', name: 'Document' },
    {
      guid: guid(1, 0),
      type: 'CANVAS',
      phase: 'CREATED',
      name: 'Page',
      parentIndex: { guid: guid(0, 0), position: '!' }
    },
    {
      guid: guid(2),
      type: 'RECTANGLE',
      phase: 'CREATED',
      name: 'Plate',
      size: { x: 20, y: 20 },
      parentIndex: { guid: guid(1, 0), position: '!' },
      fillPaints: [SHADER]
    },
    ...(withDefinition ? shaderDefinitionRecords(guid(0, 0), guid(3, 0), guid(4)) : [])
  ] as NodeChange[]
  return encodeFigmaClipboard(records, [], 1)
}

async function pasted(html: string, graph = new SceneGraph()) {
  const parsed = expectDefined(await parseFigmaClipboard(html))
  const [id] = importClipboardNodes(parsed.nodes, graph, graph.getPages()[0].id, 0, 0, parsed.blobs)
  return { graph, plate: expectDefined(graph.getNode(id)) }
}

async function copied(graph: SceneGraph, plate: SceneNode) {
  return expectDefined(
    await parseFigmaClipboard(expectDefined(await buildFigmaClipboardHTML([plate], graph)))
  )
}

const definitionsIn = (graph: SceneGraph) =>
  [...graph.nodes.values()].filter((node) => node.type === 'CODE_COMPONENT')

beforeAll(initCodec)

test('a shader paint pasted from Figma keeps its library shader and parameters', async () => {
  const { plate } = await pasted(figmaCopy())
  expect(plate.fills[0]).toMatchObject({
    type: 'CUSTOM',
    customEffectAssetRef: { key: 'abc', version: 'v1' },
    componentPropAssignments: ASSIGNMENTS
  })
})

test('copying a pasted shader paint gives Figma back the paint it pasted', async () => {
  const { graph, plate } = await pasted(figmaCopy())
  const { nodes } = await copied(graph, plate)
  const paint = nodes.find((node) => node.type === 'RECTANGLE')?.fillPaints?.[0]
  expect(paint).toEqual(SHADER)
})

test("a shader paint pasted from Figma keeps the shader's definition on the internal page", async () => {
  const { graph } = await pasted(figmaCopy(true))
  const [definition] = definitionsIn(graph)
  expect(definitionsIn(graph)).toHaveLength(1)
  expect(graph.getNode(definition.parentId ?? '')?.internalOnly).toBe(true)
})

test("copying a pasted shader paint gives Figma the shader's definition beside it", async () => {
  const { graph, plate } = await pasted(figmaCopy(true))
  const { nodes } = await copied(graph, plate)
  expect(writtenShaderDefinitions(nodes)).toEqual(
    writtenShaderDefinitions(shaderDefinitionRecords(guid(0, 0), guid(3, 0), guid(4)))
  )
  const definition = expectDefined(nodes.find((node) => node.type === 'CODE_COMPONENT'))
  const pageGuid = guidToString(expectDefined(definition.parentIndex).guid)
  const page = nodes.find((node) => node.guid && guidToString(node.guid) === pageGuid)
  expect(page?.internalOnly).toBe(true)
})

test('copying a layer without shader paints leaves the definition out', async () => {
  const { graph } = await pasted(figmaCopy(true))
  const other = graph.createNode('RECTANGLE', graph.getPages()[0].id, { name: 'Other' })
  const { nodes } = await copied(graph, other)
  expect(writtenShaderDefinitions(nodes)).toEqual([])
})

test("saving a pasted shader paint as .fig writes the shader's definition once", async () => {
  const { graph } = await pasted(figmaCopy(true))
  await pasted(figmaCopy(true), graph)
  const bytes = (await exportFigFile(graph)).slice().buffer as ArrayBuffer
  expect(writtenShaderDefinitions(parseFigBuffer(bytes).nodeChanges)).toEqual(
    writtenShaderDefinitions(shaderDefinitionRecords(guid(0, 0), guid(3, 0), guid(4)))
  )
  expect(definitionsIn(await parseFigFile(bytes, { populate: 'all' }))).toHaveLength(1)
})
