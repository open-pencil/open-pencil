import type { SceneNode } from '@open-pencil/scene-graph'

import {
  layersToOutline,
  outlineStrokeLayer,
  type OutlinePiece,
  type OutlinedLayer
} from '#core/canvas/outline-stroke'
import { restoreSubtree, snapshotSubtree } from '#core/editor/history/subtree'
import { fitEnclosingGroupsWithUndo } from '#core/editor/structure/group/bounds'
import type { EditorContext } from '#core/editor/types'

/** A layer to outline, where it sits, and what it becomes. */
interface Outlining {
  node: SceneNode
  parentId: string
  index: number
  snapshot: Map<string, SceneNode>
  outlined: OutlinedLayer
}

/** Where a layer Outline stroke made sits, to put it back on redo. */
interface Made {
  id: string
  parentId: string
  index: number
  snapshot: Map<string, SceneNode>
}

/** Creates a piece in `parentId` at `index`, with a group's glyph vectors inside it. */
function createPiece(ctx: EditorContext, piece: OutlinePiece, parentId: string, index: number) {
  const node = ctx.graph.createNode(piece.type, parentId, piece.props)
  for (const child of piece.children) ctx.graph.createNode('VECTOR', node.id, child)
  ctx.graph.insertChildAt(node.id, parentId, index)
  return node.id
}

/** Restores snapshots taken in one parent, lowest index first so each lands where it was. */
function restoreAt(ctx: EditorContext, entries: readonly Made[]) {
  for (const { id, parentId, index, snapshot } of entries.toSorted((a, b) => a.index - b.index)) {
    const root = snapshot.get(id)
    if (!root) continue
    restoreSubtree(ctx.graph, root, parentId, snapshot)
    ctx.graph.insertChildAt(id, parentId, index)
  }
}

/**
 * Figma's Outline stroke: every stroked layer is replaced, where it was, by its fill as a shape
 * of its own under its stroke as one, both selected. Undo puts the layers back.
 */
export function outlineStrokeSelected(
  ctx: EditorContext,
  selectedNodes: SceneNode[]
): string[] | null {
  const renderer = ctx.getRenderer()
  if (!renderer) return null
  const plan: Outlining[] = []
  for (const node of layersToOutline(selectedNodes, ctx.graph)) {
    const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
    const outlined = parent ? outlineStrokeLayer(renderer, node, ctx.graph) : null
    if (!parent || !outlined) continue
    plan.push({
      node,
      parentId: parent.id,
      index: parent.childIds.indexOf(node.id),
      snapshot: snapshotSubtree(ctx.graph, node.id),
      outlined
    })
  }
  if (plan.length === 0) return null

  const madeIds: string[] = []
  for (const { node, parentId, outlined } of plan) {
    const index = ctx.graph.getNode(parentId)?.childIds.indexOf(node.id) ?? 0
    const fill = outlined.fill ? createPiece(ctx, outlined.fill, parentId, index) : null
    const stroke = createPiece(ctx, outlined.stroke, parentId, index + (fill ? 1 : 0))
    ctx.graph.deleteNode(node.id)
    if (fill) madeIds.push(fill)
    madeIds.push(stroke)
  }
  const made: Made[] = madeIds.flatMap((id) => {
    const parentId = ctx.graph.getNode(id)?.parentId
    if (!parentId) return []
    const index = ctx.graph.getNode(parentId)?.childIds.indexOf(id) ?? 0
    return [{ id, parentId, index, snapshot: snapshotSubtree(ctx.graph, id) }]
  })
  const parentIds = new Set(plan.map((entry) => entry.parentId))
  const prevSelection = new Set(ctx.state.selectedIds)
  for (const parentId of parentIds) ctx.runLayoutForNode(parentId)
  ctx.setSelectedIds(new Set(madeIds))

  // Groups around the outlines fit them, which can reach past the layers they replace, in the
  // same undo step.
  ctx.undo.runBatch('Outline stroke', () => {
    pushOutlineUndo(ctx, { plan, made, madeIds, parentIds, prevSelection })
    fitEnclosingGroupsWithUndo(ctx, parentIds)
  })
  return madeIds
}

/** The undo step that puts the outlined layers back, and redo that outlines them again. */
function pushOutlineUndo(
  ctx: EditorContext,
  {
    plan,
    made,
    madeIds,
    parentIds,
    prevSelection
  }: {
    plan: readonly Outlining[]
    made: readonly Made[]
    madeIds: readonly string[]
    parentIds: ReadonlySet<string>
    prevSelection: ReadonlySet<string>
  }
) {
  ctx.undo.push({
    label: 'Outline stroke',
    forward: () => {
      for (const { node } of plan) ctx.graph.deleteNode(node.id)
      restoreAt(ctx, made)
      for (const parentId of parentIds) ctx.runLayoutForNode(parentId)
      ctx.setSelectedIds(new Set(madeIds))
    },
    inverse: () => {
      for (const { id } of made) ctx.graph.deleteNode(id)
      restoreAt(
        ctx,
        plan.map(({ node, parentId, index, snapshot }) => ({
          id: node.id,
          parentId,
          index,
          snapshot
        }))
      )
      for (const parentId of parentIds) ctx.runLayoutForNode(parentId)
      ctx.setSelectedIds(new Set(prevSelection))
    }
  })
}
