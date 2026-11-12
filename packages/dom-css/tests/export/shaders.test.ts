import { describe, expect, test } from 'bun:test'

import { serializeHTML } from '#dom-css/export/html'
import { sceneNodeToDesignDocument } from '#dom-css/export/projection'
import { sceneNodesToTailwindJSXWithLayers } from '#dom-css/export/tailwind-jsx'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createShaderPaint, withShaderPaints } from '@open-pencil/scene-graph/shaders'

const PRESET = {
  components: [{ type: 'Aurora', props: { colorA: '#ff3300', speed: 2 } }, { type: 'FilmGrain' }]
}
const FRAME = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
/** A JPEG's header through its frame, which declares a 37 × 21 image. */
const JPEG_FRAME = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x02, 0xff, 0xc0, 0x00, 0x11,
  0x08, 0x00, 0x15, 0x00, 0x25, 0x03
])

/** A layer with no children that fills with a shader, whose still frame is saved. */
function shaderLayer(frame = FRAME) {
  const graph = new SceneGraph()
  const { paint, shader } = createShaderPaint(PRESET)
  graph.images.set(shader.image, frame)
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Glow',
    width: 200,
    height: 120,
    fills: [paint]
  })
  graph.updateNode(node.id, { pluginData: withShaderPaints(node, [paint], [shader]) })
  return { graph, id: node.id }
}

describe('shader fills in DOM exports', () => {
  test('Tailwind JSX plays the shader behind the layer instead of inlining its still frame', () => {
    const { graph, id } = shaderLayer()
    const { code, layerIds } = sceneNodesToTailwindJSXWithLayers(graph, [id])

    expect(code).not.toContain('data:image')
    expect(code).not.toContain('<img')
    expect(code).toContain('relative')
    expect(code).toContain('isolate')
    expect(code).toMatch(/<Shader className="[^"]*absolute[^"]*" disableTelemetry>/)
    expect(code).toContain('<Aurora colorA="#ff3300" speed={2} />')
    expect(code).toContain('<FilmGrain />')
    // The layer, then the shader and its two effects, which no layer produced.
    expect(layerIds).toEqual([id, null, null, null])
  })

  test('static HTML shows the still frame behind the layer', () => {
    const { graph, id } = shaderLayer()
    const html = serializeHTML(sceneNodeToDesignDocument(graph, id))

    expect(html).toMatch(
      /^<div[^>]*><img src="data:image\/png;base64,[^"]+" alt="" style="[^"]*z-index:-1/
    )
  })

  test('static HTML names an opaque still frame saved as JPEG as JPEG', () => {
    const { graph, id } = shaderLayer(JPEG_FRAME)
    const html = serializeHTML(sceneNodeToDesignDocument(graph, id))

    expect(html).toContain('<img src="data:image/jpeg;base64,')
  })
})
