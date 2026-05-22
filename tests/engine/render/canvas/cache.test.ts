import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import {
  computeAllLayouts,
  initCodec,
  parseFigFile,
  renderNodesToImage,
  SceneGraph,
  SkiaRenderer,
  type SceneNode
} from '@open-pencil/core'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

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
        [0, width]
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

  test('scene picture cache recovers after position preview commits', async () => {
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
      renderPreview(renderer, 10)

      const movingNode = expectDefined(graph.getNode(movingNodeId), 'moving node')
      const originalX = movingNode.x
      graph.updateNodePositionPreview(movingNodeId, originalX + 20, movingNode.y)

      renderPreview(renderer, 10)

      graph.updateNode(movingNodeId, { x: originalX + 20 })
      renderPreview(renderer, 11)
      renderPreview(renderer, 11)

      const hitMode = renderer.profiler.stats.scenePictureMode
      expect(hitMode === 'hit' || hitMode === 'volatile').toBe(true)
    } finally {
      surface.delete()
    }
  })

  test('default render refreshes cached absolute positions without a scene version', async () => {
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

    const originalX = graph.getNode(movingNodeId)?.x ?? 0

    try {
      renderer.render(graph, new Set())
      const before = renderer._absPosFullCache.get(movingNodeId)

      graph.updateNode(movingNodeId, { x: originalX + 40 })
      renderer.render(graph, new Set())
      const after = renderer._absPosFullCache.get(movingNodeId)

      expect(before?.x).toBeCloseTo(originalX, 3)
      expect(after?.x).toBeCloseTo(originalX + 40, 3)
    } finally {
      graph.updateNode(movingNodeId, { x: originalX })
      surface.delete()
    }
  })

  test('renderSceneToCanvas refreshes cached absolute positions between export renders', async () => {
    const surface = expectDefined(ck.MakeSurface(900, 700), 'preview surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 900
    renderer.viewportHeight = 700
    renderer.dpr = 1
    await renderer.loadFonts()

    const originalX = graph.getNode(movingNodeId)?.x ?? 0
    const canvas = surface.getCanvas()

    try {
      renderer.renderSceneToCanvas(canvas, graph, graph.getPages()[0].id)
      const before = renderer._absPosFullCache.get(movingNodeId)

      graph.updateNode(movingNodeId, { x: originalX + 30 })
      renderer.renderSceneToCanvas(canvas, graph, graph.getPages()[0].id)
      const after = renderer._absPosFullCache.get(movingNodeId)

      expect(before?.x).toBeCloseTo(originalX, 3)
      expect(after?.x).toBeCloseTo(originalX + 30, 3)
    } finally {
      graph.updateNode(movingNodeId, { x: originalX })
      surface.delete()
    }
  })

  test('renderNodesToImage ignores live base LOD when exporting offscreen', async () => {
    const exportGraph = new SceneGraph()
    const page = exportGraph.getPages()[0]
    const tinyNode = exportGraph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(16, 16), 'export surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 16
    renderer.viewportHeight = 16
    renderer.dpr = 1
    renderer.zoom = 0.1
    renderer.minScreenSize = 4

    try {
      const png = renderNodesToImage(ck, renderer, exportGraph, page.id, [tinyNode.id], {
        scale: 10,
        format: 'PNG'
      })
      const image = expectDefined(
        ck.MakeImageFromEncoded(expectDefined(png, 'tiny export png')),
        'tiny export image'
      )
      const pixels = image.readPixels(0, 0, {
        width: 10,
        height: 10,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
      image.delete()

      let visiblePixels = 0
      for (let i = 0; i < expectDefined(pixels, 'tiny export pixels').length; i += 4) {
        if (pixels[i + 3] > 0) visiblePixels++
      }

      expect(visiblePixels).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })

  test('renderNodesToImage restores interactive LOD state after export', async () => {
    const exportGraph = new SceneGraph()
    const page = exportGraph.getPages()[0]
    exportGraph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    const surface = expectDefined(ck.MakeSurface(64, 64), 'export surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 64
    renderer.viewportHeight = 64
    renderer.dpr = 1
    renderer.zoom = 0.5
    renderer.minScreenSize = 4
    renderer.minScreenSizeForText = 100
    renderer.minScreenSizeForEffects = 9
    renderer._isViewportAnimating = true

    try {
      const png = renderNodesToImage(ck, renderer, exportGraph, page.id, [page.childIds[0]], {
        scale: 1,
        format: 'PNG'
      })
      expect(png).toBeTruthy()
      expect(renderer.minScreenSize).toBe(4)
      expect(renderer.minScreenSizeForText).toBe(100)
      expect(renderer.minScreenSizeForEffects).toBe(9)
      expect(renderer._isViewportAnimating).toBe(true)
    } finally {
      surface.delete()
    }
  })

  test('renderNodesToImage zeroes LOD thresholds during rendering not before setup', async () => {
    const exportGraph = new SceneGraph()
    const page = exportGraph.getPages()[0]
    exportGraph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    const surface = expectDefined(ck.MakeSurface(32, 32), 'export surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 32
    renderer.viewportHeight = 32
    renderer.dpr = 1
    renderer.zoom = 0.01
    renderer.minScreenSize = 4
    renderer.minScreenSizeForText = 100
    renderer.minScreenSizeForEffects = 9
    renderer._isViewportAnimating = true

    try {
      renderer.renderSceneToCanvas(surface.getCanvas(), exportGraph, page.id)
      expect(renderer._nodeCount).toBe(1)
      expect(renderer._culledCount).toBe(0)
      expect(renderer._lodCulledCount).toBe(0)
      expect(renderer._effectLodCulledCount).toBe(0)
      expect(renderer._textLodCulledCount).toBe(0)
      expect(renderer.minScreenSize).toBe(4)
      expect(renderer.minScreenSizeForText).toBe(100)
      expect(renderer.minScreenSizeForEffects).toBe(9)
      expect(renderer._isViewportAnimating).toBe(true)
    } finally {
      surface.delete()
    }
  })

  test('large graphs bypass the retained backing pipeline', async () => {
    // Create a graph with >500 descendants to trigger isLargeGraph.
    // Verify the backing pipeline is not used (sceneBacking stays null)
    // and the direct-render path is taken instead.
    const largeGraph = new SceneGraph()
    const page = largeGraph.getPages()[0]
    for (let i = 0; i < 501; i++) {
      largeGraph.createNode('RECTANGLE', page.id, {
        x: i * 2,
        y: 0,
        width: 10,
        height: 10,
        fills: [
          { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }
        ]
      })
    }

    const surface = expectDefined(ck.MakeSurface(400, 400), 'large graph surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 400
    renderer.viewportHeight = 400
    renderer.dpr = 1
    renderer.zoom = 1
    renderer.panX = 0
    renderer.panY = 0
    renderer.pageId = page.id
    await renderer.loadFonts()

    try {
      renderer.render(largeGraph, new Set(), {}, 1, 'scene')
      // The retained backing pipeline must not have been used for a large graph.
      // Without the !isLargeGraph guard, sceneBacking would be created.
      expect(renderer.sceneBacking).toBeNull()
      expect(renderer.profiler.stats.scenePictureMode).toBe('volatile')
    } finally {
      surface.delete()
    }
  })

  test('small-to-large graph transition frees retained WASM objects', async () => {
    // Start with a small graph, render it (creates a scenePicture/backing),
    // then expand it beyond 500 nodes. The old WASM objects must be freed.
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    const surface = expectDefined(ck.MakeSurface(200, 200), 'transition surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 200
    renderer.viewportHeight = 200
    renderer.dpr = 1
    renderer.zoom = 1
    renderer.panX = 0
    renderer.panY = 0
    renderer.pageId = page.id
    await renderer.loadFonts()

    try {
      // Render the small graph — scenePicture or backing may be created
      renderer.render(graph, new Set(), {}, 1)
      const hadScenePicture = renderer.scenePicture != null
      const hadBacking = renderer.sceneBacking != null

      // Expand the graph beyond the 500-node threshold
      for (let i = 1; i < 501; i++) {
        graph.createNode('RECTANGLE', page.id, {
          x: i * 2,
          y: 0,
          width: 10,
          height: 10,
          fills: [
            { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }
          ]
        })
      }

      // Render the now-large graph
      renderer.render(graph, new Set(), {}, 2)

      // After transitioning to large-graph mode, both scenePicture
      // and sceneBacking must be freed (invalidateScenePicture was called).
      // Without the cleanup, the old objects would leak in WASM memory.
      expect(renderer.scenePicture).toBeNull()
      expect(renderer.sceneBacking).toBeNull()
      expect(renderer.profiler.stats.scenePictureMode).toBe('volatile')

      // Verify the objects actually existed before the transition
      expect(hadScenePicture || hadBacking).toBe(true)
    } finally {
      surface.delete()
    }
  })
})
