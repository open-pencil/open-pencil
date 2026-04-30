import type { EditorContext } from '#core/editor/types'
import type { Vector } from '#core/types'

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

function applyPositions(ctx: EditorContext, positions: Map<string, Vector>): void {
  for (const [id, pos] of positions) {
    ctx.graph.updateNode(id, pos)
    ctx.runLayoutForNode(id)
  }
}
