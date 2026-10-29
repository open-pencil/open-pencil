import { isEqual } from 'es-toolkit/predicate'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  componentPropertyDefinitions,
  findComponentPropertyTargets
} from '@open-pencil/scene-graph/components'
import { cloneInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'

import { refitGroupsAroundLayers } from '#core/editor/structure/group/bounds'
import type { EditorContext } from '#core/editor/types'

/** Whether a boolean property drives the layer's visibility. */
export function bindsVisibility(node: SceneNode): boolean {
  return node.componentPropertyReferences.some((reference) => reference.field === 'VISIBLE')
}

/**
 * Showing or hiding a layer of an instance that a boolean property drives sets the property, as
 * in Figma: the instance that defines it takes the value, and every layer it drives follows. A
 * bare visibility override would not reach Figma, which shows such layers by the property. The
 * caller records the edit itself; this records the property change beside it. Returns whether a
 * property drives the layer, and so took the value.
 */
export function applyBoundVisibilityEdit(
  ctx: EditorContext,
  nodeId: string,
  visible: boolean
): boolean {
  const node = ctx.graph.getNode(nodeId)
  const propertyId = node?.componentPropertyReferences.find(
    (reference) => reference.field === 'VISIBLE'
  )?.propertyId
  if (!node?.parentId || !propertyId) return false
  const instance = ctx.graph.closest(
    node.parentId,
    (item) =>
      item.type === 'INSTANCE' &&
      componentPropertyDefinitions(ctx.graph, item).some(
        (definition) => definition.id === propertyId
      )
  )
  const definition = instance
    ? componentPropertyDefinitions(ctx.graph, instance).find((item) => item.id === propertyId)
    : undefined
  if (!instance || definition?.type !== 'BOOLEAN') return false
  const layers = findComponentPropertyTargets(ctx.graph, instance, propertyId).flatMap((target) =>
    target.field === 'VISIBLE' ? [target.node.id] : []
  )
  const snapshot = () => ({
    componentPropertyAssignments: { ...instance.componentPropertyAssignments },
    instanceOverrides: cloneInstanceOverrideState(instance.instanceOverrides),
    layers: layers.map((id) => [id, ctx.graph.getNode(id)?.visible ?? true] as const)
  })
  const before = snapshot()
  applyComponentPropertyValue(ctx.graph, instance.id, definition, String(visible))
  const after = snapshot()
  // The property already had the value, as when another layer it drives was just shown.
  if (isEqual(before, after)) return true
  refitGroupsAroundLayers(ctx, layers)
  const apply = (values: typeof before) => {
    ctx.graph.updateNode(instance.id, {
      componentPropertyAssignments: { ...values.componentPropertyAssignments },
      instanceOverrides: cloneInstanceOverrideState(values.instanceOverrides)
    })
    for (const [id, shown] of values.layers) ctx.graph.updateNode(id, { visible: shown })
    refitGroupsAroundLayers(ctx, layers)
    ctx.runLayoutForNode(instance.id)
    ctx.requestRender()
  }
  ctx.runLayoutForNode(instance.id)
  ctx.undo.push({
    label: visible ? 'Show layer' : 'Hide layer',
    forward: () => apply(after),
    inverse: () => apply(before)
  })
  return true
}
