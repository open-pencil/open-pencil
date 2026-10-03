import {
  claimSlotContent,
  clearSlotContent,
  ownsSlotContent,
  resetSlotContent,
  slotScope,
  type SceneNode,
  type SlotScope
} from '@open-pencil/scene-graph'

import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'

type InstanceSlot = Extract<SlotScope, { kind: 'slot' }>

/** Put back a recorded instance subtree in place of the live one, at the same position. */
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
 * Run an edit of one instance's slot content as one undo step that restores the whole
 * instance; slot edits unlink and recreate layers, which per-field undo cannot express.
 */
function recordInstanceEdit(
  ctx: EditorContext,
  label: string,
  instanceId: string,
  mutate: () => void
): void {
  const before = snapshotSubtree(ctx.graph, instanceId)
  mutate()
  const after = snapshotSubtree(ctx.graph, instanceId)
  ctx.runLayoutForNode(instanceId)
  ctx.requestRender()
  ctx.undo.push({
    label,
    forward: () => {
      replaceSubtree(ctx, instanceId, after)
      ctx.runLayoutForNode(instanceId)
      ctx.requestRender()
    },
    inverse: () => {
      replaceSubtree(ctx, instanceId, before)
      ctx.runLayoutForNode(instanceId)
      ctx.requestRender()
    }
  })
}

/**
 * Check every parent a structural edit touches. Returns false when one is a locked part of
 * an instance; otherwise claims each untouched slot first, so the edit lands in content the
 * instance owns. Call it before mutating, inside the edit's undo batch.
 */
export function prepareSlotEdits(
  ctx: EditorContext,
  parentIds: Iterable<string>,
  { allowLocked = false }: { allowLocked?: boolean } = {}
): boolean {
  const slots = new Map<string, InstanceSlot>()
  for (const parentId of parentIds) {
    const scope = slotScope(ctx.graph, parentId)
    if (scope.kind === 'locked' && !allowLocked) return false
    if (scope.kind === 'slot') slots.set(scope.frame.id, scope)
  }
  for (const scope of slots.values()) {
    if (ownsSlotContent(ctx.graph, scope.frame, scope.propertyId)) continue
    recordInstanceEdit(ctx, 'Edit slot', scope.instance.id, () =>
      claimSlotContent(ctx.graph, scope)
    )
  }
  return true
}

/** Whether layers may be added to or removed from this parent at all. */
export function acceptsChildren(ctx: Pick<EditorContext, 'graph'>, parentId: string): boolean {
  return slotScope(ctx.graph, parentId).kind !== 'locked'
}

/** The parent itself, or the nearest one outside the locked part of an instance. */
export function acceptingParent(ctx: Pick<EditorContext, 'graph'>, parentId: string): string {
  let id = parentId
  for (;;) {
    const scope = slotScope(ctx.graph, id)
    if (scope.kind !== 'locked' || !scope.instance.parentId) return id
    id = scope.instance.parentId
  }
}

export function createSlotActions(ctx: EditorContext) {
  function slotAt(frameId: string): InstanceSlot | undefined {
    const scope = slotScope(ctx.graph, frameId)
    return scope.kind === 'slot' && scope.frame.id === frameId ? scope : undefined
  }

  function resetSlot(frameId: string): void {
    const scope = slotAt(frameId)
    if (!scope) return
    recordInstanceEdit(ctx, 'Reset slot', scope.instance.id, () =>
      resetSlotContent(ctx.graph, scope)
    )
  }

  function clearSlot(frameId: string): void {
    const scope = slotAt(frameId)
    if (!scope) return
    recordInstanceEdit(ctx, 'Delete slot contents', scope.instance.id, () =>
      clearSlotContent(ctx.graph, scope)
    )
  }

  /** Append an instance of `componentId` to the slot and select it. */
  function addInstanceToSlot(frameId: string, componentId: string): string | null {
    const scope = slotAt(frameId)
    if (!scope || ctx.graph.getNode(componentId)?.type !== 'COMPONENT') return null
    const created: { id: string | null } = { id: null }
    recordInstanceEdit(ctx, 'Add instance', scope.instance.id, () => {
      claimSlotContent(ctx.graph, scope)
      created.id = ctx.graph.createInstance(componentId, frameId)?.id ?? null
    })
    if (created.id) ctx.setSelectedIds(new Set([created.id]))
    return created.id
  }

  return { resetSlot, clearSlot, addInstanceToSlot }
}
