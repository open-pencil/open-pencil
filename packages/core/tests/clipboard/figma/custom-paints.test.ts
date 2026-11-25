import { beforeAll, expect, test } from 'bun:test'

import { buildFigmaClipboardHTML, importClipboardNodes } from '@open-pencil/core/clipboard'
import { encodeFigmaClipboard, parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec, type NodeChange, type Paint } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'

const ASSIGNMENTS = [
  { defID: { sessionID: 7, localID: 8 }, varValue: { value: { floatValue: 0.25 } } }
]

const SHADER: Paint = {
  type: 'CUSTOM',
  opacity: 0.5,
  visible: true,
  blendMode: 'NORMAL',
  customEffectId: { assetRef: { key: 'abc', version: 'v1' } },
  componentPropAssignments: ASSIGNMENTS
}

function figmaCopy(): string {
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
    }
  ] as NodeChange[]
  return encodeFigmaClipboard(records, [], 1)
}

async function pasted(html: string) {
  const parsed = expectDefined(await parseFigmaClipboard(html))
  const graph = new SceneGraph()
  importClipboardNodes(parsed.nodes, graph, graph.getPages()[0].id, 0, 0, parsed.blobs)
  const plate = expectDefined([...graph.nodes.values()].find((node) => node.type === 'RECTANGLE'))
  return { graph, plate }
}

beforeAll(initCodec)

test('a shader paint pasted from Figma keeps its library shader and parameters', async () => {
  const { plate } = await pasted(figmaCopy())
  expect(plate.fills[0]).toMatchObject({
    type: 'CUSTOM',
    customEffectId: { key: 'abc', version: 'v1' },
    componentPropAssignments: ASSIGNMENTS
  })
})

test('copying a pasted shader paint gives Figma back the paint it pasted', async () => {
  const { graph, plate } = await pasted(figmaCopy())
  const copied = expectDefined(
    await parseFigmaClipboard(expectDefined(await buildFigmaClipboardHTML([plate], graph)))
  )
  const paint = copied.nodes.find((node) => node.type === 'RECTANGLE')?.fillPaints?.[0]
  expect(paint).toEqual(SHADER)
})
