import type { CanvasKit } from 'canvaskit-wasm'
import { isEqual } from 'es-toolkit'

import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { newStrokeGeometry } from '@open-pencil/scene-graph/node-defaults'
import type { Color } from '@open-pencil/scene-graph/primitives'
import type { UndoManager } from '@open-pencil/scene-graph/undo'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { getPageColor } from '#core/figma-api/page-backgrounds'

/** Which paint of the selection a sampled colour replaces. Alt samples into the stroke. */
export type EyedropperTarget = 'fill' | 'stroke'

type SampleRenderer = Pick<
  SkiaRenderer,
  'worldViewport' | 'viewportImageRendering' | 'presentationColorSpace' | 'renderNode'
>

/** A square of the document's pixels: RGBA rows, `size` pixels a side, the centre one sampled. */
export interface ScenePixels {
  size: number
  data: Uint8Array
}

/**
 * The document's pixels in a square of `size` (odd) pixels centred on a world point, each
 * `1 / scale` world units wide, composited over the page background, so at the view's zoom they
 * are the pixels the screen shows there.
 *
 * Renders only what intersects the square into a raster surface, so selection chrome, rulers and
 * the screen's colour profile never leak into the result, unlike `window.EyeDropper`, which
 * samples the screen. Components come back in the document's own colour space: the renderer
 * presents in that space and the surface is not converted.
 */
export function sampleScenePixels(
  ck: CanvasKit,
  renderer: SampleRenderer,
  graph: SceneGraph,
  pageId: string,
  x: number,
  y: number,
  size = 1,
  scale = 1
): ScenePixels | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (!Number.isInteger(size) || size < 1 || size % 2 === 0 || !(scale > 0)) return null
  const page = graph.getNode(pageId)
  if (!page) return null
  const surface = ck.MakeSurface(size, size)
  if (!surface) return null
  const previousViewport = renderer.worldViewport
  const previousImageRendering = renderer.viewportImageRendering
  const previousColorSpace = renderer.presentationColorSpace
  try {
    const canvas = surface.getCanvas()
    const background = getPageColor(page)
    canvas.clear(ck.Color4f(background.r, background.g, background.b, 1))
    // Pixel (i, j) covers [i, i + 1); put the sampled point at the centre pixel's centre.
    const half = (size - 1) / 2
    canvas.translate(half + 0.5, half + 0.5)
    canvas.scale(scale, scale)
    canvas.translate(-x, -y)
    const reach = (half + 1) / scale
    renderer.worldViewport = { x: x - reach, y: y - reach, w: reach * 2, h: reach * 2 }
    renderer.viewportImageRendering = false
    renderer.presentationColorSpace = graph.documentColorSpace
    for (const childId of page.childIds) renderer.renderNode(canvas, graph, childId, {})
    surface.flush()
    const data = canvas.readPixels(0, 0, {
      width: size,
      height: size,
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB
    })
    if (!(data instanceof Uint8Array) || data.length < size * size * 4) return null
    return { size, data }
  } finally {
    renderer.worldViewport = previousViewport
    renderer.viewportImageRendering = previousImageRendering
    renderer.presentationColorSpace = previousColorSpace
    surface.delete()
  }
}

/** The opaque colour of one pixel of a sample, by column and row. */
export function scenePixelColor(pixels: ScenePixels, column: number, row: number): Color {
  const at = (row * pixels.size + column) * 4
  const { data } = pixels
  return { r: data[at] / 255, g: data[at + 1] / 255, b: data[at + 2] / 255, a: 1 }
}

/** The colour the document shows at a world point, one `1 / scale`-wide pixel of it. */
export function sampleSceneColor(
  ck: CanvasKit,
  renderer: SampleRenderer,
  graph: SceneGraph,
  pageId: string,
  x: number,
  y: number,
  scale = 1
): Color | null {
  const pixels = sampleScenePixels(ck, renderer, graph, pageId, x, y, 1, scale)
  return pixels ? scenePixelColor(pixels, 0, 0) : null
}

function solidPaint(color: Color): Fill {
  return { type: 'SOLID', color: { ...color, a: 1 }, opacity: 1, visible: true }
}

/**
 * Replaces the top solid paint's colour, keeping its opacity, or adds an opaque solid paint. A
 * solid paint's alpha is its opacity, as the colour picker writes them, so the alpha stays too.
 */
function withSampledPaint<T extends Fill>(
  paints: readonly T[],
  color: Color,
  create: (paint: Fill) => T
): { paints: T[]; index: number } {
  const next = paints.map((paint) => ({ ...paint }))
  for (let index = next.length - 1; index >= 0; index--) {
    if (next[index].type !== 'SOLID') continue
    next[index] = { ...next[index], color: { ...color, a: next[index].color.a } }
    return { paints: next, index }
  }
  next.push(create(solidPaint(color)))
  return { paints: next, index: next.length - 1 }
}

export function eyedropperChanges(
  node: SceneNode,
  color: Color,
  target: EyedropperTarget
): Partial<SceneNode> {
  const boundVariables = { ...node.boundVariables }
  if (target === 'stroke') {
    // A first stroke takes the weight and alignment the node keeps for its strokes.
    const { paints, index } = withSampledPaint<Stroke>(node.strokes, color, (paint) => ({
      ...paint,
      ...newStrokeGeometry(node)
    }))
    delete boundVariables[`strokes/${index}/color`]
    return { strokes: paints, boundVariables }
  }
  const { paints, index } = withSampledPaint<Fill>(node.fills, color, (paint) => paint)
  delete boundVariables[`fills/${index}/color`]
  const changes: Partial<SceneNode> = { fills: paints, boundVariables }
  // Text colour lives in the node fills; per-character fills would hide the sample.
  if (node.type === 'TEXT' && node.styleRuns.some((run) => run.style.fills)) {
    changes.styleRuns = node.styleRuns.map((run) => {
      const style = { ...run.style }
      delete style.fills
      return { ...run, style }
    })
  }
  return changes
}

interface EyedropperEditor {
  graph: SceneGraph
  undo: UndoManager
  state: { selectedIds: ReadonlySet<string> }
  updateNodeWithUndo: (id: string, changes: Partial<SceneNode>, label?: string) => void
}

/** Whether the changes would leave the layer as it is, as when it already has the colour. */
function changesNothing(node: SceneNode, changes: Partial<SceneNode>): boolean {
  return Object.entries(changes).every(([key, value]) =>
    isEqual(node[key as keyof SceneNode], value)
  )
}

/**
 * Applies a sampled colour to every selected layer that can take a paint, as one undo step.
 * Layers that already show it are left alone, so a sample that changes nothing records nothing.
 * Returns how many layers changed.
 */
export function applySampledColor(
  editor: EyedropperEditor,
  color: Color,
  target: EyedropperTarget = 'fill'
): number {
  const nodes = [...editor.state.selectedIds]
    .map((id) => editor.graph.getNode(id))
    .filter((node): node is SceneNode => node !== undefined && !node.locked)
    .filter((node) => node.type !== 'GROUP')
  const edits = nodes
    .map((node) => ({ node, changes: eyedropperChanges(node, color, target) }))
    .filter(({ node, changes }) => !changesNothing(node, changes))
  if (edits.length === 0) return 0
  editor.undo.runBatch('Eyedropper', () => {
    for (const { node, changes } of edits) {
      editor.updateNodeWithUndo(node.id, changes, 'Eyedropper')
    }
  })
  return edits.length
}
