import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph, type Effect } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { exportSVG } from '#core/tools/vector'

function layerWith(effects: Effect[]): { figma: FigmaAPI; id: string } {
  const graph = new SceneGraph()
  const page = graph.addPage('Effects')
  const node = graph.createNode('RECTANGLE', page.id, {
    name: 'Panel',
    width: 160,
    height: 96,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    effects
  })
  return { figma: new FigmaAPI(graph), id: node.id }
}

function effect(type: Effect['type']): Effect {
  return {
    type,
    radius: 12,
    visible: true,
    color: { r: 0, g: 0, b: 0, a: 0 },
    offset: { x: 0, y: 0 },
    spread: 0
  }
}

describe('export_svg', () => {
  test('exports a background blur without warnings', async () => {
    const { figma, id } = layerWith([effect('BACKGROUND_BLUR')])

    const result = await exportSVG.execute(figma, v.parse(exportSVG.input, { ids: [id] }))

    expect(result).toEqual({ svg: expect.stringContaining('backdrop-filter:blur(6px)') })
  })

  test('returns the SVG with a warning for each effect it leaves out', async () => {
    const { figma, id } = layerWith([effect('GLASS')])

    const result = await exportSVG.execute(figma, v.parse(exportSVG.input, { ids: [id] }))

    expect(result).toEqual({
      svg: expect.stringContaining('<svg'),
      warnings: [expect.objectContaining({ effect: 'GLASS', nodeId: id, nodeName: 'Panel' })]
    })
  })
})
