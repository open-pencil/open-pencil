import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { LAYOUT_OUTLINE_DASH, LAYOUT_OUTLINE_GAP } from '#core/constants'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'

function isFlowLayout(node: SceneNode | undefined): node is SceneNode {
  return node?.layoutMode === 'HORIZONTAL' || node?.layoutMode === 'VERTICAL'
}

function visibleChildren(graph: SceneGraph, container: SceneNode) {
  return container.childIds
    .map((id) => graph.getNode(id))
    .filter((child): child is SceneNode => !!child && child.visible)
}

/** Strokes each node's box with the dotted auto layout outline, in the container's color. */
export function strokeLayoutOutlines(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  container: SceneNode,
  nodes: readonly SceneNode[],
  preview?: RotationPreview | null
): void {
  if (nodes.length === 0) return
  const geometry = createSceneGeometry(graph, preview)
  // MakeDash allocates a WASM PathEffect the JS GC won't reclaim; free it after drawing.
  const dash = r.ck.PathEffect.MakeDash(
    [LAYOUT_OUTLINE_DASH / r.zoom, LAYOUT_OUTLINE_GAP / r.zoom],
    0
  )
  r.auxStroke.setStrokeWidth(1 / r.zoom)
  r.auxStroke.setColor(r.outlineColor(container))
  r.auxStroke.setPathEffect(dash)
  try {
    for (const node of nodes) {
      canvas.save()
      canvas.concat(geometry.screenMatrix(node, r))
      canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.auxStroke)
      canvas.restore()
    }
  } finally {
    r.auxStroke.setPathEffect(null)
    dash.delete()
  }
}

/** Dotted outlines around the visible direct children of an auto layout frame. */
export function strokeLayoutChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  container: SceneNode,
  preview?: RotationPreview | null
): void {
  strokeLayoutOutlines(r, canvas, graph, container, visibleChildren(graph, container), preview)
}

/**
 * Dotted outlines that show how an auto layout frame arranges its children, as in Figma: around
 * the visible direct children of a hovered flow layout frame, and around the flow layout parent of
 * a single selected layer. Grid and plain frames show none, and none show while layers transform.
 */
export function drawLayoutOutlines(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: ReadonlySet<string>,
  hoveredNodeId: string | null | undefined,
  overlays: RenderOverlays
): void {
  if (overlays.transforming || overlays.marquee) return
  const preview = overlays.rotationPreview

  if (selectedIds.size === 1) {
    const [selectedId] = selectedIds
    const parentId = graph.getNode(selectedId)?.parentId
    const parent = parentId ? graph.getNode(parentId) : undefined
    if (isFlowLayout(parent) && parent.id !== hoveredNodeId) {
      strokeLayoutOutlines(r, canvas, graph, parent, [parent], preview)
    }
  }

  const hovered = hoveredNodeId ? graph.getNode(hoveredNodeId) : undefined
  if (isFlowLayout(hovered) && !selectedIds.has(hovered.id) && selectedIds.size <= 1) {
    strokeLayoutChildren(r, canvas, graph, hovered, preview)
  }
}
