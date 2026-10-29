import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'
import {
  cloneInstanceOverrideState,
  setInstanceOverride
} from '@open-pencil/scene-graph/instances/overrides'

import { assertNodeEditable } from '#core/editor/capabilities'
import {
  applyBoundVisibilityEdit,
  bindsVisibility
} from '#core/editor/components/authoring/visibility-edit'
import { refitGroupsAroundLayers } from '#core/editor/structure/group/bounds'
import type { EditorContext } from '#core/editor/types'

export function createStructureStateActions(ctx: EditorContext) {
  /** Shows or hides a layer; one a boolean property drives sets the property, as in Figma. */
  function applyNodeVisibility(id: string, visible: boolean) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const owner = findInstanceAncestor(ctx.graph, id)
    // The property takes the value even where the layer already shows it, so the two agree.
    if (owner && bindsVisibility(node) && applyBoundVisibilityEdit(ctx, id, visible)) return
    if (node.visible === visible) return
    const previousOverrides = owner && cloneInstanceOverrideState(owner.instanceOverrides)
    const show = (shown: boolean) => {
      ctx.graph.updateNode(id, { visible: shown })
      const parentId = ctx.graph.getNode(id)?.parentId
      if (!parentId) return
      ctx.runLayoutForNode(parentId)
      refitGroupsAroundLayers(ctx, [id])
    }
    const forward = () => {
      const instance = findInstanceAncestor(ctx.graph, id)
      if (instance)
        setInstanceOverride(instance.instanceOverrides, instance.id, id, 'visible', true)
      show(visible)
    }
    forward()
    ctx.undo.push({
      label: visible ? 'Show layer' : 'Hide layer',
      forward,
      inverse: () => {
        if (owner && previousOverrides)
          ctx.graph.updateNode(owner.id, {
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
          })
        show(!visible)
      }
    })
  }

  function setNodeVisibility(id: string, visible: boolean) {
    assertNodeEditable(ctx.graph, id)
    applyNodeVisibility(id, visible)
  }

  function toggleNodeVisibility(id: string) {
    assertNodeEditable(ctx.graph, id)
    const node = ctx.graph.getNode(id)
    if (node) applyNodeVisibility(id, !node.visible)
  }

  function toggleNodeLock(id: string) {
    assertNodeEditable(ctx.graph, id)
    const node = ctx.graph.getNode(id)
    if (!node) return
    const locked = !node.locked
    ctx.graph.updateNode(id, { locked })
    ctx.undo.push({
      label: locked ? 'Lock layer' : 'Unlock layer',
      forward: () => ctx.graph.updateNode(id, { locked }),
      inverse: () => ctx.graph.updateNode(id, { locked: !locked })
    })
  }

  function toggleVisibility() {
    for (const id of ctx.state.selectedIds) assertNodeEditable(ctx.graph, id)
    // Each layer takes the opposite of what it showed before any of them changed: layers a
    // property drives together would otherwise toggle it back and forth.
    const targets = [...ctx.state.selectedIds].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node ? [[id, !node.visible] as const] : []
    })
    ctx.undo.runBatch('Toggle visibility', () => {
      for (const [id, visible] of targets) applyNodeVisibility(id, visible)
    })
  }

  function toggleLock() {
    for (const id of ctx.state.selectedIds) assertNodeEditable(ctx.graph, id)
    ctx.undo.runBatch('Toggle lock', () => {
      for (const id of ctx.state.selectedIds) toggleNodeLock(id)
    })
  }

  return { setNodeVisibility, toggleNodeVisibility, toggleNodeLock, toggleVisibility, toggleLock }
}
