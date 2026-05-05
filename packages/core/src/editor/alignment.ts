import { createFlipRotateActions } from '#core/editor/alignment/flip-rotate'
import { computeAbsoluteBounds } from '#core/geometry'
import type { SceneNode } from '#core/scene-graph'
import type { Vector } from '#core/types'

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

export function createAlignmentActions(ctx: EditorContext) {
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

  const { flipNodes, rotateNodes } = createFlipRotateActions(ctx)

  return { alignNodes, flipNodes, rotateNodes }
}
