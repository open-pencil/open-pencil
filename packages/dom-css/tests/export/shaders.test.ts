import { describe, expect, test } from 'bun:test'

import {
  sceneNodeToDesignDocument,
  sceneNodesToTailwindJSXWithLayers,
  serializeHTML
} from '#dom-css/index'

import { createShaderPaint, SceneGraph, withShaderPaints } from '@open-pencil/scene-graph'

const PRESET = {
  components: [{ type: 'Aurora', props: { colorA: '#ff3300', speed: 2 } }, { type: 'FilmGrain' }]
}
const FRAME = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

/** A layer with no children that fills with a shader, whose still frame is saved. */
function shaderLayer() {
  const graph = new SceneGraph()
  const { paint, shader } = createShaderPaint(PRESET)
  graph.images.set(shader.image, FRAME)
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
})
