import { describe, expect, mock, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { recordScenePicture } from '#core/canvas/renderer/pipeline'
import { renderNode } from '#core/canvas/scene'

import { expectDefined } from '#tests/helpers/assert'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
    concat: mock((_matrix: Mat3) => undefined),
    rotate: mock(() => undefined),
    scale: mock(() => undefined),
    saveLayer: mock(() => undefined),
    clipRect: mock(() => undefined),
    clipRRect: mock(() => undefined),
    drawPicture: mock(() => undefined)
  }
}

function createRenderer() {
  const rendered: string[] = []
  let observedViewport: { x: number; y: number; w: number; h: number } | undefined
  const recorder = {
    beginRecording: () => {
      const recCanvas = createCanvas()
      delete (recCanvas as { drawPicture?: unknown }).drawPicture
      return recCanvas
    },
    finishRecordingAsPicture: mock(() => ({})),
    delete: mock(() => undefined)
  }

  const renderer = {
    _nodeCount: 0,
    _culledCount: 0,
    worldViewport: { x: -100, y: -100, w: 300, h: 300 },
    opacityPaint: {
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    effectLayerPaint: {
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    ck: {
      BlendMode: { SrcOver: 'SrcOver' },
      ClipOp: { Intersect: 'Intersect' },
      RRectXY: mock(() => undefined),
      PathEffect: { MakeDash: mock(() => undefined) },
      LTRBRect: mock(
        (left: number, top: number, right: number, bottom: number) => [
          left,
          top,
          right,
          bottom
        ]
      ),
      PictureRecorder: mock(() => recorder)
    },
    getCachedBlur: mock(() => null),
    renderShape: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderSection: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderComponentSet: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderNode(canvas, graph, nodeId, overlays) {
      observedViewport = { ...this.worldViewport }
      renderNode(
        this as SkiaRenderer,
        canvas,
        graph,
        nodeId,
        overlays
      )
    },
    // Outstanding values that recordScenePicture writes/reads while recording.
    fontGeneration: 0,
    pageId: 'page',
    panX: 0,
    panY: 0,
    zoom: 1,
    viewportWidth: 800,
    viewportHeight: 600,
    scenePicture: null,
    scenePictureVersion: 0,
    scenePictureFontGeneration: 0,
    scenePicturePositionPreviewVersion: 0,
    scenePicturePageId: null
  }
  return {
    renderer: renderer as SkiaRenderer,
    rendered,
    readObservedViewport: () => observedViewport
  }
}

describe('recordScenePicture viewport culling', () => {
  test('records a finite viewport (not an infinite one) around the visible region', () => {
    const graph = new SceneGraph()
    graph.createNode('VECTOR', pageId(graph), { x: 0, y: 0, width: 100, height: 100 })
    const { renderer, readObservedViewport } = createRenderer()
    renderer.pageId = pageId(graph)
    const canvas = createCanvas()

    const expected = {
      x: -800,
      y: -600,
      w: 2400,
      h: 1800
    }

    recordScenePicture(renderer, canvas, graph, 1)

    const observed = readObservedViewport()
    const viewport = expectDefined(observed, 'viewport observed while recording')
    expect(viewport.x).toBe(expected.x)
    expect(viewport.y).toBe(expected.y)
    expect(viewport.w).toBe(expected.w)
    expect(viewport.h).toBe(expected.h)
  })

  test('restores the previous viewport after recording', () => {
    const graph = new SceneGraph()
    const { renderer } = createRenderer()
    renderer.pageId = pageId(graph)
    const canvas = createCanvas()
    const prev = { x: -100, y: -100, w: 300, h: 300 }
    renderer.worldViewport = { ...prev }

    recordScenePicture(renderer, canvas, graph, 1)

    expect(renderer.worldViewport).toEqual(prev)
  })

  test('culls off-screen nodes so the fallback picture stays bounded by the viewport', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)
    const visible = graph.createNode('VECTOR', pid, {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    const farOffscreen = graph.createNode('VECTOR', pid, {
      x: 1e6,
      y: 0,
      width: 100,
      height: 100
    })
    // Inside the 3x3 viewport margin (cull box -800..1600) but beyond the 800-wide core: still recorded.
    const inMargin = graph.createNode('VECTOR', pid, {
      x: 1200,
      y: 0,
      width: 100,
      height: 100
    })
    const { renderer, rendered } = createRenderer()
    renderer.pageId = pid

    recordScenePicture(renderer, createCanvas(), graph, 1)

    expect(rendered).toContain(visible.id)
    expect(rendered).toContain(inMargin.id)
    expect(rendered).not.toContain(farOffscreen.id)
    expect(renderer._nodeCount).toBe(3)
    expect(renderer._culledCount).toBe(1)
  })
})