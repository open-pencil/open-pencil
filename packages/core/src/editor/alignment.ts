import type { SceneNode } from '@open-pencil/scene-graph'
import { getAbsolutePositionFull, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { createFlipRotateActions } from '#core/editor/alignment/flip-rotate'

import { collectNodePositions, pushPositionUndo } from './history/position'
import type { EditorContext } from './types'

function computeAlignTarget(
  min: number,
  max: number,
  size: number,
  align: 'min' | 'center' | 'max'
): number {
  if (align === 'min') return min
  if (align === 'center') return (min + max) / 2 - size / 2
  return max - size
}

function alignSingleNode(
  ctx: EditorContext,
  node: SceneNode,
  axis: 'horizontal' | 'vertical',
  align: 'min' | 'center' | 'max'
) {
  const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
  const pw = parent?.width ?? 0
  const ph = parent?.height ?? 0

  if (axis === 'horizontal') {
    ctx.graph.updateNode(node.id, { x: computeAlignTarget(0, pw, node.width, align) })
  } else {
    ctx.graph.updateNode(node.id, { y: computeAlignTarget(0, ph, node.height, align) })
  }
}

function alignMultipleNodes(
  ctx: EditorContext,
  nodes: SceneNode[],
  axis: 'horizontal' | 'vertical',
  align: 'min' | 'center' | 'max'
) {
  const absPositions = new Map<string, Vector>()
  for (const n of nodes) absPositions.set(n.id, ctx.graph.getAbsolutePosition(n.id))

  const getPos = (id: string) => absPositions.get(id) ?? { x: 0, y: 0 }
  const b = computeAbsoluteBounds(nodes, getPos)
  const minX = b.x
  const minY = b.y
  const maxX = b.x + b.width
  const maxY = b.y + b.height

  for (const n of nodes) {
    const abs = absPositions.get(n.id)
    if (!abs) continue
    const parentAbs = n.parentId ? ctx.graph.getAbsolutePosition(n.parentId) : { x: 0, y: 0 }

    if (axis === 'horizontal') {
      const target = computeAlignTarget(minX, maxX, n.width, align)
      ctx.graph.updateNode(n.id, { x: target - parentAbs.x })
    } else {
      const target = computeAlignTarget(minY, maxY, n.height, align)
      ctx.graph.updateNode(n.id, { y: target - parentAbs.y })
    }
  }
}

function canPositionNode(ctx: EditorContext, node: SceneNode): boolean {
  const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
  return !parent || parent.layoutMode === 'NONE' || node.layoutPositioning === 'ABSOLUTE'
}

function parentLocalDelta(ctx: EditorContext, node: SceneNode, worldDelta: Vector): Vector | null {
  const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
  if (!parent) return worldDelta
  const inverse = Matrix.invert(getWorldMatrix(parent, ctx.graph))
  if (!inverse) return null
  const origin = Matrix.mapPoint(inverse, { x: 0, y: 0 })
  const target = Matrix.mapPoint(inverse, worldDelta)
  return { x: target.x - origin.x, y: target.y - origin.y }
}

function distributeMultipleNodes(
  ctx: EditorContext,
  nodes: SceneNode[],
  axis: 'horizontal' | 'vertical'
) {
  const bounds = new Map(nodes.map((node) => [node.id, getAbsolutePositionFull(node, ctx.graph)]))
  const coordinate = axis === 'horizontal' ? 'boundX' : 'boundY'
  const size = axis === 'horizontal' ? 'width' : 'height'
  const sorted = [...nodes].sort((a, b) => {
    const delta = (bounds.get(a.id)?.[coordinate] ?? 0) - (bounds.get(b.id)?.[coordinate] ?? 0)
    return delta || a.id.localeCompare(b.id)
  })
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!last) return

  const start = bounds.get(first.id)?.[coordinate] ?? 0
  const end = (bounds.get(last.id)?.[coordinate] ?? 0) + (bounds.get(last.id)?.[size] ?? 0)
  const totalSize = sorted.reduce((sum, node) => sum + (bounds.get(node.id)?.[size] ?? 0), 0)
  const gap = (end - start - totalSize) / (sorted.length - 1)
  let cursor = start

  for (const node of sorted) {
    const nodeBounds = bounds.get(node.id)
    if (!nodeBounds) continue
    const distance = cursor - nodeBounds[coordinate]
    const localDelta = parentLocalDelta(
      ctx,
      node,
      axis === 'horizontal' ? { x: distance, y: 0 } : { x: 0, y: distance }
    )
    if (!localDelta) continue
    ctx.graph.updateNode(node.id, { x: node.x + localDelta.x, y: node.y + localDelta.y })
    cursor += nodeBounds[size] + gap
  }
}

type Axis = 'horizontal' | 'vertical'

/** The layers as one row or column, or null when they are not, as Figma's Spacing field reads them. */
export interface SelectionSpacing {
  axis: Axis
  /** The gaps between neighbours, in order along the axis. */
  gaps: number[]
}

function axisSpans(ctx: EditorContext, nodes: SceneNode[], axis: Axis) {
  const start = axis === 'horizontal' ? 'boundX' : 'boundY'
  const crossStart = axis === 'horizontal' ? 'boundY' : 'boundX'
  const size = axis === 'horizontal' ? 'width' : 'height'
  const crossSize = axis === 'horizontal' ? 'height' : 'width'
  return nodes
    .map((node) => {
      const bounds = getAbsolutePositionFull(node, ctx.graph)
      return {
        node,
        min: bounds[start],
        max: bounds[start] + bounds[size],
        crossMin: bounds[crossStart],
        crossMax: bounds[crossStart] + bounds[crossSize]
      }
    })
    .sort((a, b) => a.min - b.min || a.node.id.localeCompare(b.node.id))
}

/**
 * Layers form a row when none overlap along it and each overlaps its neighbour across it; layers
 * apart on both axes, like a grid or a diagonal, have no spacing in Figma.
 */
function rowAlong(ctx: EditorContext, nodes: SceneNode[], axis: Axis) {
  const spans = axisSpans(ctx, nodes, axis)
  for (let index = 1; index < spans.length; index++) {
    const previous = spans[index - 1]
    const current = spans[index]
    if (current.min < previous.max) return null
    if (current.crossMin > previous.crossMax || current.crossMax < previous.crossMin) return null
  }
  return spans
}

export function createAlignmentActions(ctx: EditorContext) {
  function positionableNodes(nodeIds: readonly string[]) {
    const nodes = nodeIds
      .map((id) => ctx.graph.getNode(id))
      .filter((node): node is SceneNode => node != null)
    return nodes.length >= 2 && nodes.every((node) => canPositionNode(ctx, node)) ? nodes : null
  }

  function selectionSpacing(nodeIds: readonly string[]): SelectionSpacing | null {
    const nodes = positionableNodes(nodeIds)
    if (!nodes) return null
    for (const axis of ['horizontal', 'vertical'] as const) {
      const spans = rowAlong(ctx, nodes, axis)
      if (spans)
        return { axis, gaps: spans.slice(1).map((span, index) => span.min - spans[index].max) }
    }
    return null
  }

  /** Spaces the row or column evenly by `gap`, keeping its first layer in place, as Figma does. */
  function setSelectionSpacing(nodeIds: readonly string[], gap: number) {
    const spacing = selectionSpacing(nodeIds)
    const nodes = positionableNodes(nodeIds)
    if (!spacing || !nodes) return
    const spans = rowAlong(ctx, nodes, spacing.axis)
    if (!spans) return
    const originals = collectNodePositions(
      ctx,
      nodes.map((node) => node.id)
    )
    let cursor = spans[0].max + gap
    for (const span of spans.slice(1)) {
      const distance = cursor - span.min
      const delta = parentLocalDelta(
        ctx,
        span.node,
        spacing.axis === 'horizontal' ? { x: distance, y: 0 } : { x: 0, y: distance }
      )
      if (delta)
        ctx.graph.updateNode(span.node.id, {
          x: span.node.x + delta.x,
          y: span.node.y + delta.y
        })
      cursor += span.max - span.min + gap
    }
    pushPositionUndo(ctx, 'Change spacing', originals, collectNodePositions(ctx, originals.keys()))
    for (const node of nodes) ctx.runLayoutForNode(node.id)
    ctx.requestRender()
  }

  function canDistributeNodes(nodeIds: string[]): boolean {
    const nodes = nodeIds
      .map((id) => ctx.graph.getNode(id))
      .filter((node): node is SceneNode => node != null)
    return nodes.length >= 3 && nodes.every((node) => canPositionNode(ctx, node))
  }

  function alignNodes(
    nodeIds: string[],
    axis: 'horizontal' | 'vertical',
    align: 'min' | 'center' | 'max'
  ) {
    if (nodeIds.length === 0) return

    const nodes = nodeIds
      .map((id) => ctx.graph.getNode(id))
      .filter((n): n is SceneNode => n != null)
    if (nodes.length === 0) return

    const originals = collectNodePositions(
      ctx,
      nodes.map((node) => node.id)
    )

    if (nodes.length === 1) {
      alignSingleNode(ctx, nodes[0], axis, align)
    } else {
      alignMultipleNodes(ctx, nodes, axis, align)
    }

    const finals = collectNodePositions(ctx, originals.keys())
    pushPositionUndo(ctx, 'Align', originals, finals)

    for (const id of nodeIds) ctx.runLayoutForNode(id)
    ctx.requestRender()
  }

  function distributeNodes(nodeIds: string[], axis: 'horizontal' | 'vertical') {
    const nodes = nodeIds
      .map((id) => ctx.graph.getNode(id))
      .filter((node): node is SceneNode => node != null)
    if (!canDistributeNodes(nodeIds)) return

    const originals = collectNodePositions(
      ctx,
      nodes.map((node) => node.id)
    )
    distributeMultipleNodes(ctx, nodes, axis)
    const finals = collectNodePositions(ctx, originals.keys())
    pushPositionUndo(ctx, 'Distribute', originals, finals)

    for (const id of nodeIds) ctx.runLayoutForNode(id)
    ctx.requestRender()
  }

  const { flipNodes, rotateNodes } = createFlipRotateActions(ctx)

  return {
    alignNodes,
    canDistributeNodes,
    distributeNodes,
    selectionSpacing,
    setSelectionSpacing,
    flipNodes,
    rotateNodes
  }
}
