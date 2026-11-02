import { groupBy } from 'es-toolkit'
import { isNotNil } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@lawha/scene-graph'
import {
  getAxisAlignedBoundsInParent,
  getAxisAlignedWorldBounds,
  getNodeLocalMatrix,
  getParentWorldMatrix,
  getWorldMatrix,
  localTransformFromWorld
} from '@lawha/scene-graph/coordinate'
import { computeBounds } from '@lawha/scene-graph/geometry'
import Matrix, { type Mat3 } from '@lawha/scene-graph/matrix'
import type { Rect, Vector } from '@lawha/scene-graph/primitives'

import { DUPLICATE_FRAME_GAP } from '#core/constants'
import type { EditorContext } from '#core/editor/types'

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** The frame or section a layer was copied out of, and its box on the canvas then. */
export interface ClipboardSource {
  id: string
  box: Rect
}

/** Where copied layers sat on the canvas, which paste keeps as Figma does. */
export interface ClipboardPlacement {
  /** Each copied layer's canvas transform, in the order of the copied layers. */
  transforms: Mat3[]
  /** Where each copied layer came from; null for a top-level layer. */
  sources: Array<ClipboardSource | null>
}

/**
 * The placement of copied layers whose parents, if this document has them, are where they were
 * copied from. A layer whose parent it lacks counts as top-level.
 */
export function clipboardPlacement(
  graph: SceneGraph,
  roots: readonly SceneNode[]
): ClipboardPlacement {
  const parentOf = (node: SceneNode) => (node.parentId ? graph.getNode(node.parentId) : undefined)
  const transforms = roots.map((node) =>
    Matrix.multiply(getParentWorldMatrix(parentOf(node), graph), getNodeLocalMatrix(node))
  )
  const sources = roots.map((node) => {
    const parent = parentOf(node)
    if (!parent || parent.type === 'CANVAS' || parent.id === graph.rootId) return null
    return { id: parent.id, box: getAxisAlignedWorldBounds(parent, graph) }
  })
  return { transforms, sources }
}

/** The canvas box around layers, through every rotation and flip above them. */
function canvasBounds(graph: SceneGraph, nodes: readonly SceneNode[]): Rect {
  return getAxisAlignedBoundsInParent(nodes, graph.rootId, graph)
}

/** Moves layers by a distance on the canvas, whatever their parents' rotation and flips. */
export function translateOnCanvas(
  graph: SceneGraph,
  nodeIds: readonly string[],
  dx: number,
  dy: number
) {
  if (dx === 0 && dy === 0) return
  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node) continue
    const parent = node.parentId ? graph.getNode(node.parentId) : undefined
    const toParent = Matrix.invert(getParentWorldMatrix(parent, graph))
    if (!toParent) continue
    const origin = Matrix.mapPoint(toParent, { x: 0, y: 0 })
    const moved = Matrix.mapPoint(toParent, { x: dx, y: dy })
    graph.updateNode(id, { x: node.x + moved.x - origin.x, y: node.y + moved.y - origin.y })
  }
}

/**
 * How far Figma moves pasted layers that come from one place to keep them in their frame's
 * canvas box. An axis counts as outside when the layers start at or past the frame's far edge,
 * or, for top-level layers, when they miss the frame on it; layers overlapping an edge stay. If
 * an axis is outside, layers that fit in the frame are centred on the outside axes; larger ones
 * go to the frame's top-left when they came out of a frame, or are centred when top-level.
 */
function frameFitShift(box: Rect, frame: Rect, fromFrame: boolean): Vector {
  const outside = (start: number, size: number, frameStart: number, frameSize: number) => {
    const offset = start - frameStart
    return offset >= frameSize || (!fromFrame && offset + size <= 0)
  }
  const outX = outside(box.x, box.width, frame.x, frame.width)
  const outY = outside(box.y, box.height, frame.y, frame.height)
  if (!outX && !outY) return { x: 0, y: 0 }
  const centred = {
    x: frame.x + (frame.width - box.width) / 2 - box.x,
    y: frame.y + (frame.height - box.height) / 2 - box.y
  }
  if (box.width <= frame.width && box.height <= frame.height)
    return { x: outX ? centred.x : 0, y: outY ? centred.y : 0 }
  return fromFrame ? { x: frame.x - box.x, y: frame.y - box.y } : centred
}

export function createClipboardPlacementActions(ctx: EditorContext) {
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

  /** Centers each axis of the layers that does not fit inside their frame. */
  function fitInside(nodeIds: string[], parentId: string) {
    const parent = ctx.graph.getNode(parentId)
    const items = nodeIds.map((id) => ctx.graph.getNode(id)).filter(isNotNil)
    if (!parent || parent.type === 'CANVAS' || items.length === 0) return
    const box = computeBounds(items)
    const fitsX = box.x >= 0 && box.x + box.width <= parent.width
    const fitsY = box.y >= 0 && box.y + box.height <= parent.height
    translate(
      nodeIds,
      fitsX ? 0 : (parent.width - box.width) / 2 - box.x,
      fitsY ? 0 : (parent.height - box.height) / 2 - box.y
    )
  }

  /**
   * Places layers pasted from another app, whose copied position means nothing here: at the
   * cursor for Paste here, otherwise in the middle of the view and inside the frame they go into.
   */
  function placeForeignPaste(nodeIds: string[], parentId: string, cursor?: Vector) {
    if (cursor) {
      centerNodesAtCanvasPoint(nodeIds, cursor)
      return
    }
    const view = viewportRect()
    if (view)
      centerNodesAtCanvasPoint(nodeIds, {
        x: view.x + view.width / 2,
        y: view.y + view.height / 2
      })
    fitInside(nodeIds, parentId)
  }

  function nodesOf(nodeIds: readonly string[]) {
    return nodeIds.map((id) => ctx.graph.getNode(id)).filter(isNotNil)
  }

  /** Centers layers over another layer, wherever that layer sits. */
  function centerOver(nodeIds: string[], overId: string) {
    const over = ctx.graph.getNode(overId)
    if (!over) return
    centerNodesAtCanvasPoint(
      nodeIds,
      Matrix.mapPoint(getWorldMatrix(over, ctx.graph), { x: over.width / 2, y: over.height / 2 })
    )
  }

  /** Turns and flips pasted layers back to how they were drawn when copied, as Figma keeps them. */
  function keepCanvasTransforms(nodeIds: readonly string[], transforms: readonly Mat3[]) {
    for (const [index, world] of transforms.entries()) {
      const id = nodeIds.at(index)
      const node = id ? ctx.graph.getNode(id) : undefined
      if (!id || !node) continue
      const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
      const local = localTransformFromWorld(node, world, getParentWorldMatrix(parent, ctx.graph))
      if (local) ctx.graph.updateNode(id, local)
    }
  }

  /**
   * Places pasted layers as Figma does, in canvas boxes so a rotated or flipped frame changes
   * nothing. Layers copied out of a frame keep their offset from its box in the box of the frame
   * they are pasted into; top-level layers keep their place on the canvas. Layers Figma counts as
   * outside the destination frame move into it (`frameFitShift`), and layers that would land out
   * of view are centred in the view. A paste that could not go into the selected layer (`requestedId`), such
   * as an instance into its own main component, lands over that layer.
   */
  function placePasted(
    nodeIds: string[],
    placement: ClipboardPlacement,
    targetId: string,
    requestedId = targetId
  ) {
    if (requestedId !== targetId) {
      centerOver(nodeIds, requestedId)
      return
    }
    if (nodesOf(nodeIds).length === 0) return
    const target = ctx.graph.getNode(targetId)
    const frame =
      target && target.type !== 'CANVAS' ? getAxisAlignedWorldBounds(target, ctx.graph) : null
    if (frame) {
      // Layers from different places, such as a frame's child and a page-level layer, are placed
      // apart, each set as one block.
      const groups = groupBy(
        nodeIds.map((id, index) => ({ id, source: placement.sources.at(index) ?? null })),
        ({ source }) => source?.id ?? ''
      )
      for (const group of Object.values(groups)) {
        const ids = group.map(({ id }) => id)
        const { source } = group[0]
        if (source)
          translateOnCanvas(ctx.graph, ids, frame.x - source.box.x, frame.y - source.box.y)
        const shift = frameFitShift(canvasBounds(ctx.graph, nodesOf(ids)), frame, source !== null)
        translateOnCanvas(ctx.graph, ids, shift.x, shift.y)
      }
    }

    const view = viewportRect()
    if (!view) return
    const box = canvasBounds(ctx.graph, nodesOf(nodeIds))
    if (!overlaps(box, view)) {
      translateOnCanvas(
        ctx.graph,
        nodeIds,
        view.x + (view.width - box.width) / 2 - box.x,
        view.y + (view.height - box.height) / 2 - box.y
      )
    }
  }

  /**
   * Places layers pasted back into the frame they were copied out of: where they were on the
   * canvas, as Figma keeps them even after the frame moved. Out of view, they go onto the page in
   * the middle of the view instead.
   */
  function placeReturned(nodeIds: string[]) {
    const view = viewportRect()
    if (!view || overlaps(canvasBounds(ctx.graph, nodesOf(nodeIds)), view)) return
    for (const id of nodeIds) ctx.graph.reparentNode(id, ctx.state.currentPageId)
    centerNodesAtCanvasPoint(nodeIds, {
      x: view.x + view.width / 2,
      y: view.y + view.height / 2
    })
  }

  /** Centers layers on a canvas point, through their parents' rotation and flips. */
  function centerNodesAtCanvasPoint(nodeIds: string[], point: Vector) {
    const items = nodesOf(nodeIds)
    if (items.length === 0) return
    const box = canvasBounds(ctx.graph, items)
    translateOnCanvas(
      ctx.graph,
      nodeIds,
      point.x - (box.x + box.width / 2),
      point.y - (box.y + box.height / 2)
    )
  }

  return {
    centerNodesAtCanvasPoint,
    duplicatePosition,
    keepCanvasTransforms,
    placeForeignPaste,
    placePasted,
    placeReturned
  }
}
