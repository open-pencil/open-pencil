import {
  claimSlotContent,
  clearSlotContent,
  ownsSlotContent,
  resetSlotContent,
  slotScope,
  type SlotScope
} from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

import { recordSubtreeEdit } from './history'

type InstanceSlot = Extract<SlotScope, { kind: 'slot' }>

/**
 * Check every parent a structural edit touches. Returns false when one is a locked part of
 * an instance; otherwise claims each untouched slot first, so the edit lands in content the
 * instance owns. Call it before mutating, inside the edit's undo batch.
 */
export function prepareSlotEdits(ctx: EditorContext, parentIds: Iterable<string>): boolean {
  const slots = new Map<string, InstanceSlot>()
  for (const parentId of parentIds) {
    const scope = slotScope(ctx.graph, parentId)
    if (scope.kind === 'locked') return false
    if (scope.kind === 'slot') slots.set(scope.frame.id, scope)
  }
  for (const scope of slots.values()) {
    if (ownsSlotContent(ctx.graph, scope.frame, scope.propertyId)) continue
    recordSubtreeEdit(ctx, 'Edit slot', scope.instance.id, () => claimSlotContent(ctx.graph, scope))
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
    recordSubtreeEdit(ctx, 'Reset slot', scope.instance.id, () =>
      resetSlotContent(ctx.graph, scope)
    )
  }

  function clearSlot(frameId: string): void {
    const scope = slotAt(frameId)
    if (!scope) return
    recordSubtreeEdit(ctx, 'Delete slot contents', scope.instance.id, () =>
      clearSlotContent(ctx.graph, scope)
    )
  }

  /** Append an instance of `componentId` to the slot and select it. */
  function addInstanceToSlot(frameId: string, componentId: string): string | null {
    const scope = slotAt(frameId)
    if (!scope || ctx.graph.getNode(componentId)?.type !== 'COMPONENT') return null
    const previousSelection = new Set(ctx.state.selectedIds)
    const created: { id: string | null } = { id: null }
    ctx.undo.runBatch('Add instance', () => {
      recordSubtreeEdit(ctx, 'Add instance', scope.instance.id, () => {
        claimSlotContent(ctx.graph, scope)
        created.id = ctx.graph.createInstance(componentId, frameId)?.id ?? null
      })
      const id = created.id
      if (!id) return
      // Undo removes the new instance, so it must not stay selected.
      ctx.setSelectedIds(new Set([id]))
      ctx.undo.push({
        label: 'Add instance',
        forward: () => ctx.setSelectedIds(new Set([id])),
        inverse: () => ctx.setSelectedIds(new Set(previousSelection))
      })
    })
    return created.id
  }

  return { resetSlot, clearSlot, addInstanceToSlot }
}
