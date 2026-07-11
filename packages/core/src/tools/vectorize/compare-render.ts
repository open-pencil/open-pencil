import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import { SceneGraph, type SceneGraph as SceneGraphType } from '@open-pencil/scene-graph'
import type { Color, Rect, Size } from '@open-pencil/scene-graph/primitives'

import { SkiaRenderer } from '#core/canvas'
import { BLACK, TRANSPARENT } from '#core/constants'
import { vectorNetworkToPath } from '#core/vector'

import { createVectorFrameChildren, resolveVectorFramePlacement } from './placement'
import { svgToVectorPaths, type SVGVectorizeResult } from './svg/to-vectors'

export type VectorizeCompareTargets = Size

export interface VectorizeCompareMetrics {
  targetWidth: number
  targetHeight: number
  pathCount: number
  contentBounds: Rect
  differentPixels: number
  differentPercent: number
  identical: boolean
}

function parseBackground(value: string | undefined): Color {
  if (value === 'transparent') return TRANSPARENT
  return BLACK
}

function renderTargetsToPNG(
  ck: CanvasKit,
  targets: VectorizeCompareTargets,
  background: Color,
  draw: (renderer: SkiaRenderer, canvas: Canvas) => void
): Uint8Array | null {
  const surface = ck.MakeSurface(targets.width, targets.height)
  if (!surface) return null

  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = targets.width
  renderer.viewportHeight = targets.height
  renderer.dpr = 1
  renderer.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }

  const canvas = surface.getCanvas()
  canvas.clear(ck.Color4f(background.r, background.g, background.b, background.a))
  draw(renderer, canvas)

  surface.flush()
  const image = surface.makeImageSnapshot()
  const encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100)
  image.delete()
  surface.delete()
  return encoded ? new Uint8Array(encoded) : null
}

/** Flat composition of scaled SVG paths — reference for vendor geometry in target bounds. */
export function renderRawSVGVectorPaths(
  ck: CanvasKit,
  vectorized: SVGVectorizeResult,
  targets: VectorizeCompareTargets,
  background: Color
): Uint8Array | null {
  return renderTargetsToPNG(ck, targets, background, (renderer, canvas) => {
    for (const path of vectorized.paths) {
      const skPaths = vectorNetworkToPath(ck, path.vectorNetwork)
      for (const fill of path.fills) {
        if (!fill.visible || fill.type !== 'SOLID') continue
        const color = fill.color
        renderer.fillPaint.setColor(ck.Color4f(color.r, color.g, color.b, color.a * fill.opacity))
        for (const skPath of skPaths) {
          canvas.drawPath(skPath, renderer.fillPaint)
        }
      }
      for (const stroke of path.strokes) {
        if (!stroke.visible) continue
        const color = stroke.color
        renderer.strokePaint.setColor(
          ck.Color4f(color.r, color.g, color.b, color.a * stroke.opacity)
        )
        renderer.strokePaint.setStrokeWidth(stroke.weight)
        for (const skPath of skPaths) {
          canvas.drawPath(skPath, renderer.strokePaint)
        }
      }
      for (const skPath of skPaths) skPath.delete()
    }
  })
}

/** Scene graph produced by the same import path as vectorize-image (frame + per-path vectors). */
export function buildImportedVectorFrame(
  graph: SceneGraphType,
  parentId: string,
  vectorized: SVGVectorizeResult,
  targets: VectorizeCompareTargets
): string {
  const placement = resolveVectorFramePlacement(
    { x: 0, y: 0, width: targets.width, height: targets.height },
    vectorized.contentBounds
  )

  const frame = graph.createNode('FRAME', parentId, {
    name: 'Vectorize compare',
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    fills: []
  })

  createVectorFrameChildren(graph, frame.id, vectorized, placement)
  return frame.id
}

/** Render imported frame on a fixed target canvas (same dimensions as raw SVG reference). */
export function renderImportedVectorFrame(
  ck: CanvasKit,
  graph: SceneGraphType,
  frameId: string,
  targets: VectorizeCompareTargets,
  background: Color
): Uint8Array | null {
  return renderTargetsToPNG(ck, targets, background, (renderer, canvas) => {
    renderer.renderNode(canvas, graph, frameId, {})
  })
}

export function compareVectorizeRenders(
  ck: CanvasKit,
  rawPng: Uint8Array,
  importedPng: Uint8Array
): { differentPixels: number; differentPercent: number; identical: boolean } {
  const rawImage = ck.MakeImageFromEncoded(rawPng)
  const importedImage = ck.MakeImageFromEncoded(importedPng)
  if (!rawImage || !importedImage) {
    rawImage?.delete()
    importedImage?.delete()
    return { differentPixels: -1, differentPercent: 100, identical: false }
  }

  const width = Math.min(rawImage.width(), importedImage.width())
  const height = Math.min(rawImage.height(), importedImage.height())
  const readOpts = {
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width,
    height
  } as const

  const rawPixels = rawImage.readPixels(0, 0, readOpts)
  const importedPixels = importedImage.readPixels(0, 0, readOpts)
  rawImage.delete()
  importedImage.delete()

  if (!rawPixels || !importedPixels) {
    return { differentPixels: -1, differentPercent: 100, identical: false }
  }

  let differentPixels = 0
  const total = width * height
  for (let i = 0; i < total; i++) {
    const offset = i * 4
    const dr = Math.abs(rawPixels[offset] - importedPixels[offset])
    const dg = Math.abs(rawPixels[offset + 1] - importedPixels[offset + 1])
    const db = Math.abs(rawPixels[offset + 2] - importedPixels[offset + 2])
    const da = Math.abs(rawPixels[offset + 3] - importedPixels[offset + 3])
    if (dr > 0 || dg > 0 || db > 0 || da > 0) differentPixels++
  }

  const differentPercent = total > 0 ? (differentPixels / total) * 100 : 0
  return {
    differentPixels,
    differentPercent: Number(differentPercent.toFixed(4)),
    identical: differentPixels === 0
  }
}

export function renderVectorizeComparison(
  ck: CanvasKit,
  svgText: string,
  targets: VectorizeCompareTargets,
  options?: { background?: string }
): {
  vectorized: SVGVectorizeResult
  rawPng: Uint8Array
  importedPng: Uint8Array
  metrics: VectorizeCompareMetrics
} | null {
  const vectorized = svgToVectorPaths(svgText, targets)
  if (!vectorized || vectorized.paths.length === 0) return null

  const background = parseBackground(options?.background)
  const rawPng = renderRawSVGVectorPaths(ck, vectorized, targets, background)
  if (!rawPng) return null

  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const frameId = buildImportedVectorFrame(graph, pageId, vectorized, targets)

  const importedPng = renderImportedVectorFrame(ck, graph, frameId, targets, background)
  if (!importedPng) return null

  const compare = compareVectorizeRenders(ck, rawPng, importedPng)
  return {
    vectorized,
    rawPng,
    importedPng,
    metrics: {
      targetWidth: targets.width,
      targetHeight: targets.height,
      pathCount: vectorized.paths.length,
      contentBounds: vectorized.contentBounds,
      differentPixels: compare.differentPixels,
      differentPercent: compare.differentPercent,
      identical: compare.identical
    }
  }
}
