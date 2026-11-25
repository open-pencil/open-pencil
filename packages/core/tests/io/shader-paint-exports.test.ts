import { describe, expect, test } from 'bun:test'

import { BUILTIN_IO_FORMATS, IORegistry, renderNodesToPPTX } from '@open-pencil/core/io'
import { SceneGraph, type Fill, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { slideXML, stubRasterize, unzipPPTX } from './formats/pptx/export/helpers'

const io = new IORegistry(BUILTIN_IO_FORMATS)

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  customEffectId: { key: 'abc', version: 'v1' }
}

const SHADER_STROKE: Stroke = { ...SHADER, weight: 3, align: 'INSIDE' }

const RED: Fill = { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

function shaderStrokedFrame() {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    name: 'Frame',
    width: 1280,
    height: 720
  })
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Stroked',
    width: 40,
    height: 40,
    fills: [SHADER, RED],
    strokes: [SHADER_STROKE]
  })
  return { graph, frame }
}

async function exported(format: 'html' | 'tailwind-jsx' | 'drawio' | 'jsx'): Promise<string> {
  const { graph, frame } = shaderStrokedFrame()
  const result = await io.exportContent(format, {
    graph,
    target: { scope: 'node', nodeId: frame.id }
  })
  return typeof result.data === 'string' ? result.data : new TextDecoder().decode(result.data)
}

describe('Figma shader paints in exports', () => {
  test('HTML writes no border and keeps the solid fill', async () => {
    const html = await exported('html')
    expect(html).not.toContain('border')
    expect(html).toContain('#FF0000')
  })

  test('Tailwind writes no border', async () => {
    expect(await exported('tailwind-jsx')).not.toContain('border')
  })

  test('draw.io writes no stroke and the solid fill', async () => {
    const drawio = await exported('drawio')
    expect(drawio).toContain('fillColor=#FF0000;strokeColor=none;')
  })

  test('design JSX writes no stroke', async () => {
    expect(await exported('jsx')).not.toContain('stroke')
  })

  test('PPTX draws no black outline', async () => {
    const { graph, frame } = shaderStrokedFrame()
    const data = expectDefined(
      await renderNodesToPPTX(graph, graph.getPages()[0].id, [frame.id], {
        rasterize: stubRasterize
      }),
      'pptx'
    )
    expect(slideXML(unzipPPTX(data), 1)).not.toContain('<a:srgbClr val="000000"/>')
  })
})
