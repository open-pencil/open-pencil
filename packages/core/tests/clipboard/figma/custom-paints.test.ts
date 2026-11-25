import { beforeAll, expect, test } from 'bun:test'

import { buildFigmaClipboardHTML, importClipboardNodes } from '@open-pencil/core/clipboard'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec, type Paint } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ASSIGNMENTS = [
  { defID: { sessionID: 7, localID: 8 }, varValue: { value: { floatValue: 0.25 } } }
]

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 0.5,
  visible: true,
  blendMode: 'NORMAL',
  customEffectId: { key: 'abc', version: 'v1' },
  componentPropAssignments: ASSIGNMENTS
}

beforeAll(initCodec)

async function copied(fills: Fill[]) {
  const graph = new SceneGraph()
  const layer = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 20,
    height: 20,
    fills
  })
  const html = expectDefined(await buildFigmaClipboardHTML([layer], graph))
  return expectDefined(await parseFigmaClipboard(html))
}

test('a copied shader paint names its shader and parameters as Figma does', async () => {
  const { nodes } = await copied([SHADER])
  const paint: Paint | undefined = nodes.find((node) => node.type === 'RECTANGLE')?.fillPaints?.[0]
  expect(paint).toEqual({
    type: 'CUSTOM',
    opacity: 0.5,
    visible: true,
    blendMode: 'NORMAL',
    customEffectId: { assetRef: { key: 'abc', version: 'v1' } },
    componentPropAssignments: ASSIGNMENTS
  })
})

test('a pasted shader paint keeps its shader and parameters', async () => {
  const { nodes, blobs } = await copied([SHADER])
  const graph = new SceneGraph()
  importClipboardNodes(nodes, graph, graph.getPages()[0].id, 0, 0, blobs)
  const pasted = expectDefined([...graph.nodes.values()].find((node) => node.type === 'RECTANGLE'))
  expect(pasted.fills[0]).toMatchObject({
    type: 'CUSTOM',
    customEffectId: { key: 'abc', version: 'v1' },
    componentPropAssignments: ASSIGNMENTS
  })
})
