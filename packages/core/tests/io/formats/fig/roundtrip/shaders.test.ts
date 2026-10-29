import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { collectAllNodes } from '#core-tests/helpers/fig/traversal'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import {
  createShaderPaint,
  shaderOfPaint,
  shaderPresetKey,
  withShaderPaints,
  type ShaderPreset
} from '@open-pencil/scene-graph/shaders'

setDefaultTimeout(60_000)

const PRESET: ShaderPreset = { components: [{ type: 'Aurora', props: { colorA: '#ff3300' } }] }

/**
 * A shader paint is an image paint of its frame with the preset in plugin data, so a `.fig`
 * archive keeps both: Figma draws the frame, and OpenPencil reads the shader back. Figma reads
 * the frame only under the SHA-1 of its bytes, so the archive names it that, in the paint and in
 * the plugin data alike.
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

  const figmaName = computeImageHash(png)
  expect(fill).toMatchObject({ type: 'IMAGE', imageHash: figmaName })
  expect(read.images.get(figmaName)).toEqual(png)
  expect(read.images.has(shader.image)).toBe(false)
  expect(shaderOfPaint(copy, fill)).toEqual({ ...shader, image: figmaName, frame })
})

test('images stored under other names are written once, under the SHA-1 of their bytes', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
  // Two names for the same bytes, as documents saved before image names were SHA-1 can hold.
  const names = [
    '0123456789abcdef0123456789abcdef01234567',
    'fedcba9876543210fedcba9876543210fedcba98'
  ]
  for (const [index, name] of names.entries()) {
    graph.images.set(name, png)
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: `Photo ${index}`,
      width: 40,
      height: 40,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: name,
          imageScaleMode: 'FILL'
        }
      ]
    })
  }

  const read = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
  const figmaName = computeImageHash(png)
  const photos = collectAllNodes(read).filter((node) => node.name.startsWith('Photo'))

  expect(photos.map((photo) => photo.fills[0]?.imageHash)).toEqual([figmaName, figmaName])
  expect([...read.images.keys()]).toEqual([figmaName])
})
