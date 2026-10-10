import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { compositeOver } from '@open-pencil/scene-graph/color'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'

import { canvasLabelForeground } from './color'
import type { LabelHitOptions } from './hit-test'
import type { LabelLayout, LabelTextMetrics } from './layout'
import { frameLabelPlacement } from './transform'

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

/** A point inside a frame's drawn name, in world space. */
function frameTitlePoint(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  layout: LabelLayout,
  preview?: RotationPreview | null
): Vector {
  const placement = frameLabelPlacement(node, graph, preview)
  const angle = (placement.rotation * Math.PI) / 180
  const inside = {
    x: layout.text.x / r.zoom + 1 / r.zoom,
    y: (layout.text.y + layout.fontSize / 2) / r.zoom
  }
  return {
    x: placement.x + inside.x * Math.cos(angle) - inside.y * Math.sin(angle),
    y: placement.y + inside.x * Math.sin(angle) + inside.y * Math.cos(angle)
  }
}

function sectionContains(
  geometry: ReturnType<typeof createSceneGeometry>,
  section: SceneNode,
  point: Vector
): boolean {
  const inverse = Matrix.invert(geometry.worldMatrix(section))
  if (!inverse) return false
  const local = Matrix.mapPoint(inverse, point)
  return local.x >= 0 && local.y >= 0 && local.x <= section.width && local.y <= section.height
}

/**
 * What a frame's name is drawn over: the page, under every section around the frame that the name
 * falls inside, each section's visible fills stacked in order. A frame at a section's top edge has
 * its name above the section, over the page.
 */
function frameTitleBackground(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  layout: LabelLayout,
  preview?: RotationPreview | null
): Color {
  const point = frameTitlePoint(r, graph, node, layout, preview)
  const geometry = createSceneGeometry(graph, preview)
  const sections: SceneNode[] = []
  for (
    let ancestor = node.parentId ? graph.getNode(node.parentId) : undefined;
    ancestor;
    ancestor = ancestor.parentId ? graph.getNode(ancestor.parentId) : undefined
  ) {
    if (ancestor.type === 'SECTION' && sectionContains(geometry, ancestor, point))
      sections.unshift(ancestor)
  }
  let background = r.pageColor
  for (const section of sections) {
    for (const [index, fill] of section.fills.entries()) {
      if (fill.visible)
        background = compositeOver(r.resolveFillColor(fill, index, section, graph), background)
    }
  }
  return background
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
  layout: LabelLayout,
  highlighted: boolean,
  preview?: RotationPreview | null
) {
  if (highlighted) return r.selColor()
  const foreground = canvasLabelForeground(frameTitleBackground(r, graph, node, layout, preview))
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
  let color = frameTitleColor(r, graph, node, layout, false)
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
