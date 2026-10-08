import {
  applyComponentPropertyValue,
  cloneInstanceOverrideState,
  componentPropertyDefinitions,
  findComponentPropertyTargets,
  resolveComponentPropertyValue,
  setInstanceOverride
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

  function restoreTarget(instance: SceneNode, target: ComponentPropertyTarget, value: string) {
    if (target.field === 'TEXT' && target.node.type === 'TEXT') {
      ctx.graph.updateNode(target.node.id, { text: value })
    } else if (target.field === 'VISIBLE') {
      ctx.graph.updateNode(target.node.id, { visible: value === 'true' })
    } else if (target.field === 'INSTANCE_SWAP' && target.node.type === 'INSTANCE') {
      const componentId = swapTargetId(ctx, value)
      if (!componentId) return
      ctx.graph.swapInstanceComponent(target.node.id, componentId)
      setInstanceOverride(
        instance.instanceOverrides,
        instance.id,
        target.node.id,
        'sourceComponentId',
        target.source.id
      )
      ctx.graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
    }
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

    // A property can drive several layers; undo restores each one to what it showed.
    const assignedValue = instance.componentPropertyAssignments[propertyId]
    const previousValues = findComponentPropertyTargets(ctx.graph, instance, propertyId).map(
      (target) =>
        definition.type === 'INSTANCE_SWAP' && assignedValue
          ? (swapTargetId(ctx, assignedValue) ?? assignedValue)
          : targetValue(target)
    )

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
          const restoredTargets = findComponentPropertyTargets(ctx.graph, live, propertyId)
          ctx.graph.updateNode(instanceId, {
            componentPropertyAssignments: previousAssignments,
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
          })
          restoredTargets.forEach((target, index) =>
            restoreTarget(live, target, previousValues[index] ?? '')
          )
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
