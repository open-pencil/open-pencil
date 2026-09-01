import {
  applyComponentPropertyValue,
  cloneInstanceOverrideState,
  componentPropertyDefinitions,
  findComponentPropertyTarget,
  resolveComponentPropertyValue
} from '@open-pencil/scene-graph'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyTarget,
  SceneNode
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

function definitionsForInstance(
  ctx: Pick<EditorContext, 'graph'>,
  instance: SceneNode
): ComponentPropertyDefinition[] {
  return componentPropertyDefinitions(ctx.graph, instance)
}

function propertyTarget(
  ctx: Pick<EditorContext, 'graph'>,
  instance: SceneNode,
  propertyId: string
): ComponentPropertyTarget | null {
  return findComponentPropertyTarget(ctx.graph, instance, propertyId)
}

function swapTargetId(ctx: Pick<EditorContext, 'graph'>, value: string): string | null {
  return resolveComponentPropertyValue(ctx.graph, value)?.id ?? null
}

function targetValue(target: ComponentPropertyTarget | null): string {
  if (!target) return ''
  if (target.field === 'TEXT') return target.node.text
  if (target.field === 'VISIBLE') return String(target.node.visible)
  return target.source.componentId ?? target.node.componentId ?? ''
}
function applyPropertyValue(
  ctx: Pick<EditorContext, 'graph'>,
  instanceId: string,
  definition: ComponentPropertyDefinition,
  value: string
): boolean {
  const result = applyComponentPropertyValue(ctx.graph, instanceId, definition, value)
  return definition.type !== 'INSTANCE_SWAP' || result !== null
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
    const previousOverrides = cloneInstanceOverrideState(instance.instanceOverrides)

    const target = propertyTarget(ctx, instance, propertyId)
    const assignedValue = instance.componentPropertyAssignments[propertyId]
    const previousValue =
      definition.type === 'INSTANCE_SWAP' && assignedValue
        ? (swapTargetId(ctx, assignedValue) ?? assignedValue)
        : targetValue(target)

    if (!applyPropertyValue(ctx, instanceId, definition, value)) return
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
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
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
