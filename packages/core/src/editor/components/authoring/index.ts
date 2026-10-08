import { isEqual } from 'es-toolkit'

import {
  createComponentPropertyId,
  exposableInstances,
  instanceExposureIssue,
  removeComponentProperty,
  resolveComponentPropertyValue
} from '@open-pencil/scene-graph'
import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import { reorderPropertyDefinitions } from '#core/editor/components/variants/definitions'
import type { EditorContext } from '#core/editor/types'

import {
  COMPONENT_FIELD_TYPES,
  componentAuthoringContext,
  componentBindingNodes,
  componentPropertySources,
  componentFieldValue,
  componentPropertyNameExists,
  type ExposableComponentField
} from './context'
import { createAuthoringValueActions } from './values'

/** Property types a layer field can drive; variants and slots have their own authoring. */
const AUTHORED_TYPES = new Set<ComponentPropertyDefinition['type']>([
  'TEXT',
  'BOOLEAN',
  'INSTANCE_SWAP'
])

type PropertyMetadata = Pick<
  SceneNode,
  'componentPropertyDefinitions' | 'componentPropertyReferences' | 'componentPropertyAssignments'
>

function metadata(node: SceneNode): PropertyMetadata {
  return structuredClone({
    componentPropertyDefinitions: node.componentPropertyDefinitions,
    componentPropertyReferences: node.componentPropertyReferences,
    componentPropertyAssignments: node.componentPropertyAssignments
  })
}

/** Move one item within the subset `movable` selects, leaving the others where they are. */
function moveWithin(ids: string[], movable: Set<string>, sourceId: string, index: number) {
  const subset = ids.filter((id) => movable.has(id))
  const from = subset.indexOf(sourceId)
  if (from === -1 || index < 0 || index >= subset.length) return null
  subset.splice(from, 1)
  subset.splice(index, 0, sourceId)
  let next = 0
  return ids.map((id) => (movable.has(id) ? subset[next++] : id))
}

/** Create, link, edit and remove a main component's text, boolean and swap properties. */
export function createComponentAuthoringActions(ctx: EditorContext) {
  function patch(id: string, changes: Partial<SceneNode>, label: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const before = Object.fromEntries(
      Object.keys(changes).map((key) => [key, structuredClone(node[key as keyof SceneNode])])
    )
    const apply = (values: Partial<SceneNode>) => {
      ctx.graph.updateNode(id, structuredClone(values))
      if ('text' in values || 'visible' in values) ctx.runLayoutForNode(id)
      ctx.requestRender()
    }
    ctx.undo.execute({
      label,
      forward: () => apply(changes),
      inverse: () => apply(before)
    })
  }

  const sourceValues = createAuthoringValueActions(ctx, patch)

  function bindingContext(nodeId: string, field: ExposableComponentField) {
    const context = componentAuthoringContext(ctx.graph, nodeId)
    if (!context?.fields.includes(field)) return null
    assertNodeEditable(ctx.graph, nodeId)
    assertNodeEditable(ctx.graph, context.owner.id)
    return context
  }

  function bindComponentProperty(
    nodeId: string,
    field: ExposableComponentField,
    propertyId: string | null
  ): boolean {
    const context = bindingContext(nodeId, field)
    if (!context) return false
    const { node, owners } = context
    const definition = owners
      .flatMap((item) => item.componentPropertyDefinitions)
      .find((item) => item.id === propertyId)
    if (propertyId && definition?.type !== COMPONENT_FIELD_TYPES[field]) return false
    if (definition && !sourceValues.accepts(node, field, definition.defaultValue)) return false
    const references = node.componentPropertyReferences.filter((item) => item.field !== field)
    if (propertyId) references.push({ propertyId, field })
    if (isEqual(references, node.componentPropertyReferences)) return true

    ctx.undo.runBatch(propertyId ? 'Link component property' : 'Detach component property', () => {
      patch(nodeId, { componentPropertyReferences: references }, 'Link component property')
      // A linked layer shows the property's default, as every instance without a value does.
      if (definition) sourceValues.apply(node, field, definition.defaultValue)
    })
    return true
  }

  function createComponentProperty(
    ownerId: string,
    name: string,
    type: ComponentPropertyDefinition['type'],
    defaultValue: string
  ): string | null {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return null
    assertNodeEditable(ctx.graph, ownerId)
    const normalizedName = name.trim()
    if (!normalizedName || componentPropertyNameExists(ctx.graph, owner, normalizedName))
      return null
    if (!AUTHORED_TYPES.has(type)) return null
    if (type === 'BOOLEAN' && defaultValue !== 'true' && defaultValue !== 'false') return null
    if (type === 'INSTANCE_SWAP' && !resolveComponentPropertyValue(ctx.graph, defaultValue))
      return null
    const id = createComponentPropertyId()
    const definition: ComponentPropertyDefinition = { id, name: normalizedName, type, defaultValue }
    patch(
      ownerId,
      { componentPropertyDefinitions: [...owner.componentPropertyDefinitions, definition] },
      'Create component property'
    )
    return id
  }

  /** Create a property from a layer field, defaulting to what the layer shows, and link it. */
  function exposeComponentProperty(
    nodeId: string,
    field: ExposableComponentField,
    name: string
  ): string | null {
    const context = bindingContext(nodeId, field)
    if (!context) return null
    let id: string | null = null
    ctx.undo.runBatch('Create component property', () => {
      id = createComponentProperty(
        context.owner.id,
        name,
        COMPONENT_FIELD_TYPES[field],
        componentFieldValue(context.node, field)
      )
      if (id) bindComponentProperty(nodeId, field, id)
    })
    return id
  }

  function editableProperty(ownerId: string, propertyId: string) {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return null
    assertNodeEditable(ctx.graph, ownerId)
    const definition = owner.componentPropertyDefinitions.find((item) => item.id === propertyId)
    return definition && AUTHORED_TYPES.has(definition.type) ? { owner, definition } : null
  }

  function renameComponentProperty(ownerId: string, propertyId: string, name: string): boolean {
    const editable = editableProperty(ownerId, propertyId)
    const normalizedName = name.trim()
    if (
      !editable ||
      !normalizedName ||
      componentPropertyNameExists(ctx.graph, editable.owner, normalizedName, propertyId)
    )
      return false
    const { owner, definition } = editable
    if (definition.name === normalizedName) return true
    patch(
      ownerId,
      {
        componentPropertyDefinitions: owner.componentPropertyDefinitions.map((item) =>
          item.id === propertyId ? { ...item, name: normalizedName } : item
        )
      },
      'Rename component property'
    )
    return true
  }

  /** The property's one default, shown by every linked layer and every instance without a value. */
  function setComponentPropertyDefault(
    ownerId: string,
    propertyId: string,
    value: string
  ): boolean {
    const editable = editableProperty(ownerId, propertyId)
    if (!editable) return false
    const { owner, definition } = editable
    if (definition.type === 'BOOLEAN' && value !== 'true' && value !== 'false') return false
    if (definition.type === 'INSTANCE_SWAP' && !resolveComponentPropertyValue(ctx.graph, value))
      return false
    const targets = componentPropertySources(ctx.graph, ownerId, propertyId)
    if (targets.some(({ node, field }) => !sourceValues.accepts(node, field, value))) return false
    for (const { node } of targets) assertNodeEditable(ctx.graph, node.id)
    if (definition.defaultValue === value) return true
    ctx.undo.runBatch('Change component property default', () => {
      patch(
        ownerId,
        {
          componentPropertyDefinitions: owner.componentPropertyDefinitions.map((item) =>
            item.id === propertyId ? { ...item, defaultValue: value } : item
          )
        },
        'Change component property default'
      )
      for (const { node, field } of targets) sourceValues.apply(node, field, value)
    })
    return true
  }

  function deleteComponentProperty(ownerId: string, propertyId: string): boolean {
    if (!editableProperty(ownerId, propertyId)) return false
    const affected = [...ctx.graph.getAllNodes()].filter(
      (node) =>
        node.id === ownerId ||
        node.componentPropertyReferences.some((reference) => reference.propertyId === propertyId) ||
        Object.hasOwn(node.componentPropertyAssignments, propertyId)
    )
    const before = new Map(affected.map((node) => [node.id, metadata(node)]))
    removeComponentProperty(ctx.graph, ownerId, propertyId)
    const after = new Map(affected.map((node) => [node.id, metadata(node)]))
    const apply = (values: Map<string, PropertyMetadata>) => {
      for (const [id, value] of values) ctx.graph.updateNode(id, structuredClone(value))
      ctx.requestRender()
    }
    ctx.undo.push({
      label: 'Delete component property',
      forward: () => apply(after),
      inverse: () => apply(before)
    })
    ctx.requestRender()
    return true
  }

  /**
   * Move a property among its siblings; slots keep their place. `.fig` keeps the order, and a
   * set's variant names follow its variant properties' order.
   */
  function moveComponentProperty(ownerId: string, propertyId: string, index: number): boolean {
    const owner = ctx.graph.getNode(ownerId)
    if (owner?.type !== 'COMPONENT' && owner?.type !== 'COMPONENT_SET') return false
    assertNodeEditable(ctx.graph, ownerId)
    const ids = owner.componentPropertyDefinitions.map((definition) => definition.id)
    const movable = new Set(
      owner.componentPropertyDefinitions
        .filter((definition) => definition.type !== 'SLOT')
        .map((definition) => definition.id)
    )
    if (!movable.has(propertyId)) return false
    const order = moveWithin(ids, movable, propertyId, index)
    if (!order || isEqual(order, ids)) return !!order
    if (owner.type === 'COMPONENT_SET') return reorderPropertyDefinitions(ctx, owner.id, order)
    const byId = new Map(owner.componentPropertyDefinitions.map((item) => [item.id, item]))
    patch(
      owner.id,
      { componentPropertyDefinitions: order.flatMap((id) => byId.get(id) ?? []) },
      'Reorder component properties'
    )
    return true
  }

  /** Show a nested instance's properties on instances of its component, as Figma does. */
  function setInstanceExposed(nodeId: string, exposed: boolean): boolean {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'INSTANCE') return false
    const issue = instanceExposureIssue(ctx.graph, node)
    if (issue === 'not-in-component' || issue === 'not-primary') return false
    if (exposed && issue) return false
    assertNodeEditable(ctx.graph, nodeId)
    if (node.isExposedInstance === exposed) return true
    patch(
      nodeId,
      { isExposedInstance: exposed },
      exposed ? 'Expose nested instance' : 'Hide nested instance'
    )
    return true
  }

  return {
    getComponentPropertyAuthoring: (nodeId: string) => componentAuthoringContext(ctx.graph, nodeId),
    getComponentPropertyBindings: (ownerId: string, propertyId: string) =>
      componentBindingNodes(ctx.graph, ownerId).flatMap((node) =>
        node.componentPropertyReferences
          .filter((reference) => reference.propertyId === propertyId)
          .map((reference) => ({ nodeId: node.id, name: node.name, field: reference.field }))
      ),
    getExposableInstances: (componentId: string) => exposableInstances(ctx.graph, componentId),
    createComponentProperty,
    exposeComponentProperty,
    bindComponentProperty,
    renameComponentProperty,
    setComponentPropertyDefault,
    deleteComponentProperty,
    moveComponentProperty,
    setInstanceExposed
  }
}
