import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { RotationPreview } from '#core/geometry'

import { canvasLabelForeground } from './color'
import type { LabelHitOptions } from './hit-test'
import type { LabelLayout, LabelTextMetrics } from './layout'

export function sectionLabelColors(r: SkiaRenderer, graph: SceneGraph, node: SceneNode) {
  const background: Color =
    node.fills.length > 0 && node.fills[0].visible
      ? r.resolveFillColor(node.fills[0], 0, node, graph)
      : { r: 0.37, g: 0.37, b: 0.37, a: 1 }
  const foreground = canvasLabelForeground(background, r.pageColor)
  return {
    background,
    border: r.ck.Color4f(foreground.r, foreground.g, foreground.b, 0.22),
    hover: r.ck.Color4f(foreground.r, foreground.g, foreground.b, 0.08),
    foreground: r.ck.Color4f(foreground.r, foreground.g, foreground.b, foreground.a)
  }
}

/** How far a frame's name fades into the canvas while the frame is not selected or hovered. */
const FRAME_TITLE_MUTED_ALPHA = 0.5

/**
 * A top-level frame's name: the selection color while the frame is selected or hovered, otherwise
 * the canvas's own text color, faded, so names read on light and dark canvases alike.
 */
export function frameTitleColor(r: SkiaRenderer, highlighted: boolean) {
  if (highlighted) return r.selColor()
  const foreground = canvasLabelForeground(r.pageColor)
  return r.ck.Color4f(foreground.r, foreground.g, foreground.b, FRAME_TITLE_MUTED_ALPHA)
}

/** Hit-testing reuses the same shaped paragraphs, constraints and paint keys as drawing. */
export function measureLabel(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  layout: LabelLayout
): LabelTextMetrics | null {
  const provider = r.fontProvider
  if (!provider) return null
  let color = frameTitleColor(r, false)
  if (layout.kind === 'section') color = sectionLabelColors(r, graph, node).foreground
  else if (layout.kind === 'component') color = r.compColor()
  return r.labelParagraphCache.measure(
    r.ck,
    provider,
    node.name,
    layout.fontSize,
    layout.maxTextWidth,
    color,
    r.fontGeneration,
    layout.fontWeight
  )
}

export function labelHitOptions(
  r: SkiaRenderer,
  graph: SceneGraph,
  preview?: RotationPreview | null
): LabelHitOptions {
  return {
    preview,
    viewport: r.worldViewport,
    measure: (node: SceneNode, layout: LabelLayout) => measureLabel(r, graph, node, layout)
  }
}
