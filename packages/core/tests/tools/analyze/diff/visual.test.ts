import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  initCanvasKit
} from '@open-pencil/core/io/formats/raster'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph, type Color } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

type VisualDiff = {
  error?: string
  mimeType?: string
  width?: number
  height?: number
  changedPixels?: number
  changedRatio?: number
  changedBounds?: Rect | null
}

let codec: ReturnType<typeof createCanvasKitRasterCodec>

beforeAll(async () => {
  codec = createCanvasKitRasterCodec(await initCanvasKit())
})

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 }

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  figma.exportImage = (ids, options) =>
    headlessRenderNodes(graph, options.pageId ?? figma.currentPageId, ids, options)
  figma.rasterCodec = codec

  const card = figma.createFrame()
  card.resize(100, 60)
  card.fills = [{ type: 'SOLID', color: WHITE, opacity: 1, visible: true }]
  const swatch = figma.createRectangle()
  swatch.x = 60
  swatch.y = 20
  swatch.resize(20, 20)
  swatch.fills = [{ type: 'SOLID', color: BLUE, opacity: 1, visible: true }]
  card.appendChild(swatch)
  return { figma, card }
}

async function visualDiff(figma: FigmaAPI, args: Record<string, unknown>) {
  const tool = expectDefined(ALL_TOOLS.find((candidate) => candidate.name === 'diff_visual'))
  return (await tool.execute(figma, args)) as VisualDiff
}

describe('diff_visual', () => {
  test('reports no changed pixels for an identical copy', async () => {
    const { figma, card } = setup()
    const copy = card.clone()
    copy.x = 300

    const result = await visualDiff(figma, { from: card.id, to: copy.id })
    expect(result.error).toBeUndefined()
    expect(result.mimeType).toBe('image/png')
    expect(result.changedPixels).toBe(0)
    expect(result.changedBounds).toBeNull()
  })

  test('locates a fill change in source-node coordinates', async () => {
    const { figma, card } = setup()
    const copy = card.clone()
    copy.x = 300
    const copiedSwatch = expectDefined(copy.children[0], 'copied swatch')
    copiedSwatch.fills = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
    ]

    const result = await visualDiff(figma, { from: card.id, to: copy.id, scale: 2 })
    expect(result.width).toBe(200)
    expect(result.changedPixels).toBeGreaterThan(0)
    expect(result.changedRatio).toBeCloseTo((40 * 40) / (200 * 120), 2)
    expect(result.changedBounds).toEqual({ x: 60, y: 20, width: 20, height: 20 })
  })

  test('applies the same max-edge bound as export_image', async () => {
    const { figma, card } = setup()
    const copy = card.clone()

    const result = await visualDiff(figma, { from: card.id, to: copy.id, scale: 4, maxEdge: 64 })
    expect(result.width).toBe(64)
  })
})
