import type { CanvasKit } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
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

/**
 * The colour the document shows at a world point, composited over the page background.
 *
 * Renders only what intersects the sampled pixel into a 1x1 raster surface, so selection
 * chrome, rulers and the screen's colour profile never leak into the result, unlike
 * `window.EyeDropper`, which samples the screen. Components come back in the document's
 * own colour space: the renderer presents in that space and the surface is not converted.
 */
export function sampleSceneColor(
  ck: CanvasKit,
  renderer: SampleRenderer,
  graph: SceneGraph,
  pageId: string,
  x: number,
  y: number
): Color | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const page = graph.getNode(pageId)
  if (!page) return null
  const surface = ck.MakeSurface(1, 1)
  if (!surface) return null
  const previousViewport = renderer.worldViewport
  const previousImageRendering = renderer.viewportImageRendering
  const previousColorSpace = renderer.presentationColorSpace
  try {
    const canvas = surface.getCanvas()
    const background = getPageColor(page)
    canvas.clear(ck.Color4f(background.r, background.g, background.b, 1))
    // Pixel (0, 0) covers [0, 1); put the sampled point at its centre.
    canvas.translate(0.5 - x, 0.5 - y)
    renderer.worldViewport = { x: x - 1, y: y - 1, w: 2, h: 2 }
    renderer.viewportImageRendering = false
    renderer.presentationColorSpace = graph.documentColorSpace
    for (const childId of page.childIds) renderer.renderNode(canvas, graph, childId, {})
    surface.flush()
    const pixels = canvas.readPixels(0, 0, {
      width: 1,
      height: 1,
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB
    })
    if (!pixels || pixels.length < 4) return null
    return { r: pixels[0] / 255, g: pixels[1] / 255, b: pixels[2] / 255, a: 1 }
  } finally {
    renderer.worldViewport = previousViewport
    renderer.viewportImageRendering = previousImageRendering
    renderer.presentationColorSpace = previousColorSpace
    surface.delete()
  }
}

function solidPaint(color: Color): Fill {
  return { type: 'SOLID', color: { ...color, a: 1 }, opacity: 1, visible: true }
}

/** Replaces the top solid paint's colour, keeping its opacity, or adds a solid paint. */
function withSampledPaint<T extends Fill>(
  paints: readonly T[],
  color: Color,
  create: (paint: Fill) => T
): { paints: T[]; index: number } {
  const next = paints.map((paint) => ({ ...paint }))
  for (let index = next.length - 1; index >= 0; index--) {
    if (next[index].type !== 'SOLID') continue
    next[index] = { ...next[index], color: { ...color, a: 1 } }
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
    const { paints, index } = withSampledPaint<Stroke>(node.strokes, color, (paint) => ({
      ...paint,
      weight: 1,
      align: 'INSIDE'
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

/**
 * Applies a sampled colour to every selected layer that can take a paint, as one undo step.
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
  if (nodes.length === 0) return 0
  editor.undo.runBatch('Eyedropper', () => {
    for (const node of nodes) {
      editor.updateNodeWithUndo(node.id, eyedropperChanges(node, color, target), 'Eyedropper')
    }
  })
  return nodes.length
}
