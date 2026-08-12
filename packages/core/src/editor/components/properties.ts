import type {
  ComponentPropertyDefinition,
  ComponentPropertyReferenceField,
  SceneNode
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

interface PropertyTarget {
  node: SceneNode
  field: ComponentPropertyReferenceField
  source: SceneNode
}

function definitionOwners(ctx: Pick<EditorContext, 'graph'>, instance: SceneNode): SceneNode[] {
  if (!instance.componentId) return []
  const component = ctx.graph.getNode(instance.componentId)
  if (!component) return []
  const parent = component.parentId ? ctx.graph.getNode(component.parentId) : null
  return parent?.type === 'COMPONENT_SET' ? [parent, component] : [component]
}

function definitionsForInstance(
  ctx: Pick<EditorContext, 'graph'>,
  instance: SceneNode
): ComponentPropertyDefinition[] {
  const byId = new Map<string, ComponentPropertyDefinition>()
  for (const owner of definitionOwners(ctx, instance)) {
    for (const definition of owner.componentPropertyDefinitions) {
      if (!byId.has(definition.id)) byId.set(definition.id, definition)
    }
  }
  return [...byId.values()]
}

function findPropertyPath(
  ctx: Pick<EditorContext, 'graph'>,
  sourceParent: SceneNode,
  propertyId: string,
  path: number[] = []
): { path: number[]; field: ComponentPropertyReferenceField; source: SceneNode } | null {
  for (const [index, childId] of sourceParent.childIds.entries()) {
    const child = ctx.graph.getNode(childId)
    if (!child) continue
    const reference = child.componentPropertyReferences.find((ref) => ref.propertyId === propertyId)
    if (reference) return { path: [...path, index], field: reference.field, source: child }
    const nested = findPropertyPath(ctx, child, propertyId, [...path, index])
    if (nested) return nested
  }
  return null
}

function nodeAtPath(
  ctx: Pick<EditorContext, 'graph'>,
  root: SceneNode,
  path: number[]
): SceneNode | null {
  let node = root
  for (const index of path) {
    const childId = node.childIds[index]
    const child = childId ? ctx.graph.getNode(childId) : undefined
    if (!child) return null
    node = child
  }
  return node
}

function propertyTarget(
  ctx: Pick<EditorContext, 'graph'>,
  instance: SceneNode,
  propertyId: string
): PropertyTarget | null {
  const component = instance.componentId ? ctx.graph.getNode(instance.componentId) : null
  if (!component) return null
  const match = findPropertyPath(ctx, component, propertyId)
  if (!match) return null
  const node = nodeAtPath(ctx, instance, match.path)
  return node ? { node, field: match.field, source: match.source } : null
}

function swapTargetId(ctx: Pick<EditorContext, 'graph'>, value: string): string | null {
  const direct = ctx.graph.getNode(value)
  if (direct?.type === 'COMPONENT') return direct.id
  for (const node of ctx.graph.getAllNodes()) {
    if (node.type !== 'COMPONENT') continue
    if (
      node.source.id === value ||
      node.componentKey === value ||
      node.sourceLibraryKey === value
    ) {
      return node.id
    }
  }
  return null
}

function targetValue(target: PropertyTarget | null): string {
  if (!target) return ''
  if (target.field === 'TEXT') return target.node.text
  if (target.field === 'VISIBLE') return String(target.node.visible)
  return target.source.componentId ?? target.node.componentId ?? ''
}

function propertyOverrides(
  ctx: Pick<EditorContext, 'graph'>,
  instance: SceneNode,
  target: PropertyTarget | null,
  value: string,
  swapComponentId: string | null
): Record<string, unknown> {
  const overrides = { ...instance.overrides }
  if (target?.field === 'TEXT') overrides[`${target.node.id}:text`] = value
  else if (target?.field === 'VISIBLE') overrides[`${target.node.id}:visible`] = value === 'true'
  else if (target?.field === 'INSTANCE_SWAP') {
    overrides[`${target.node.id}:componentId`] = value
    overrides[`${target.node.id}:sourceComponentId`] = target.source.id
    const componentName = swapComponentId ? ctx.graph.getNode(swapComponentId)?.name : undefined
    if (componentName) overrides[`${target.node.id}:name`] = componentName
  }
  return overrides
}

function updatePropertyTarget(
  ctx: Pick<EditorContext, 'graph'>,
  target: PropertyTarget | null,
  value: string,
  swapComponentId: string | null
): void {
  if (target?.field === 'TEXT' && target.node.type === 'TEXT') {
    ctx.graph.updateNode(target.node.id, { text: value })
  } else if (target?.field === 'VISIBLE') {
    ctx.graph.updateNode(target.node.id, { visible: value === 'true' })
  } else if (
    target?.field === 'INSTANCE_SWAP' &&
    target.node.type === 'INSTANCE' &&
    swapComponentId
  ) {
    ctx.graph.swapInstanceComponent(target.node.id, swapComponentId)
  }
}

function applyPropertyValue(
  ctx: Pick<EditorContext, 'graph'>,
  instanceId: string,
  definition: ComponentPropertyDefinition,
  value: string
): void {
  const instance = ctx.graph.getNode(instanceId)
  if (instance?.type !== 'INSTANCE') return
  const target = propertyTarget(ctx, instance, definition.id)
  const swapComponentId = target?.field === 'INSTANCE_SWAP' ? swapTargetId(ctx, value) : null
  ctx.graph.updateNode(instance.id, {
    componentPropertyAssignments: {
      ...instance.componentPropertyAssignments,
      [definition.id]: value
    },
    overrides: propertyOverrides(ctx, instance, target, value, swapComponentId)
  })
  updatePropertyTarget(ctx, target, value, swapComponentId)
}

export function reapplyInstanceComponentProperties(
  ctx: Pick<EditorContext, 'graph'>,
  instanceId: string
): void {
  const instance = ctx.graph.getNode(instanceId)
  if (instance?.type !== 'INSTANCE') return
  const definitions = new Map(
    definitionsForInstance(ctx, instance).map((definition) => [definition.id, definition])
  )
  for (const [propertyId, value] of Object.entries(instance.componentPropertyAssignments)) {
    const definition = definitions.get(propertyId)
    if (definition && definition.type !== 'VARIANT') {
      applyPropertyValue(ctx, instanceId, definition, value)
    }
  }
}

export function createComponentPropertyActions(
  ctx: EditorContext,
  switchVariant: (instanceId: string, propertyName: string, newValue: string) => void
) {
  function getInstanceComponentPropertyDefinitions(instanceId: string) {
    const instance = ctx.graph.getNode(instanceId)
    return instance?.type === 'INSTANCE' ? definitionsForInstance(ctx, instance) : []
  }

  function getInstanceComponentPropertyValue(
    instanceId: string,
    definition: ComponentPropertyDefinition
  ): string {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') return definition.defaultValue
    if (definition.type === 'VARIANT') {
      const component = instance.componentId ? ctx.graph.getNode(instance.componentId) : null
      return component?.componentPropertyValues[definition.name] ?? definition.defaultValue
    }
    const value = instance.componentPropertyAssignments[definition.id] ?? definition.defaultValue
    return definition.type === 'INSTANCE_SWAP' ? (swapTargetId(ctx, value) ?? value) : value
  }

  function setInstanceComponentProperty(instanceId: string, propertyId: string, value: string) {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') return
    assertNodeEditable(ctx.graph, instanceId)
    const definition = definitionsForInstance(ctx, instance).find((item) => item.id === propertyId)
    if (!definition) return
    if (definition.type === 'VARIANT') {
      switchVariant(instanceId, definition.name, value)
      return
    }

    const previousAssignments = { ...instance.componentPropertyAssignments }
    const previousOverrides = structuredClone(instance.overrides)
    const target = propertyTarget(ctx, instance, propertyId)
    const assignedValue = instance.componentPropertyAssignments[propertyId]
    const previousValue =
      definition.type === 'INSTANCE_SWAP' && assignedValue
        ? (swapTargetId(ctx, assignedValue) ?? assignedValue)
        : targetValue(target)

    applyPropertyValue(ctx, instanceId, definition, value)
    ctx.undo.push({
      label: `Change ${definition.name}`,
      forward: () => {
        applyPropertyValue(ctx, instanceId, definition, value)
        ctx.requestRender()
      },
      inverse: () => {
        const live = ctx.graph.getNode(instanceId)
        if (live) {
          ctx.graph.updateNode(instanceId, {
            componentPropertyAssignments: previousAssignments,
            overrides: previousOverrides
          })
          const restoredTarget = propertyTarget(ctx, live, propertyId)
          if (restoredTarget?.field === 'TEXT' && restoredTarget.node.type === 'TEXT') {
            ctx.graph.updateNode(restoredTarget.node.id, { text: previousValue })
          } else if (restoredTarget?.field === 'VISIBLE') {
            ctx.graph.updateNode(restoredTarget.node.id, { visible: previousValue === 'true' })
          } else if (restoredTarget?.field === 'INSTANCE_SWAP') {
            const componentId = swapTargetId(ctx, previousValue)
            if (componentId && restoredTarget.node.type === 'INSTANCE') {
              ctx.graph.swapInstanceComponent(restoredTarget.node.id, componentId)
            }
          }
        }
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  return {
    getInstanceComponentPropertyDefinitions,
    getInstanceComponentPropertyValue,
    reapplyInstanceComponentProperties: (instanceId: string) =>
      reapplyInstanceComponentProperties(ctx, instanceId),
    setInstanceComponentProperty
  }
}
