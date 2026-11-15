import { beforeAll, describe, expect, mock, test } from 'bun:test'

import {
  color,
  createGridScene,
  isPending,
  pixelAt,
  renderFramesWhile,
  renderUntilSettled,
  stillController
} from '#core-tests/canvas/renderer/tiles/helpers'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import type { ImagePreview, ImagePreviewDecoder } from '#core/canvas/images/previews'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

describe('tile page content changes', () => {
  function encodedSquare(r: number, g: number, b: number): Uint8Array {
    const surface = expectDefined(ck.MakeSurface(8, 8), 'image surface')
    surface.getCanvas().clear(ck.Color4f(r, g, b, 1))
    surface.flush()
    const image = surface.makeImageSnapshot()
    const bytes = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'image PNG')
    image.delete()
    surface.delete()
    return bytes
  }

  test('redraws only the tiles of an image once its preview decodes', async () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const hash = 'red-square'
    graph.images.set(hash, encodedSquare(1, 0, 0))
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 60,
      y: 40,
      width: 200,
      height: 160,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })
    graph.createNode('RECTANGLE', page.id, {
      x: 1000,
      y: 1000,
      width: 40,
      height: 40,
      fills: color(0, 0, 1)
    })
    const surface = expectDefined(ck.MakeSurface(320, 240), 'preview surface')
    const renderer = new SkiaRenderer(ck, surface)
    const controller = renderer.tiledScene
    renderer.pageId = page.id
    renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
    renderer.viewportWidth = 320
    renderer.viewportHeight = 240
    renderer.dpr = 1
    renderer.zoom = 1
    renderer.navigationPhase = 'idle'
    renderer.viewportImageRendering = true
    renderer.images.memoryGraph = graph
    let release: (() => void) | undefined
    const decoded = new Promise<void>((resolve) => {
      release = resolve
    })
    const edges: number[] = []
    const decoder: ImagePreviewDecoder = {
      decode: async (source, edge): Promise<ImagePreview> => {
        edges.push(edge)
        await decoded
        return { bytes: new Uint8Array(source), originalWidth: edge, originalHeight: edge }
      },
      destroy: mock()
    }
    renderer.images.previews.setDecoder(decoder)
    const ready: string[] = []
    renderer.images.onPreviewReady = (readyHash) => ready.push(readyHash)
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.WHITE)
      let result = renderFramesWhile(controller, { renderer, graph }, 10, isPending)
      expect(result.covered).toBe(true)
      // The preview is still decoding, so the image draws nothing yet.
      expect(pixelAt(ck, renderer.surface, 160, 120)).toEqual([255, 255, 255, 255])
      expect(renderer.images.fillUsers.get(hash)).toEqual(new Set([node.id]))

      expectDefined(release, 'release')()
      await decoded
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
      expect(ready).toEqual([hash])

      // The next frame invalidates only that node's tiles and renders them again.
      renderer.flushDecodedPreviews(graph)
      canvas.clear(ck.WHITE)
      result = renderFramesWhile(controller, { renderer, graph }, 10, isPending)
      expect(result.covered).toBe(true)
      expect(pixelAt(ck, renderer.surface, 160, 120)).toEqual([255, 0, 0, 255])
      expect(edges).toEqual([256])

      // Four times closer, the tiles record the chunk again with a preview for their level.
      renderer.zoom = 4
      renderer.images.detailScale = 4
      result = renderFramesWhile(controller, { renderer, graph }, 10, isPending, 1, 1)
      expect(edges).toEqual([256, 1024])
    } finally {
      renderer.destroy()
    }
  })

  test('a layer added to one page child keeps the tiles of the others', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    const controller = stillController()
    try {
      expect(renderUntilSettled(controller, { renderer, graph }).covered).toBe(true)
      const farTile = { pageId, level: 1, x: 2, y: 1 }
      expect(controller.isRendered(farTile)).toBe(true)

      // A new layer inside the first grid square: only its tile re-renders.
      const first = expectDefined(graph.getChildren(pageId)[0], 'first square')
      const added = graph.createNode('RECTANGLE', first.id, {
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        fills: color(1, 0, 0)
      })
      controller.invalidateStructure(added.id, first.id)
      expect(controller.hasPendingWork()).toBe(true)
      const changed = controller.renderFrame(renderer, surface.getCanvas(), graph, 2, 0)
      expect(controller.isRendered(farTile)).toBe(true)
      expect(changed.metrics.interruptibleCompleted + changed.metrics.mandatoryCompleted).toBe(1)
      expect(changed.covered).toBe(true)

      // Deleting it again touches only that tile too.
      graph.deleteNode(added.id)
      controller.invalidateStructure(added.id, first.id)
      const deleted = controller.renderFrame(renderer, surface.getCanvas(), graph, 3, 0)
      expect(controller.isRendered(farTile)).toBe(true)
      expect(deleted.metrics.interruptibleCompleted + deleted.metrics.mandatoryCompleted).toBe(1)
      expect(deleted.covered).toBe(true)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('a layer moved between frames leaves no ghost behind and appears where it went', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    const controller = stillController()
    try {
      // Two small frames, each one retained chunk, so a move must rebuild both chunks.
      const left = graph.createNode('FRAME', pageId, { x: 0, y: 400, width: 100, height: 100 })
      const right = graph.createNode('FRAME', pageId, { x: 200, y: 400, width: 100, height: 100 })
      const mover = graph.createNode('RECTANGLE', left.id, {
        x: 10,
        y: 10,
        width: 40,
        height: 40,
        fills: color(1, 0, 0)
      })
      const rgbAt = (x: number, y: number) => pixelAt(ck, surface, x, y).slice(0, 3)
      renderUntilSettled(controller, { renderer, graph })
      expect(rgbAt(30, 430)).toEqual([255, 0, 0])
      expect(rgbAt(230, 430)).toEqual([255, 255, 255])

      // Moved keeping its own coordinates, so it draws at the same offset in the other frame.
      graph.insertChildAt(mover.id, right.id, 0)
      // The editor reports a move to its new parent and to its old one.
      controller.invalidateStructure(mover.id, right.id)
      controller.invalidateStructure(mover.id, left.id)
      const moved = renderFramesWhile(controller, { renderer, graph }, 30, isPending, 2, 0)
      expect(moved.covered).toBe(true)
      expect(rgbAt(30, 430)).toEqual([255, 255, 255])
      expect(rgbAt(230, 430)).toEqual([255, 0, 0])
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('a font arrival redraws only the text that waited for it', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    const text = graph.createNode('TEXT', pageId, { x: 20, y: 20, width: 100, height: 30 })
    const controller = renderer.tiledScene
    try {
      const result = renderUntilSettled(controller, { renderer, graph })
      expect(result.covered).toBe(true)
      expect(result.backgroundPending).toBe(false)
      renderer.invalidateNodesForFonts(graph, [pageId])
      expect(controller.hasPendingWork()).toBe(true)
      const redraw = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(redraw.metrics.interruptibleCompleted).toBe(1)
      expect(controller.isRendered({ pageId, level: 1, x: 0, y: 0 })).toBe(true)
      void text
    } finally {
      renderer.destroy()
    }
  })
})
