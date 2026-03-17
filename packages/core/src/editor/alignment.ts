import { computeAbsoluteBounds } from '../geometry'
import type { Vector } from '../types'
import type { SceneNode } from '../scene-graph'
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
    const parentAbs = n.parentId
      ? ctx.graph.getAbsolutePosition(n.parentId)
      : { x: 0, y: 0 }

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

    const originals = new Map<string, Vector>()
    for (const n of nodes) originals.set(n.id, { x: n.x, y: n.y })

    if (nodes.length === 1) {
      alignSingleNode(ctx, nodes[0], axis, align)
    } else {
      alignMultipleNodes(ctx, nodes, axis, align)
    }

    const finals = new Map<string, Vector>()
    for (const n of nodes) finals.set(n.id, { x: n.x, y: n.y })

    ctx.undo.push({
      label: 'Align',
      forward: () => {
        for (const [id, pos] of finals) {
          ctx.graph.updateNode(id, pos)
          ctx.runLayoutForNode(id)
        }
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          ctx.graph.updateNode(id, pos)
          ctx.runLayoutForNode(id)
        }
      }
    })

    for (const id of nodeIds) ctx.runLayoutForNode(id)
    ctx.requestRender()
  }

  function flipNodes(nodeIds: string[], axis: 'horizontal' | 'vertical') {
    if (nodeIds.length === 0) return

    const originals = new Map<string, { flipX: boolean; flipY: boolean }>()
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      originals.set(id, { flipX: node.flipX, flipY: node.flipY })
      const changes =
        axis === 'horizontal' ? { flipX: !node.flipX } : { flipY: !node.flipY }
      ctx.graph.updateNode(id, changes)
    }

    const finals = new Map<string, { flipX: boolean; flipY: boolean }>()
    for (const [id] of originals) {
      const node = ctx.graph.getNode(id)
      if (node) finals.set(id, { flipX: node.flipX, flipY: node.flipY })
    }

    ctx.undo.push({
      label: 'Flip',
      forward: () => {
        for (const [id, val] of finals) ctx.graph.updateNode(id, val)
      },
      inverse: () => {
        for (const [id, val] of originals) ctx.graph.updateNode(id, val)
      }
    })

    ctx.requestRender()
  }

  function rotateNodes(nodeIds: string[], degrees: number) {
    if (nodeIds.length === 0) return

    const originals = new Map<string, number>()
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      originals.set(id, node.rotation)
      ctx.graph.updateNode(id, { rotation: ((node.rotation + degrees) % 360 + 360) % 360 })
    }

    const finals = new Map<string, number>()
    for (const [id] of originals) {
      const node = ctx.graph.getNode(id)
      if (node) finals.set(id, node.rotation)
    }

    ctx.undo.push({
      label: 'Rotate',
      forward: () => {
        for (const [id, rot] of finals) ctx.graph.updateNode(id, { rotation: rot })
      },
      inverse: () => {
        for (const [id, rot] of originals) ctx.graph.updateNode(id, { rotation: rot })
      }
    })

    ctx.requestRender()
  }

  return { alignNodes, flipNodes, rotateNodes }
}
