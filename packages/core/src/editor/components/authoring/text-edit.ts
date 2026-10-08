import {
  applyComponentPropertyValue,
  cloneInstanceOverrideState,
  componentPropertyDefinitions,
  findComponentPropertyTargets
} from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

import { componentAuthoringContext, componentPropertySources } from './context'

/**
 * Text typed into a layer a text property drives becomes the property's value, as in Figma:
 * the default when the layer is in the main component, the instance's value when it is in an
 * instance. The caller records the edit itself; this records the property change beside it.
 */
export function applyBoundTextEdit(ctx: EditorContext, nodeId: string, text: string): void {
  const node = ctx.graph.getNode(nodeId)
  const propertyId = node?.componentPropertyReferences.find(
    (reference) => reference.field === 'TEXT'
  )?.propertyId
  if (!node || !propertyId) return
  if (componentAuthoringContext(ctx.graph, nodeId)) setDefault(ctx, node, propertyId, text)
  else setInstanceValue(ctx, node, propertyId, text)
}

function setDefault(ctx: EditorContext, node: SceneNode, propertyId: string, text: string) {
  const context = componentAuthoringContext(ctx.graph, node.id)
  const owner = context?.owners.find((item) =>
    item.componentPropertyDefinitions.some((definition) => definition.id === propertyId)
  )
  const definition = owner?.componentPropertyDefinitions.find((item) => item.id === propertyId)
  if (!owner || !definition || definition.defaultValue === text) return
  const before = structuredClone(owner.componentPropertyDefinitions)
  const after = before.map((item) =>
    item.id === propertyId ? { ...item, defaultValue: text } : item
  )
  // Every other layer the property drives shows the same default.
  const others = componentPropertySources(ctx.graph, owner.id, propertyId).filter(
    (source) => source.node.id !== node.id && source.node.type === 'TEXT'
  )
  const othersBefore = others.map((source) => [source.node.id, source.node.text] as const)
  const apply = (definitions: typeof before, texts: (readonly [string, string])[]) => {
    ctx.graph.updateNode(owner.id, { componentPropertyDefinitions: structuredClone(definitions) })
    for (const [id, value] of texts) ctx.graph.updateNode(id, { text: value })
    ctx.requestRender()
  }
  ctx.undo.execute({
    label: 'Edit text',
    forward: () =>
      apply(
        after,
        othersBefore.map(([id]) => [id, text] as const)
      ),
    inverse: () => apply(before, othersBefore)
  })
}

function setInstanceValue(ctx: EditorContext, node: SceneNode, propertyId: string, text: string) {
  const instance = node.parentId
    ? ctx.graph.closest(
        node.parentId,
        (item) =>
          item.type === 'INSTANCE' &&
          componentPropertyDefinitions(ctx.graph, item).some(
            (definition) => definition.id === propertyId
          )
      )
    : undefined
  const definition = instance
    ? componentPropertyDefinitions(ctx.graph, instance).find((item) => item.id === propertyId)
    : undefined
  if (!instance || !definition) return
  const before = {
    componentPropertyAssignments: { ...instance.componentPropertyAssignments },
    instanceOverrides: cloneInstanceOverrideState(instance.instanceOverrides)
  }
  // Other layers the property drives in this instance change with it, and undo with it.
  const othersBefore = findComponentPropertyTargets(ctx.graph, instance, propertyId)
    .filter((target) => target.node.id !== node.id && target.node.type === 'TEXT')
    .map((target) => [target.node.id, target.node.text] as const)
  applyComponentPropertyValue(ctx.graph, instance.id, definition, text)
  const after = {
    componentPropertyAssignments: { ...instance.componentPropertyAssignments },
    instanceOverrides: cloneInstanceOverrideState(instance.instanceOverrides)
  }
  ctx.undo.push({
    label: 'Edit text',
    forward: () => {
      applyComponentPropertyValue(ctx.graph, instance.id, definition, text)
      ctx.graph.updateNode(instance.id, structuredClone(after))
      ctx.requestRender()
    },
    inverse: () => {
      ctx.graph.updateNode(instance.id, structuredClone(before))
      for (const [id, value] of othersBefore) ctx.graph.updateNode(id, { text: value })
      ctx.requestRender()
    }
  })
}
