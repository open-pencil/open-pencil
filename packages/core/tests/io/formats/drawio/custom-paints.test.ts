import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill, type Stroke } from '@open-pencil/scene-graph'
import {
  connectorSublayers,
  createConnector,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'
import { expectDefined } from '@open-pencil/test-support/assert'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

const io = new IORegistry(BUILTIN_IO_FORMATS)

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  customEffectAssetRef: { key: 'abc', version: 'v1' }
}
const SHADER_STROKE: Stroke = { ...SHADER, weight: 3, align: 'INSIDE' }
const RED: Fill = { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

async function write(graph: SceneGraph): Promise<string> {
  const result = expectDefined(await expectDefined(io.getFormat('drawio')).writeDocument?.(graph))
  if (typeof result.data !== 'string') throw new Error('Expected draw.io XML')
  return result.data
}

describe('Figma shader paints in draw.io', () => {
  test('a shape writes its drawn fill and no stroke', async () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      width: 40,
      height: 40,
      fills: [SHADER, RED],
      strokes: [SHADER_STROKE]
    })
    expect(await write(graph)).toContain('fillColor=#FF0000;strokeColor=none;')
  })

  test('a connector whose line is a shader stroke writes no stroke', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const connector = createConnector(graph, page.id, {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(100, 0)
    })
    const { line } = expectDefined(connectorSublayers(graph, connector))
    graph.updateNode(line.id, { strokes: [SHADER_STROKE] })
    const edge = expectDefined((await write(graph)).match(/<mxCell[^>]*edge="1"[^>]*>/)?.[0])
    expect(edge).toContain('strokeColor=none')
  })
})
