import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { collectAllNodes } from '#core-tests/helpers/fig/traversal'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import {
  createShaderPaint,
  shaderOfPaint,
  shaderPresetKey,
  withShaderPaints,
  type ShaderPreset
} from '@open-pencil/scene-graph'

setDefaultTimeout(60_000)

const PRESET: ShaderPreset = { components: [{ type: 'Aurora', props: { colorA: '#ff3300' } }] }

/**
 * A shader paint is an image paint of its frame with the preset in plugin data, so a `.fig`
 * archive keeps both: Figma draws the frame, and OpenPencil reads the shader back.
 */
test('a shader fill keeps its frame and preset through a .fig archive', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const { paint, shader } = createShaderPaint(PRESET)
  const frame = { width: 120, height: 80, preset: shaderPresetKey(PRESET) }
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  graph.images.set(shader.image, png)
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Shader',
    width: 120,
    height: 80,
    fills: [paint]
  })
  graph.updateNode(node.id, {
    pluginData: withShaderPaints(node, [paint], [{ ...shader, frame }])
  })

  const bytes = await exportFigFile(graph)
  const read = await parseFigFile(bytes.buffer as ArrayBuffer)
  const copy = expectDefined(
    collectAllNodes(read).find((candidate) => candidate.name === 'Shader'),
    'shader layer'
  )
  const [fill] = copy.fills

  expect(fill).toMatchObject({ type: 'IMAGE', imageHash: shader.image })
  expect(read.images.get(shader.image)).toEqual(png)
  expect(shaderOfPaint(copy, fill)).toEqual({ ...shader, frame })
})
