import {
  canCreateSlot,
  createSlotProperty,
  removeComponentProperty,
  slotOwner,
  slotPropertyId,
  updateSlotProperty,
  type SceneNode,
  type SlotPropertyPatch,
  createComponentPropertyId
} from '@open-pencil/scene-graph'

import { wrapInAutoLayout } from '#core/editor/structure/auto-layout-wrap'
import type { EditorContext } from '#core/editor/types'

import { recordSubtreeEdit } from './history'

type PropertyFields = Pick<
  SceneNode,
  'componentPropertyDefinitions' | 'componentPropertyReferences'
>

function propertyFields(ctx: EditorContext, ids: readonly string[]): Map<string, PropertyFields> {
  const fields = new Map<string, PropertyFields>()
  for (const id of ids) {
    const node = ctx.graph.getNode(id)
    if (!node) continue
    fields.set(id, {
      componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions),
      componentPropertyReferences: structuredClone(node.componentPropertyReferences)
    })
  }
  return fields
}

/**
 * Run a change to a component's slot definitions as one undo step. The component's own
 * definitions and its frames' bindings are restored field by field; instances follow them on
 * sync, so only the instances in `instanceIds`, whose content the change drops, are recorded.
 */
function recordDefinitionEdit(
  ctx: EditorContext,
  label: string,
  nodeIds: readonly string[],
  instanceIds: readonly string[],
  mutate: () => void
): void {
  const apply = (fields: Map<string, PropertyFields>) => {
    for (const [id, values] of fields) ctx.graph.updateNode(id, structuredClone(values))
    ctx.requestRender()
  }
  ctx.undo.runBatch(label, () => {
    const before = propertyFields(ctx, nodeIds)
    if (instanceIds.length) recordSubtreeEdit(ctx, label, instanceIds, mutate)
    else mutate()
    const after = propertyFields(ctx, nodeIds)
    ctx.requestRender()
    ctx.undo.push({ label, forward: () => apply(after), inverse: () => apply(before) })
  })
}

/** Frames bound to this slot property in the component that defines it. */
function boundFrames(ctx: EditorContext, owner: SceneNode, propertyId: string): SceneNode[] {
  const frames: SceneNode[] = []
  const visit = (node: SceneNode): void => {
    for (const child of ctx.graph.getChildren(node.id)) {
      if (slotPropertyId(child) === propertyId) frames.push(child)
      if (child.type !== 'INSTANCE') visit(child)
    }
  }
  visit(owner)
  return frames
}

export function createSlotAuthoringActions(ctx: EditorContext) {
  /** Make a frame of a main component a slot. */
  function convertToSlot(frameId: string): string | null {
    const frame = ctx.graph.getNode(frameId)
    const owner = frame && canCreateSlot(ctx.graph, frame) ? slotOwner(ctx.graph, frame) : undefined
    if (!frame || !owner) return null
    const id = createComponentPropertyId()
    recordDefinitionEdit(ctx, 'Create slot', [owner.id, frame.id], [], () => {
      createSlotProperty(ctx.graph, frame.id, id)
    })
    return id
  }

  /**
   * Turn the selection into a slot, as Figma's Create slot does: a selected frame of a main
   * component becomes one; other layers are first wrapped in a new auto layout frame.
   */
  function createSlot(nodes: SceneNode[]): string | null {
    const first = nodes.at(0)
    if (!first) return null
    if (nodes.length === 1 && canCreateSlot(ctx.graph, first)) return convertToSlot(first.id)
    if (!slotOwner(ctx.graph, first)) return null
    return ctx.undo.runBatch('Create slot', () => {
      const frameId = wrapInAutoLayout(ctx, nodes)
      if (!frameId) return null
      ctx.graph.updateNode(frameId, { name: 'Slot' })
      return convertToSlot(frameId)
    })
  }

  /** Change a slot property's name, description, preferred components, or limits. */
  function updateSlot(ownerId: string, propertyId: string, patch: SlotPropertyPatch): void {
    recordDefinitionEdit(ctx, 'Edit slot', [ownerId], [], () => {
      updateSlotProperty(ctx.graph, ownerId, propertyId, patch)
    })
  }

  /**
   * Remove a slot property; its frames become ordinary frames again and instances go back to
   * the component's content.
   */
  function removeSlot(ownerId: string, propertyId: string): void {
    const owner = ctx.graph.getNode(ownerId)
    if (!owner) return
    const frames = boundFrames(ctx, owner, propertyId)
    const owning = [...ctx.graph.getAllNodes()]
      .filter(
        (node) =>
          node.type === 'INSTANCE' &&
          node.componentId === owner.id &&
          Object.hasOwn(node.componentPropertyAssignments, propertyId)
      )
      .map((instance) => instance.id)
    recordDefinitionEdit(
      ctx,
      'Remove slot',
      [owner.id, ...frames.map((frame) => frame.id)],
      owning,
      () => {
        removeComponentProperty(ctx.graph, owner.id, propertyId)
      }
    )
  }

  return { createSlot, convertToSlot, updateSlot, removeSlot }
}
