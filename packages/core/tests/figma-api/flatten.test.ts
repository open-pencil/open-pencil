import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

import { initCanvasKit } from '@open-pencil/core/io/formats/raster'

import { SkiaRenderer } from '#core/canvas'

async function createRenderer() {
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  return { renderer: new SkiaRenderer(ck, surface), surface }
}

describe('FigmaAPI renderer-backed flatten', () => {
  test('keeps headless flatten as a compatibility placeholder without geometry', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.resize(50, 40)

    const vector = api.flatten([rect], api.currentPage)
    const raw = api.graph.getNode(vector.id)

    expect(raw?.type).toBe('VECTOR')
    expect(raw?.width).toBe(50)
    expect(raw?.height).toBe(40)
    expect(raw?.vectorNetwork).toBeNull()
    expect(api.getNodeById(rect.id)).toBeNull()
  })

  test('creates vector geometry when a renderer is attached', async () => {
    const api = createAPI()
    const { renderer, surface } = await createRenderer()
    api.setRenderer(renderer)
    const first = api.createRectangle()
    const second = api.createEllipse()
    first.resize(50, 40)
    second.resize(50, 40)
    second.x = 30
    second.y = 10

    const vector = api.flatten([first, second], api.currentPage)
    const raw = api.graph.getNode(vector.id)

    expect(raw?.type).toBe('VECTOR')
    expect(raw?.x).toBe(0)
    expect(raw?.y).toBe(0)
    expect(raw?.width).toBe(80)
    expect(raw?.height).toBe(50)
    expect(raw?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(api.getNodeById(first.id)).toBeNull()
    surface.delete()
  })

  // The Plugin API takes layers from several parents; they stack in the order it is given them.
  test('stacks layers from several parents in the order given', async () => {
    const api = createAPI()
    const { renderer, surface } = await createRenderer()
    api.setRenderer(renderer)
    const solid = (r: number, b: number) => ({ type: 'SOLID' as const, color: { r, g: 0, b } })
    const frame = api.createFrame()
    const inFrame = api.createRectangle()
    frame.appendChild(inFrame)
    inFrame.fills = [solid(1, 0)]
    const onPage = api.createRectangle()
    onPage.x = 200
    onPage.fills = [solid(0, 1)]

    const vector = api.flatten([inFrame, onPage], api.currentPage)
    const regions = api.graph.getNode(vector.id)?.vectorNetwork?.regions
    expect(regions?.map((region) => region.fills?.[0]?.color)).toEqual([
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 }
    ])
    surface.delete()
  })
})
