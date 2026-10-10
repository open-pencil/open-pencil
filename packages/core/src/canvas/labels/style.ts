import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { compositeOver } from '@open-pencil/scene-graph/color'
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

/**
 * How strongly a frame's name shows while the frame is not selected or hovered. Figma desktop 126
 * fades it further on light backgrounds: dark text at 23% and light text at 50% come within ten
 * levels of its labels on light and dark pages and on white and dark sections.
 */
const FRAME_TITLE_ALPHA = { dark: 0.23, light: 0.5 } as const

/** What a frame's name is drawn over: its section's fill, or the page outside a section. */
function frameTitleBackground(r: SkiaRenderer, graph: SceneGraph, node: SceneNode): Color {
  const section = node.parentId
    ? graph.closest(node.parentId, (ancestor) => ancestor.type === 'SECTION')
    : undefined
  const fill = section?.fills.at(0)
  if (!section || !fill?.visible) return r.pageColor
  return compositeOver(r.resolveFillColor(fill, 0, section, graph), r.pageColor)
}

/**
 * A frame's name: the selection color while the frame is selected or hovered, otherwise the text
 * color of what it sits on, faded, so names read on light and dark pages and sections alike, as
 * Figma draws them on a white section of a dark page.
 */
export function frameTitleColor(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  highlighted: boolean
) {
  if (highlighted) return r.selColor()
  const foreground = canvasLabelForeground(frameTitleBackground(r, graph, node))
  const alpha = foreground.r < 0.5 ? FRAME_TITLE_ALPHA.dark : FRAME_TITLE_ALPHA.light
  return r.ck.Color4f(foreground.r, foreground.g, foreground.b, alpha)
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
  let color = frameTitleColor(r, graph, node, false)
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
