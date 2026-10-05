import type { SceneNode } from '@open-pencil/scene-graph'

import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'

/** Put back a recorded subtree in place of the live one, at the same position. */
function replaceSubtree(
  ctx: Pick<EditorContext, 'graph'>,
  rootId: string,
  snapshot: Map<string, SceneNode>
): void {
  const root = snapshot.get(rootId)
  const parentId = root?.parentId
  if (!root || !parentId) return
  const index = ctx.graph.getNode(parentId)?.childIds.indexOf(rootId) ?? -1
  ctx.graph.deleteNode(rootId)
  restoreSubtree(ctx.graph, root, parentId, snapshot)
  if (index >= 0) ctx.graph.insertChildAt(rootId, parentId, index)
}

/**
 * Run a slot edit as one undo step that restores whole subtrees: an instance whose slot
 * content changes, or a component and its instances when a slot is created or removed. Slot
 * edits unlink and recreate layers, which per-field undo cannot express.
 */
export function recordSubtreeEdit(
  ctx: EditorContext,
  label: string,
  rootIds: string | readonly string[],
  mutate: () => void
): void {
  const roots = typeof rootIds === 'string' ? [rootIds] : rootIds
  const before = roots.map((id) => snapshotSubtree(ctx.graph, id))
  mutate()
  const after = roots.map((id) => snapshotSubtree(ctx.graph, id))
  const apply = (snapshots: Map<string, SceneNode>[]) => {
    for (const [index, id] of roots.entries()) replaceSubtree(ctx, id, snapshots[index])
    for (const id of roots) ctx.runLayoutForNode(id)
    ctx.requestRender()
  }
  for (const id of roots) ctx.runLayoutForNode(id)
  ctx.requestRender()
  ctx.undo.push({ label, forward: () => apply(after), inverse: () => apply(before) })
}
