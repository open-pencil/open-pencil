import type { ComponentPropertyDefinition, ComponentPropertyType } from '@open-pencil/scene-graph'
import { buildVariantName, parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { assertNodeEditable } from '#core/editor/capabilities'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import { reapplyInstanceComponentProperties } from '#core/editor/components/properties'
import type { EditorContext } from '#core/editor/types'

import {
  addPropertyDefinition,
  removePropertyDefinition,
  renamePropertyDefinition,
  renameVariantValue,
  reorderPropertyDefinitions,
  reorderVariantValues,
  setVariantPropertyValue
} from './definitions'
import {
  collectVariantOptions,
  findExactVariant,
  findVariantByValues,
  getComponentSet,
  getComponentSetVariantConflicts,
  getComponentSetVariants,
  getDefaultVariantForComponentSet,
  validateComponentSet,
  variantValues,
  type VariantOptionAvailability,
  type VariantTransitionResult
} from './model'

export type {
  VariantConflict,
  VariantMutationResult,
  VariantOptionAvailability,
  VariantTransitionResult,
  VariantValidationIssue
} from './model'

/**
 * Variant authoring on component sets: property definitions and values (in `definitions`), the
 * set's variants, and switching an instance between them. Each edit is one undo step.
 */
export function createVariantActions(ctx: EditorContext) {
  function getComponentSetPropertyDefs(componentSetId: string): ComponentPropertyDefinition[] {
    return getComponentSet(ctx.graph, componentSetId)?.componentPropertyDefinitions ?? []
  }

  function getVariantOptionAvailability(
    instanceId: string,
    propertyName: string
  ): VariantOptionAvailability[] {
    const instance = ctx.graph.getNode(instanceId)
    const component = instance?.componentId ? ctx.graph.getNode(instance.componentId) : undefined
    const componentSetId = component?.parentId
    if (instance?.type !== 'INSTANCE' || component?.type !== 'COMPONENT' || !componentSetId) {
      return []
    }
    const options =
      collectVariantOptions(ctx.graph, componentSetId).get(propertyName) ?? new Set<string>()
    return [...options].map((value) => ({
      value,
      available: Boolean(
        findExactVariant(ctx.graph, componentSetId, {
          ...variantValues(ctx.graph, componentSetId, component),
          [propertyName]: value
        })
      )
    }))
  }

  function switchInstanceVariant(
    instanceId: string,
    propertyName: string,
    newValue: string
  ): VariantTransitionResult {
    assertNodeEditable(ctx.graph, instanceId)
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE' || !instance.componentId) return { kind: 'invalid' }
    const component = ctx.graph.getNode(instance.componentId)
    const componentSetId = component?.parentId
    if (
      component?.type !== 'COMPONENT' ||
      !componentSetId ||
      !getComponentSet(ctx.graph, componentSetId)
    ) {
      return { kind: 'invalid' }
    }

    const requested = {
      ...variantValues(ctx.graph, componentSetId, component),
      [propertyName]: newValue
    }
    const target = findExactVariant(ctx.graph, componentSetId, requested)
    if (!target) return { kind: 'unavailable', requested }
    if (target.id === instance.componentId) return { kind: 'unchanged', componentId: target.id }

    const previousComponentId = instance.componentId
    const applyComponent = (componentId: string) => {
      ctx.graph.swapInstanceComponent(instanceId, componentId)
      reapplyInstanceComponentProperties(ctx, instanceId)
      ctx.requestRender()
    }
    applyComponent(target.id)
    ctx.undo.push({
      label: 'Switch variant',
      forward: () => applyComponent(target.id),
      inverse: () => applyComponent(previousComponentId)
    })
    return { kind: 'changed', componentId: target.id }
  }

  function duplicateVariant(variantId: string): string | undefined {
    assertNodeEditable(ctx.graph, variantId)
    const variant = ctx.graph.getNode(variantId)
    const componentSetId = variant?.parentId
    if (
      variant?.type !== 'COMPONENT' ||
      !componentSetId ||
      !getComponentSet(ctx.graph, componentSetId)
    ) {
      return undefined
    }
    const clone = ctx.graph.cloneTree(variantId, componentSetId, {
      x: variant.x + variant.width + 40,
      name: variant.name
    })
    if (!clone) return undefined
    const snapshots = snapshotSubtree(ctx.graph, clone.id)
    ctx.setSelectedIds(new Set([clone.id]))
    ctx.undo.push({
      label: 'Add variant',
      forward: () => {
        const root = snapshots.get(clone.id)
        if (root) restoreSubtree(ctx.graph, root, componentSetId, snapshots)
        ctx.setSelectedIds(new Set([clone.id]))
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.deleteNode(clone.id)
        ctx.setSelectedIds(new Set([variantId]))
        ctx.requestRender()
      }
    })
    ctx.requestRender()
    return clone.id
  }

  function addVariant(componentSetId: string): string | undefined {
    const source = getDefaultVariantForComponentSet(ctx.graph, componentSetId)
    return source ? duplicateVariant(source.id) : undefined
  }

  function removeVariant(variantId: string): boolean {
    assertNodeEditable(ctx.graph, variantId)
    const variant = ctx.graph.getNode(variantId)
    const componentSetId = variant?.parentId
    if (variant?.type !== 'COMPONENT' || !componentSetId) return false
    if (getComponentSetVariants(ctx.graph, componentSetId).length <= 1) return false
    const snapshots = snapshotSubtree(ctx.graph, variantId)
    ctx.graph.deleteNode(variantId)
    ctx.setSelectedIds(new Set([componentSetId]))
    ctx.undo.push({
      label: 'Remove variant',
      forward: () => {
        ctx.graph.deleteNode(variantId)
        ctx.setSelectedIds(new Set([componentSetId]))
        ctx.requestRender()
      },
      inverse: () => {
        const root = snapshots.get(variantId)
        if (root) restoreSubtree(ctx.graph, root, componentSetId, snapshots)
        ctx.setSelectedIds(new Set([variantId]))
        ctx.requestRender()
      }
    })
    ctx.requestRender()
    return true
  }

  return {
    getComponentSetPropertyDefs,
    addPropertyDefinition: (
      componentSetId: string,
      name: string,
      type?: ComponentPropertyType,
      defaultValue?: string
    ) => addPropertyDefinition(ctx, componentSetId, name, type, defaultValue),
    removePropertyDefinition: (componentSetId: string, propertyId: string) =>
      removePropertyDefinition(ctx, componentSetId, propertyId),
    renamePropertyDefinition: (componentSetId: string, propertyId: string, newName: string) =>
      renamePropertyDefinition(ctx, componentSetId, propertyId, newName),
    reorderPropertyDefinitions: (componentSetId: string, propertyIds: string[]) =>
      reorderPropertyDefinitions(ctx, componentSetId, propertyIds),
    renameVariantValue: (
      componentSetId: string,
      propertyId: string,
      previousValue: string,
      newValue: string
    ) => renameVariantValue(ctx, componentSetId, propertyId, previousValue, newValue),
    reorderVariantValues: (componentSetId: string, propertyId: string, values: string[]) =>
      reorderVariantValues(ctx, componentSetId, propertyId, values),
    setVariantPropertyValue: (variantId: string, propertyId: string, value: string) =>
      setVariantPropertyValue(ctx, variantId, propertyId, value),
    parseVariantName,
    buildVariantName,
    collectVariantOptions: (componentSetId: string) =>
      collectVariantOptions(ctx.graph, componentSetId),
    findVariantByValues: (componentSetId: string, values: Record<string, string>) =>
      findVariantByValues(ctx.graph, componentSetId, values),
    getDefaultVariantForComponentSet: (componentSetId: string) =>
      getDefaultVariantForComponentSet(ctx.graph, componentSetId),
    getComponentSetVariantConflicts: (componentSetId: string) =>
      getComponentSetVariantConflicts(ctx.graph, componentSetId),
    validateComponentSet: (componentSetId: string) =>
      validateComponentSet(ctx.graph, componentSetId),
    getVariantOptionAvailability,
    switchInstanceVariant,
    addVariant,
    duplicateVariant,
    removeVariant
  }
}
