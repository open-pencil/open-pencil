import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'

import { initCanvasKit } from '#cli/headless'
import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

import {
  computeAllLayouts,
  initCodec,
  parseFigFile,
  renderNodesToImage,
  SceneGraph,
  SkiaRenderer,
  type SceneNode
} from '@open-pencil/core'

let graph: SceneGraph
let movingNodeId: string
let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
  await initCodec()
  const buf = readFileSync(repoPath('tests/fixtures/gold-preview.fig'))
  graph = await parseFigFile(buf.buffer as ArrayBuffer)
  computeAllLayouts(graph)
  const preview = [...graph.getAllNodes()].find((node) => node.name === 'Preview Thumbnail')
  const input = preview
    ? graph.getChildren(preview.id).find((node) => node.name === 'Input')
    : undefined
  if (!input) throw new Error('gold-preview Input fixture node not found')
  movingNodeId = input.id
})

function renderPreview(renderer: SkiaRenderer, sceneVersion: number): Uint8Array {
  renderer.render(graph, new Set(), {}, sceneVersion)
  const image = renderer.surface.makeImageSnapshot()
  const pixels = image.readPixels(0, 0, {
    width: 900,
    height: 700,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  })
  image.delete()
  return expectDefined(pixels, 'rendered pixels')
}

function childNamed(parent: SceneNode | undefined, name: string): SceneNode | undefined {
  return parent ? graph.getChildren(parent.id).find((node) => node.name === name) : undefined
}

function fixtureInputBadge(): SceneNode {
  const preview = [...graph.getAllNodes()].find((node) => node.name === 'Preview Thumbnail')
  const input = childNamed(preview, 'Input')
  const inputRoot = childNamed(input, '_input')
  const inputFrame = childNamed(inputRoot, 'Input')
  const content = childNamed(inputFrame, 'Content')
  const tags = childNamed(content, 'Tags')
  const badge = childNamed(tags, 'Badge')
  if (!badge) throw new Error('gold-preview badge fixture node not found')
  return badge
}

function countDarkPixels(pixels: Uint8Array): number {
  let dark = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 200 && pixels[i] < 80 && pixels[i + 1] < 80 && pixels[i + 2] < 80) {
      dark++
    }
  }
  return dark
}

function pixelIndex(width: number, x: number, y: number): number {
  return (y * width + x) * 4
}

function maskYCenter(
  pixels: Uint8Array,
  width: number,
  height: number,
  matches: (index: number) => boolean,
  xRange = [0, width]
): number {
  let minY = Infinity
  let maxY = -Infinity
  for (let y = 0; y < height; y++) {
    for (let x = xRange[0]; x < xRange[1]; x++) {
      if (!matches(pixelIndex(width, x, y))) continue
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (minY === Infinity) throw new Error('pixel mask had no matches')
  return (minY + maxY) / 2
}

describe('render cache regressions', () => {
  test('badge label is vertically centered in the pill', async () => {
    const surface = expectDefined(ck.MakeSurface(120, 60), 'badge surface')
    const renderer = new SkiaRenderer(ck, surface)
    await renderer.loadFonts()
    try {
      const badge = fixtureInputBadge()
      const png = renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [badge.id], {
        scale: 1,
        format: 'PNG'
      })
      expect(png).toBeTruthy()
      const image = expectDefined(
        ck.MakeImageFromEncoded(expectDefined(png, 'badge png')),
        'badge image'
      )
      const width = image.width()
      const height = image.height()
      const pixels = image.readPixels(0, 0, {
        width,
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
      image.delete()

      const renderedPixels = expectDefined(pixels, 'badge pixels')
      const contentCenter = maskYCenter(
        renderedPixels,
        width,
        height,
        (i) => renderedPixels[i + 3] > 10
      )
      const textCenter = maskYCenter(
        renderedPixels,
        width,
        height,
        (i) =>
          renderedPixels[i + 3] > 128 &&
          pixels[i] < 130 &&
          pixels[i + 1] < 140 &&
          pixels[i + 2] < 160,
        [20, 67]
      )
      expect(Math.abs(textCenter - contentCenter)).toBeLessThanOrEqual(0.6)
    } finally {
      surface.delete()
    }
  })

  test('scene picture redraw keeps text after moving a node', async () => {
    const surface = expectDefined(ck.MakeSurface(900, 700), 'preview surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 900
    renderer.viewportHeight = 700
    renderer.dpr = 1
    await renderer.loadFonts()
    renderer.panX = 0
    renderer.panY = 0
    renderer.zoom = 0.75
    renderer.pageId = graph.getPages()[0].id

    try {
      const beforeDark = countDarkPixels(renderPreview(renderer, 1))
      const movingNode = graph.getNode(movingNodeId)
      expect(movingNode).toBeDefined()
      const originalX = movingNode?.x ?? 0
      graph.updateNode(movingNodeId, { x: originalX + 20 })
      expect(graph.getNode(movingNodeId)?.x).toBeCloseTo(originalX + 20, 3)
      const afterDark = countDarkPixels(renderPreview(renderer, 2))

      expect(afterDark).toBeGreaterThan(beforeDark * 0.8)
    } finally {
      surface.delete()
    }
  })
})
