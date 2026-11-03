import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { exportSVG } from '#core/tools/vector'

describe('export_svg', () => {
  test('offers a warning before skipping unsupported effects', async () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Synthetic backdrop test')
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 160,
      height: 96,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      effects: [
        {
          type: 'BACKGROUND_BLUR',
          radius: 12,
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          spread: 0
        }
      ]
    })
    const figma = new FigmaAPI(graph)
    const args = v.parse(exportSVG.input, { ids: [node.id] })

    await expect(exportSVG.execute(figma, args)).resolves.toMatchObject({
      canSkipUnsupportedEffects: true,
      retryWith: { ids: [node.id], skip_unsupported_effects: true },
      unsupportedEffects: [expect.objectContaining({ effect: 'BACKGROUND_BLUR', nodeId: node.id })]
    })
  })

  test('returns SVG and warnings when unsupported effects are skipped', async () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Synthetic backdrop test')
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 160,
      height: 96,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      effects: [
        {
          type: 'BACKGROUND_BLUR',
          radius: 12,
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          spread: 0
        }
      ]
    })
    const figma = new FigmaAPI(graph)
    const args = v.parse(exportSVG.input, {
      ids: [node.id],
      skip_unsupported_effects: true
    })

    await expect(exportSVG.execute(figma, args)).resolves.toMatchObject({
      svg: expect.stringContaining('<svg'),
      warnings: [expect.objectContaining({ effect: 'BACKGROUND_BLUR', nodeId: node.id })]
    })
    expect(v.parse(exportSVG.input, {}).skip_unsupported_effects).toBe(false)
  })
})
