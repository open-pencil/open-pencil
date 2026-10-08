import { omit } from 'es-toolkit/object'

import type { ComponentPropertyDefinition, ComponentPropertyType } from '@open-pencil/scene-graph'
import { createComponentPropertyId } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

import {
  assertComponentSetEditable,
  captureVariantSnapshot,
  recordSnapshotChange,
  refreshVariantOptions,
  setVariantValues,
  updateVariantName
} from './history'
import {
  findExactVariant,
  getComponentSet,
  getComponentSetVariants,
  getVariantDefinitions,
  getVariantOptions,
  variantValues,
  type VariantMutationResult
} from './model'

export function reorderPropertyDefinitions(
  ctx: EditorContext,
  componentSetId: string,
  propertyIds: string[]
): boolean {
  assertComponentSetEditable(ctx, componentSetId)
  const componentSet = getComponentSet(ctx.graph, componentSetId)
  const before = captureVariantSnapshot(ctx, componentSetId)
  if (!componentSet || !before) return false
  const definitionsById = new Map(
    componentSet.componentPropertyDefinitions.map((definition) => [definition.id, definition])
  )
  if (
    propertyIds.length !== definitionsById.size ||
    new Set(propertyIds).size !== definitionsById.size ||
    propertyIds.some((id) => !definitionsById.has(id))
  ) {
    return false
  }
  if (propertyIds.every((id, index) => componentSet.componentPropertyDefinitions[index]?.id === id))
    return true

  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: propertyIds.flatMap((id) => {
      const definition = definitionsById.get(id)
      return definition ? [definition] : []
    })
  })
  for (const variant of getComponentSetVariants(ctx.graph, componentSetId))
    updateVariantName(ctx, componentSetId, variant)
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, 'Reorder properties', before, after)
  return true
}

export function reorderVariantValues(
  ctx: EditorContext,
  componentSetId: string,
  propertyId: string,
  values: string[]
): boolean {
  assertComponentSetEditable(ctx, componentSetId)
  const componentSet = getComponentSet(ctx.graph, componentSetId)
  const definition = getVariantDefinitions(ctx.graph, componentSetId).find(
    (item) => item.id === propertyId
  )
  const currentValues = getVariantOptions(ctx.graph, componentSetId, propertyId)
  const before = captureVariantSnapshot(ctx, componentSetId)
  if (!componentSet || !definition || !before) return false
  if (
    values.length !== currentValues.length ||
    new Set(values).size !== currentValues.length ||
    values.some((value) => !currentValues.includes(value))
  ) {
    return false
  }
  if (values.every((value, index) => currentValues[index] === value)) return true

  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: componentSet.componentPropertyDefinitions.map((item) =>
      item.id === propertyId
        ? {
            ...item,
            variantOptions: [...values],
            defaultValue: values[0] ?? ''
          }
        : item
    )
  })
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, 'Reorder variant values', before, after)
  return true
}

export function addPropertyDefinition(
  ctx: EditorContext,
  componentSetId: string,
  name: string,
  type: ComponentPropertyType = 'VARIANT',
  defaultValue = ''
): string | undefined {
  assertComponentSetEditable(ctx, componentSetId)
  const node = getComponentSet(ctx.graph, componentSetId)
  const normalizedName = name.trim()
  if (!node || !normalizedName) return undefined
  if (node.componentPropertyDefinitions.some((definition) => definition.name === normalizedName)) {
    return undefined
  }

  const before = captureVariantSnapshot(ctx, componentSetId)
  if (!before) return undefined
  const id = createComponentPropertyId()
  const definition: ComponentPropertyDefinition = {
    id,
    name: normalizedName,
    type,
    defaultValue,
    variantOptions: type === 'VARIANT' ? [defaultValue] : undefined
  }
  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: [...node.componentPropertyDefinitions, definition]
  })
  if (type === 'VARIANT') {
    for (const variant of getComponentSetVariants(ctx.graph, componentSetId)) {
      setVariantValues(ctx, componentSetId, variant.id, {
        ...variant.componentPropertyValues,
        [normalizedName]: defaultValue
      })
    }
    refreshVariantOptions(ctx, componentSetId)
  }
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, 'Add property', before, after)
  return id
}

export function removePropertyDefinition(
  ctx: EditorContext,
  componentSetId: string,
  propertyId: string
): boolean {
  assertComponentSetEditable(ctx, componentSetId)
  const node = getComponentSet(ctx.graph, componentSetId)
  const definition = node?.componentPropertyDefinitions.find((item) => item.id === propertyId)
  const before = captureVariantSnapshot(ctx, componentSetId)
  if (!node || !definition || !before) return false

  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: node.componentPropertyDefinitions.filter(
      (item) => item.id !== propertyId
    )
  })
  if (definition.type === 'VARIANT') {
    for (const variant of getComponentSetVariants(ctx.graph, componentSetId)) {
      setVariantValues(
        ctx,
        componentSetId,
        variant.id,
        omit(variant.componentPropertyValues, [definition.name])
      )
    }
    refreshVariantOptions(ctx, componentSetId)
  }
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, 'Remove property', before, after)
  return true
}

export function renamePropertyDefinition(
  ctx: EditorContext,
  componentSetId: string,
  propertyId: string,
  newName: string
): boolean {
  assertComponentSetEditable(ctx, componentSetId)
  const node = getComponentSet(ctx.graph, componentSetId)
  const normalizedName = newName.trim()
  const definition = node?.componentPropertyDefinitions.find((item) => item.id === propertyId)
  const before = captureVariantSnapshot(ctx, componentSetId)
  if (!node || !definition || !before || !normalizedName) return false
  if (
    node.componentPropertyDefinitions.some(
      (item) => item.id !== propertyId && item.name === normalizedName
    )
  ) {
    return false
  }
  if (definition.name === normalizedName) return true

  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: node.componentPropertyDefinitions.map((item) =>
      item.id === propertyId ? { ...item, name: normalizedName } : item
    )
  })
  if (definition.type === 'VARIANT') {
    for (const variant of getComponentSetVariants(ctx.graph, componentSetId)) {
      const value = variant.componentPropertyValues[definition.name] ?? ''
      setVariantValues(ctx, componentSetId, variant.id, {
        ...omit(variant.componentPropertyValues, [definition.name]),
        [normalizedName]: value
      })
    }
  }
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, 'Rename property', before, after)
  return true
}

export function renameVariantValue(
  ctx: EditorContext,
  componentSetId: string,
  propertyId: string,
  previousValue: string,
  newValue: string
): boolean {
  assertComponentSetEditable(ctx, componentSetId)
  const definition = getVariantDefinitions(ctx.graph, componentSetId).find(
    (item) => item.id === propertyId
  )
  const normalizedValue = newValue.trim()
  const before = captureVariantSnapshot(ctx, componentSetId)
  const componentSet = getComponentSet(ctx.graph, componentSetId)
  if (
    !definition ||
    !componentSet ||
    !before ||
    !normalizedValue ||
    previousValue === normalizedValue
  )
    return false
  const options = getVariantOptions(ctx.graph, componentSetId, propertyId)
  if (!options.includes(previousValue) || options.includes(normalizedValue)) return false

  ctx.graph.updateNode(componentSetId, {
    componentPropertyDefinitions: componentSet.componentPropertyDefinitions.map((item) =>
      item.id === propertyId
        ? {
            ...item,
            defaultValue: item.defaultValue === previousValue ? normalizedValue : item.defaultValue,
            variantOptions: options.map((option) =>
              option === previousValue ? normalizedValue : option
            )
          }
        : item
    )
  })
  for (const variant of getComponentSetVariants(ctx.graph, componentSetId)) {
    if (variant.componentPropertyValues[definition.name] !== previousValue) continue
    setVariantValues(ctx, componentSetId, variant.id, {
      ...variant.componentPropertyValues,
      [definition.name]: normalizedValue
    })
  }
  refreshVariantOptions(ctx, componentSetId)
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, 'Rename variant value', before, after)
  return true
}

export function setVariantPropertyValue(
  ctx: EditorContext,
  variantId: string,
  propertyId: string,
  value: string
): VariantMutationResult {
  assertNodeEditable(ctx.graph, variantId)
  const variant = ctx.graph.getNode(variantId)
  const componentSetId = variant?.parentId
  if (variant?.type !== 'COMPONENT' || !componentSetId) return { kind: 'invalid' }
  const definition = getVariantDefinitions(ctx.graph, componentSetId).find(
    (item) => item.id === propertyId
  )
  const normalizedValue = value.trim()
  const before = captureVariantSnapshot(ctx, componentSetId)
  if (!definition || !before || !normalizedValue) return { kind: 'invalid' }
  if (variant.componentPropertyValues[definition.name] === normalizedValue) {
    return { kind: 'unchanged' }
  }

  const requested = {
    ...variantValues(ctx.graph, componentSetId, variant),
    [definition.name]: normalizedValue
  }
  const conflicting = findExactVariant(ctx.graph, componentSetId, requested)
  if (conflicting && conflicting.id !== variantId) {
    return { kind: 'conflict', componentIds: [variantId, conflicting.id] }
  }

  setVariantValues(ctx, componentSetId, variantId, {
    ...variant.componentPropertyValues,
    [definition.name]: normalizedValue
  })
  refreshVariantOptions(ctx, componentSetId)
  const after = captureVariantSnapshot(ctx, componentSetId)
  if (after) recordSnapshotChange(ctx, componentSetId, `Change ${definition.name}`, before, after)
  return { kind: 'changed' }
}
