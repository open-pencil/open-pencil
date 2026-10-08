import { pick } from 'es-toolkit/object'

import {
  applyComponentPropertyValue,
  cloneInstanceOverrideState,
  componentPropertyDefinitions,
  findComponentPropertyTargets
} from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

import { componentAuthoringContext, componentPropertySources } from './context'
import { componentPropertyTextChanges } from './values'

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

interface LayerChanges {
  id: string
  changes: Partial<SceneNode>
}

/** What showing `text` changes on each layer, resizing included, and what it changes back. */
function layerTextChanges(layers: SceneNode[], text: string) {
  const after: LayerChanges[] = layers.map((layer) => ({
    id: layer.id,
    changes: componentPropertyTextChanges(layer, text)
  }))
  const before: LayerChanges[] = after.map(({ id, changes }, index) => ({
    id,
    changes: pick(layers[index], Object.keys(changes) as (keyof SceneNode)[])
  }))
  return { before, after }
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
  // Every other layer the property drives shows the same default, resized as an edit would be.
  const others = componentPropertySources(ctx.graph, owner.id, propertyId).flatMap((source) =>
    source.node.id !== node.id && source.node.type === 'TEXT' ? [source.node] : []
  )
  const { before: othersBefore, after: othersAfter } = layerTextChanges(others, text)
  const apply = (definitions: typeof before, layers: LayerChanges[]) => {
    ctx.graph.updateNode(owner.id, { componentPropertyDefinitions: structuredClone(definitions) })
    for (const layer of layers) {
      ctx.graph.updateNode(layer.id, structuredClone(layer.changes))
      ctx.runLayoutForNode(layer.id)
    }
    ctx.requestRender()
  }
  ctx.undo.execute({
    label: 'Edit text',
    forward: () => apply(after, othersAfter),
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
  // Other layers the property drives in this instance change and resize with it, and undo with it.
  const others = findComponentPropertyTargets(ctx.graph, instance, propertyId).flatMap((target) =>
    target.node.id !== node.id && target.node.type === 'TEXT' ? [target.node] : []
  )
  const { before: othersBefore, after: othersAfter } = layerTextChanges(others, text)
  const apply = (values: typeof before, layers: LayerChanges[]) => {
    ctx.graph.updateNode(instance.id, structuredClone(values))
    for (const layer of layers) ctx.graph.updateNode(layer.id, structuredClone(layer.changes))
    ctx.runLayoutForNode(instance.id)
    ctx.requestRender()
  }
  applyComponentPropertyValue(ctx.graph, instance.id, definition, text)
  const after = {
    componentPropertyAssignments: { ...instance.componentPropertyAssignments },
    instanceOverrides: cloneInstanceOverrideState(instance.instanceOverrides)
  }
  apply(after, othersAfter)
  ctx.undo.push({
    label: 'Edit text',
    forward: () => apply(after, othersAfter),
    inverse: () => apply(before, othersBefore)
  })
}
