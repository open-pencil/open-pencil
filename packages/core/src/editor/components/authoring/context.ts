import type {
  ComponentPropertyReferenceField,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'

import { getNodeEditCapability } from '#core/editor/capabilities'

export type ExposableComponentField = Exclude<ComponentPropertyReferenceField, 'SLOT_CONTENT'>

export const COMPONENT_FIELD_TYPES = {
  TEXT: 'TEXT',
  VISIBLE: 'BOOLEAN',
  INSTANCE_SWAP: 'INSTANCE_SWAP'
} as const

/** Instance descendants belong to their source component, not the enclosing definition. */
export function componentAuthoringContext(graph: SceneGraph, nodeId: string) {
  const node = graph.getNode(nodeId)
  if (!node) return null
  let component: SceneNode | undefined = node
  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') {
    component = node.parentId
      ? graph.closest(
          node.parentId,
          (item) => item.type === 'COMPONENT' || item.type === 'INSTANCE'
        )
      : undefined
  }
  if (!component || component.type === 'INSTANCE') return null
  const parent = component.parentId ? graph.getNode(component.parentId) : undefined
  const owner = parent?.type === 'COMPONENT_SET' ? parent : component
  const owners = owner.id === component.id ? [owner] : [owner, component]
  const fields: ExposableComponentField[] = []
  if (node.id !== component.id) {
    fields.push('VISIBLE')
    if (node.type === 'TEXT') fields.push('TEXT')
    if (node.type === 'INSTANCE') fields.push('INSTANCE_SWAP')
  }
  return {
    node,
    component,
    owner,
    owners,
    fields,
    editable: getNodeEditCapability(graph, node.id).editable
  }
}

export function componentBindingNodes(graph: SceneGraph, ownerId: string): SceneNode[] {
  const nodes: SceneNode[] = []
  const visit = (id: string) => {
    for (const child of graph.getChildren(id)) {
      nodes.push(child)
      if (child.type !== 'INSTANCE') visit(child.id)
    }
  }
  visit(ownerId)
  return nodes
}

export function componentFieldValue(node: SceneNode, field: ExposableComponentField): string {
  if (field === 'TEXT') return node.text
  if (field === 'VISIBLE') return String(node.visible)
  return node.componentId ?? ''
}

export function componentPropertyNameExists(
  graph: SceneGraph,
  owner: SceneNode,
  name: string,
  exceptId?: string
): boolean {
  const scopes = [owner]
  const parent = owner.parentId ? graph.getNode(owner.parentId) : undefined
  if (parent?.type === 'COMPONENT_SET') scopes.push(parent)
  if (owner.type === 'COMPONENT_SET') {
    scopes.push(...graph.getChildren(owner.id).filter((node) => node.type === 'COMPONENT'))
  }
  return scopes.some((scope) =>
    scope.componentPropertyDefinitions.some(
      (definition) => definition.id !== exceptId && definition.name === name
    )
  )
}

/** The source layers and fields controlled by one component property. */
export function componentPropertySources(graph: SceneGraph, ownerId: string, propertyId: string) {
  return componentBindingNodes(graph, ownerId).flatMap((node) =>
    node.componentPropertyReferences
      .filter(
        (reference) => reference.propertyId === propertyId && reference.field !== 'SLOT_CONTENT'
      )
      .map((reference) => ({ node, field: reference.field as ExposableComponentField }))
  )
}
