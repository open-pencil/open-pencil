import type { SceneGraph } from '../index'
import { setInstanceOverride } from '../instance-overrides'
import { findInstanceAncestor } from '../instances'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyReferenceField,
  SceneNode
} from '../types'

export interface ComponentPropertyTarget {
  node: SceneNode
  field: ComponentPropertyReferenceField
  source: SceneNode
}

export function componentPropertyOwners(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  if (instance.type !== 'INSTANCE' || !instance.componentId) return []
  const component = graph.getNode(instance.componentId)
  if (!component) return []
  const parent = component.parentId ? graph.getNode(component.parentId) : null
  return parent?.type === 'COMPONENT_SET' ? [parent, component] : [component]
}

export function componentPropertyDefinitions(
  graph: SceneGraph,
  instance: SceneNode
): ComponentPropertyDefinition[] {
  const definitions = new Map<string, ComponentPropertyDefinition>()
  for (const owner of componentPropertyOwners(graph, instance)) {
    for (const definition of owner.componentPropertyDefinitions) {
      if (!definitions.has(definition.id)) definitions.set(definition.id, definition)
    }
  }
  return [...definitions.values()]
}

export function resolveComponentPropertyValue(graph: SceneGraph, value: string): SceneNode | null {
  const direct = graph.getNode(value)
  if (direct?.type === 'COMPONENT') return direct
  if (direct?.type === 'COMPONENT_SET') {
    const componentId = direct.childIds.find((id) => graph.getNode(id)?.type === 'COMPONENT')
    return componentId ? (graph.getNode(componentId) ?? null) : null
  }
  for (const node of graph.getAllNodes()) {
    if (
      node.type === 'COMPONENT' &&
      (node.componentKey === value || node.sourceLibraryKey === value || node.source.id === value)
    ) {
      return node
    }
  }
  return null
}

export function findComponentPropertyTarget(
  graph: SceneGraph,
  instance: SceneNode,
  propertyId: string
): ComponentPropertyTarget | null {
  return findComponentPropertyTargets(graph, instance, propertyId)[0] ?? null
}

export function findComponentPropertyTargets(
  graph: SceneGraph,
  instance: SceneNode,
  propertyId: string
): ComponentPropertyTarget[] {
  if (instance.type !== 'INSTANCE' || !instance.componentId) return []
  const component = graph.getNode(instance.componentId)
  if (!component) return []
  const targets: ComponentPropertyTarget[] = []
  const visit = (sourceParent: SceneNode, instanceParent: SceneNode): void => {
    for (const [index, childId] of sourceParent.childIds.entries()) {
      const source = graph.getNode(childId)
      const targetId = instanceParent.childIds[index]
      const target = targetId ? graph.getNode(targetId) : undefined
      if (!source || !target) continue
      const reference = source.componentPropertyReferences.find(
        (candidate) => candidate.propertyId === propertyId
      )
      if (reference) targets.push({ node: target, field: reference.field, source })
      visit(source, target)
    }
  }
  visit(component, instance)
  return targets
}

function applyTextProperty(
  graph: SceneGraph,
  owner: SceneNode,
  targets: ComponentPropertyTarget[],
  value: string
): void {
  for (const item of targets) {
    if (item.field !== 'TEXT' || item.node.type !== 'TEXT') continue
    graph.updateNode(item.node.id, { text: value })
    if (findInstanceAncestor(graph, item.node.id)) {
      setInstanceOverride(owner.instanceOverrides, owner.id, item.node.id, 'text', value)
    }
  }
}

function applyBooleanProperty(
  graph: SceneGraph,
  owner: SceneNode,
  targets: ComponentPropertyTarget[],
  value: string
): void {
  for (const item of targets) {
    if (item.field !== 'VISIBLE') continue
    const instance = findInstanceAncestor(graph, item.node.id)
    graph.updateNode(item.node.id, { visible: value === 'true' })
    if (instance) {
      setInstanceOverride(
        owner.instanceOverrides,
        owner.id,
        item.node.id,
        'visible',
        value === 'true'
      )
    }
  }
}

function applyInstanceSwapProperty(
  graph: SceneGraph,
  owner: SceneNode,
  targets: ComponentPropertyTarget[],
  target: SceneNode
): void {
  for (const item of targets) {
    if (item.field !== 'INSTANCE_SWAP' || item.node.type !== 'INSTANCE') continue
    graph.swapInstanceComponent(item.node.id, target.id)
    setInstanceOverride(owner.instanceOverrides, owner.id, item.node.id, 'name', target.name)
    setInstanceOverride(owner.instanceOverrides, owner.id, item.node.id, 'componentId', target.id)
    setInstanceOverride(
      owner.instanceOverrides,
      owner.id,
      item.node.id,
      'sourceComponentId',
      item.source.id
    )
    graph.updateNode(owner.id, { instanceOverrides: owner.instanceOverrides })
  }
}

export function applyComponentPropertyValue(
  graph: SceneGraph,
  instanceId: string,
  definition: ComponentPropertyDefinition,
  value: string
): SceneNode | null {
  const instance = graph.getNode(instanceId)
  if (instance?.type !== 'INSTANCE') return null
  if (definition.type === 'VARIANT') return null
  const targets = findComponentPropertyTargets(graph, instance, definition.id)
  const target =
    definition.type === 'INSTANCE_SWAP' ? resolveComponentPropertyValue(graph, value) : null
  if (definition.type === 'INSTANCE_SWAP' && !target) return null
  if (definition.type === 'TEXT') {
    applyTextProperty(graph, instance, targets, value)
  } else if (definition.type === 'BOOLEAN') {
    applyBooleanProperty(graph, instance, targets, value)
  } else if (target) {
    applyInstanceSwapProperty(graph, instance, targets, target)
  }
  graph.updateNode(instance.id, {
    componentPropertyAssignments: {
      ...instance.componentPropertyAssignments,
      [definition.id]: definition.type === 'INSTANCE_SWAP' && target ? target.id : value
    }
  })
  return definition.type === 'INSTANCE_SWAP' ? target : instance
}

function componentSubtree(graph: SceneGraph, componentId: string): SceneNode[] {
  const component = graph.getNode(componentId)
  if (!component) return []
  const nodes = [component]
  const visit = (node: SceneNode): void => {
    for (const child of graph.getChildren(node.id)) {
      nodes.push(child)
      visit(child)
    }
  }
  visit(component)
  return nodes
}

function componentInstances(graph: SceneGraph, componentId: string): SceneNode[] {
  return [...graph.getAllNodes()].filter(
    (node) => node.type === 'INSTANCE' && node.componentId === componentId
  )
}

function removePropertyFromNode(graph: SceneGraph, node: SceneNode, propertyId: string): void {
  if (node.componentPropertyReferences.some((reference) => reference.propertyId === propertyId)) {
    graph.updateNode(node.id, {
      componentPropertyReferences: node.componentPropertyReferences.filter(
        (reference) => reference.propertyId !== propertyId
      )
    })
  }
  if (node.type === 'INSTANCE' && propertyId in node.componentPropertyAssignments) {
    graph.updateNode(node.id, {
      componentPropertyAssignments: Object.fromEntries(
        Object.entries(node.componentPropertyAssignments).filter(([id]) => id !== propertyId)
      )
    })
  }
}

export function removeComponentProperty(
  graph: SceneGraph,
  ownerId: string,
  propertyId: string
): boolean {
  const owner = graph.getNode(ownerId)
  if (!owner || (owner.type !== 'COMPONENT' && owner.type !== 'COMPONENT_SET')) return false
  graph.updateNode(owner.id, {
    componentPropertyDefinitions: owner.componentPropertyDefinitions.filter(
      (definition) => definition.id !== propertyId
    )
  })
  const nodes = [
    ...componentSubtree(graph, owner.id),
    ...componentInstances(graph, owner.id),
    ...(owner.type === 'COMPONENT_SET'
      ? owner.childIds.flatMap((id) => [
          ...componentSubtree(graph, id),
          ...componentInstances(graph, id)
        ])
      : [])
  ]
  for (const node of nodes) removePropertyFromNode(graph, node, propertyId)
  return true
}
