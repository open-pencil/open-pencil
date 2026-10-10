import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorContext } from '#core/editor/types'

export function collectNodePositions(
  ctx: EditorContext,
  ids: Iterable<string>
): Map<string, Vector> {
  const positions = new Map<string, Vector>()
  for (const id of ids) {
    const node = ctx.graph.getNode(id)
    if (node) positions.set(id, { x: node.x, y: node.y })
  }
  return positions
}

export function pushPositionUndo(
  ctx: EditorContext,
  label: string,
  originals: Map<string, Vector>,
  finals: Map<string, Vector>
): void {
  ctx.undo.push({
    label,
    forward: () => applyPositions(ctx, finals),
    inverse: () => applyPositions(ctx, originals)
  })
}

/**
 * Lays the moved layers out, then records one undo step from `originals` to where they ended up.
 * Layers an auto layout holds in place snap back, so an edit that moves nothing records nothing.
 */
export function commitPositionChange(
  ctx: EditorContext,
  label: string,
  originals: Map<string, Vector>
): void {
  for (const id of originals.keys()) ctx.runLayoutForNode(id)
  const finals = collectNodePositions(ctx, originals.keys())
  const moved = [...finals].some(([id, place]) => {
    const before = originals.get(id)
    return !before || before.x !== place.x || before.y !== place.y
  })
  if (moved) pushPositionUndo(ctx, label, originals, finals)
}

function applyPositions(ctx: EditorContext, positions: Map<string, Vector>): void {
  for (const [id, pos] of positions) {
    ctx.graph.updateNode(id, pos)
    ctx.runLayoutForNode(id)
  }
}
