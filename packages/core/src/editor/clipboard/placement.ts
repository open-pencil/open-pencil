import { isNotNil } from 'es-toolkit/predicate'

import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { DUPLICATE_FRAME_GAP } from '#core/constants'
import type { EditorContext } from '#core/editor/types'

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

export function createClipboardPlacementActions(ctx: EditorContext) {
  function centerNodesAt(nodeIds: string[], cx: number, cy: number) {
    const items = nodeIds.map((id) => ctx.graph.getNode(id)).filter(isNotNil)
    const bounds = computeBounds(items)
    if (bounds.width === 0 && bounds.height === 0 && items.length === 0) return
    translate(nodeIds, cx - (bounds.x + bounds.width / 2), cy - (bounds.y + bounds.height / 2))
  }

  /**
   * Where Figma puts a lone duplicate: on top of the original, except that a top-level frame, on
   * the page or in a section, goes to the first free place on its right.
   */
  function duplicatePosition(node: SceneNode, placed: readonly Rect[]): Vector {
    const parentId = node.parentId ?? ctx.state.currentPageId
    const parent = ctx.graph.getNode(parentId)
    const topLevel = !parent || parent.type === 'CANVAS' || parent.type === 'SECTION'
    if (node.type !== 'FRAME' || !topLevel) return { x: node.x, y: node.y }

    const box = getAxisAlignedBoundsInParent([node], parentId, ctx.graph)
    const others = [
      ...ctx.graph
        .getChildren(parentId)
        .map((sibling) => getAxisAlignedBoundsInParent([sibling], parentId, ctx.graph)),
      ...placed
    ]
    const candidate = { ...box, x: box.x + box.width + DUPLICATE_FRAME_GAP }
    for (;;) {
      const blocker = others.find((other) => overlaps(candidate, other))
      if (!blocker) break
      candidate.x = blocker.x + blocker.width + DUPLICATE_FRAME_GAP
    }
    return { x: node.x + candidate.x - box.x, y: node.y }
  }

  function translate(nodeIds: string[], dx: number, dy: number) {
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (node) ctx.graph.updateNode(id, { x: node.x + dx, y: node.y + dy })
    }
  }

  /** The visible part of the canvas, or null when the editor has no viewport. */
  function viewportRect(): Rect | null {
    const { width, height } = ctx.getViewportSize()
    if (width <= 0 || height <= 0) return null
    const { panX, panY, zoom } = ctx.state
    return { x: -panX / zoom, y: -panY / zoom, width: width / zoom, height: height / zoom }
  }

  /**
   * Places pasted layers as Figma does. Layers copied out of a frame keep their offset inside the
   * frame they are pasted into; top-level layers keep their place on the canvas. An axis that
   * does not fit inside the destination frame is centered in it, and layers that would land out
   * of view are centered in the view.
   */
  function placePasted(nodeIds: string[], sourceParentId: string | undefined, targetId: string) {
    const items = nodeIds.map((id) => ctx.graph.getNode(id)).filter(isNotNil)
    if (items.length === 0) return
    const target = ctx.graph.getNode(targetId)
    const source = sourceParentId ? ctx.graph.getNode(sourceParentId) : undefined
    const toCanvas = (node: SceneNode | undefined) =>
      node && node.type !== 'CANVAS' ? ctx.graph.getAbsolutePosition(node.id) : { x: 0, y: 0 }

    // Copied coordinates are relative to the source frame, or absolute for top-level layers.
    const relative = source !== undefined && source.type !== 'CANVAS'
    if (!relative || target?.type === 'CANVAS') {
      const from = relative ? toCanvas(source) : { x: 0, y: 0 }
      const to = toCanvas(target)
      translate(nodeIds, from.x - to.x, from.y - to.y)
    }

    if (target && target.type !== 'CANVAS') {
      const box = computeBounds(items)
      const fitsX = box.x >= 0 && box.x + box.width <= target.width
      const fitsY = box.y >= 0 && box.y + box.height <= target.height
      translate(
        nodeIds,
        fitsX ? 0 : (target.width - box.width) / 2 - box.x,
        fitsY ? 0 : (target.height - box.height) / 2 - box.y
      )
    }

    const view = viewportRect()
    if (!view) return
    const origin = toCanvas(target)
    const box = computeBounds(items)
    if (!overlaps({ ...box, x: box.x + origin.x, y: box.y + origin.y }, view)) {
      centerNodesAt(
        nodeIds,
        view.x + view.width / 2 - origin.x,
        view.y + view.height / 2 - origin.y
      )
    }
  }

  /** Centers layers of `parentId` on a canvas point. */
  function centerNodesAtCanvasPoint(nodeIds: string[], parentId: string, point: Vector) {
    const parent = ctx.graph.getNode(parentId)
    const origin =
      parent && parent.type !== 'CANVAS' ? ctx.graph.getAbsolutePosition(parentId) : { x: 0, y: 0 }
    centerNodesAt(nodeIds, point.x - origin.x, point.y - origin.y)
  }

  return { centerNodesAt, centerNodesAtCanvasPoint, duplicatePosition, placePasted }
}
