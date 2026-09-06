/* eslint-disable max-lines -- component variant operations share one atomic editor domain */

import { omit } from 'es-toolkit/object'

import type {
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SceneNode
} from '@open-pencil/scene-graph'
import { buildVariantName, parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { assertNodeEditable } from '#core/editor/capabilities'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import { reapplyInstanceComponentProperties } from '#core/editor/components/properties'
import type { EditorContext } from '#core/editor/types'
import { randomHex } from '#core/random'

export type VariantConflict = {
  values: Record<string, string>
  componentIds: string[]
}

export type VariantValidationIssue =
  | ({ kind: 'duplicate-combination' } & VariantConflict)
  | {
      kind: 'missing-value'
      propertyId: string
      propertyName: string
      componentIds: string[]
    }

export type VariantTransitionResult =
  | { kind: 'changed'; componentId: string }
  | { kind: 'unchanged'; componentId: string }
  | { kind: 'unavailable'; requested: Record<string, string> }
  | { kind: 'invalid' }

export type VariantMutationResult =
  | { kind: 'changed' }
  | { kind: 'unchanged' }
  | { kind: 'conflict'; componentIds: string[] }
  | { kind: 'invalid' }

export type VariantOptionAvailability = {
  value: string
  available: boolean
}

type VariantSnapshot = {
  definitions: ComponentPropertyDefinition[]
  variants: Map<string, Pick<SceneNode, 'componentPropertyValues' | 'name'>>
}

function sortByCanvasPosition(a: SceneNode, b: SceneNode) {
  return a.y - b.y || a.x - b.x || a.name.localeCompare(b.name)
}

export function createVariantActions(ctx: EditorContext) {
  function getComponentSet(componentSetId: string): SceneNode | undefined {
    const node = ctx.graph.getNode(componentSetId)
    return node?.type === 'COMPONENT_SET' ? node : undefined
  }

  function getVariantDefinitions(componentSetId: string): ComponentPropertyDefinition[] {
    return (getComponentSet(componentSetId)?.componentPropertyDefinitions ?? []).filter(
      (definition) => definition.type === 'VARIANT'
    )
  }

  function getComponentSetPropertyDefs(componentSetId: string): ComponentPropertyDefinition[] {
    return getComponentSet(componentSetId)?.componentPropertyDefinitions ?? []
  }

  function getComponentSetVariants(componentSetId: string): SceneNode[] {
    const node = getComponentSet(componentSetId)
    if (!node) return []
    return node.childIds
      .map((id) => ctx.graph.getNode(id))
      .filter((child): child is SceneNode => child?.type === 'COMPONENT')
  }

  function assertComponentSetEditable(componentSetId: string): void {
    assertNodeEditable(ctx.graph, componentSetId)
    for (const variant of getComponentSetVariants(componentSetId)) {
      assertNodeEditable(ctx.graph, variant.id)
    }
  }

  function captureVariantSnapshot(componentSetId: string): VariantSnapshot | null {
    const componentSet = getComponentSet(componentSetId)
    if (!componentSet) return null
    return {
      definitions: structuredClone(componentSet.componentPropertyDefinitions),
      variants: new Map(
        getComponentSetVariants(componentSetId).map((variant) => [
          variant.id,
          {
            componentPropertyValues: structuredClone(variant.componentPropertyValues),
            name: variant.name
          }
        ])
      )
    }
  }

  function restoreVariantSnapshot(componentSetId: string, snapshot: VariantSnapshot): void {
    const componentSet = getComponentSet(componentSetId)
    if (!componentSet) return
    ctx.graph.updateNode(componentSetId, {
      componentPropertyDefinitions: structuredClone(snapshot.definitions)
    })
    for (const [variantId, variantSnapshot] of snapshot.variants) {
      if (!ctx.graph.getNode(variantId)) continue
      ctx.graph.updateNode(variantId, {
        componentPropertyValues: structuredClone(variantSnapshot.componentPropertyValues),
        name: variantSnapshot.name
      })
    }
    ctx.requestRender()
  }

  function recordSnapshotChange(
    componentSetId: string,
    label: string,
    before: VariantSnapshot,
    after: VariantSnapshot
  ): void {
    ctx.undo.push({
      label,
      forward: () => restoreVariantSnapshot(componentSetId, after),
      inverse: () => restoreVariantSnapshot(componentSetId, before)
    })
    ctx.requestRender()
  }

  function updateVariantName(componentSetId: string, variant: SceneNode): void {
    const values = Object.fromEntries(
      getVariantDefinitions(componentSetId).map((definition) => [
        definition.name,
        variant.componentPropertyValues[definition.name] ?? ''
      ])
    )
    ctx.graph.updateNode(variant.id, { name: buildVariantName(values) })
  }

  function refreshVariantOptions(componentSetId: string): void {
    const componentSet = getComponentSet(componentSetId)
    if (!componentSet) return
    const collected = collectVariantOptions(componentSetId)
    const definitions = componentSet.componentPropertyDefinitions.map((definition) => {
      if (definition.type !== 'VARIANT') return definition
      const present = collected.get(definition.name) ?? new Set<string>()
      const options = [
        ...(definition.variantOptions ?? []).filter((value) => present.has(value)),
        ...[...present].filter((value) => !definition.variantOptions?.includes(value))
      ]
      return {
        ...definition,
        defaultValue: options.includes(definition.defaultValue)
          ? definition.defaultValue
          : (options[0] ?? ''),
        variantOptions: options
      }
    })
    ctx.graph.updateNode(componentSetId, { componentPropertyDefinitions: definitions })
  }

  function hasDuplicateCombination(
    componentSetId: string,
    valuesForVariant: (variant: SceneNode) => Record<string, string>
  ): boolean {
    const seen = new Set<string>()
    const definitions = getVariantDefinitions(componentSetId)
    for (const variant of getComponentSetVariants(componentSetId)) {
      const values = valuesForVariant(variant)
      const key = definitions.map((definition) => values[definition.name] ?? '').join('\u0000')
      if (seen.has(key)) return true
      seen.add(key)
    }
    return false
  }

  function reorderPropertyDefinitions(componentSetId: string, propertyIds: string[]): boolean {
    assertComponentSetEditable(componentSetId)
    const componentSet = getComponentSet(componentSetId)
    const before = captureVariantSnapshot(componentSetId)
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
    if (
      propertyIds.every((id, index) => componentSet.componentPropertyDefinitions[index]?.id === id)
    )
      return true

    ctx.graph.updateNode(componentSetId, {
      componentPropertyDefinitions: propertyIds.flatMap((id) => {
        const definition = definitionsById.get(id)
        return definition ? [definition] : []
      })
    })
    for (const variant of getComponentSetVariants(componentSetId))
      updateVariantName(componentSetId, variant)
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, 'Reorder properties', before, after)
    return true
  }

  function reorderVariantValues(
    componentSetId: string,
    propertyId: string,
    values: string[]
  ): boolean {
    assertComponentSetEditable(componentSetId)
    const componentSet = getComponentSet(componentSetId)
    const definition = getVariantDefinitions(componentSetId).find((item) => item.id === propertyId)
    const currentValues = definition?.variantOptions ?? []
    const before = captureVariantSnapshot(componentSetId)
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
          ? { ...item, variantOptions: [...values], defaultValue: values[0] ?? '' }
          : item
      )
    })
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, 'Reorder variant values', before, after)
    return true
  }

  function addPropertyDefinition(
    componentSetId: string,
    name: string,
    type: ComponentPropertyType = 'VARIANT',
    defaultValue = ''
  ): string | undefined {
    assertComponentSetEditable(componentSetId)
    const node = getComponentSet(componentSetId)
    const normalizedName = name.trim()
    if (!node || !normalizedName) return undefined
    if (
      node.componentPropertyDefinitions.some((definition) => definition.name === normalizedName)
    ) {
      return undefined
    }

    const before = captureVariantSnapshot(componentSetId)
    if (!before) return undefined
    const id = `prop:${randomHex(8)}`
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
      for (const variant of getComponentSetVariants(componentSetId)) {
        ctx.graph.updateNode(variant.id, {
          componentPropertyValues: {
            ...variant.componentPropertyValues,
            [normalizedName]: defaultValue
          }
        })
        const updated = ctx.graph.getNode(variant.id)
        if (updated) updateVariantName(componentSetId, updated)
      }
      refreshVariantOptions(componentSetId)
    }
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, 'Add property', before, after)
    return id
  }

  function removePropertyDefinition(componentSetId: string, propertyId: string): boolean {
    assertComponentSetEditable(componentSetId)
    const node = getComponentSet(componentSetId)
    const definition = node?.componentPropertyDefinitions.find((item) => item.id === propertyId)
    const before = captureVariantSnapshot(componentSetId)
    if (!node || !definition || !before) return false

    ctx.graph.updateNode(componentSetId, {
      componentPropertyDefinitions: node.componentPropertyDefinitions.filter(
        (item) => item.id !== propertyId
      )
    })
    if (definition.type === 'VARIANT') {
      for (const variant of getComponentSetVariants(componentSetId)) {
        ctx.graph.updateNode(variant.id, {
          componentPropertyValues: omit(variant.componentPropertyValues, [definition.name])
        })
        const updated = ctx.graph.getNode(variant.id)
        if (updated) updateVariantName(componentSetId, updated)
      }
      refreshVariantOptions(componentSetId)
    }
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, 'Remove property', before, after)
    return true
  }

  function renamePropertyDefinition(
    componentSetId: string,
    propertyId: string,
    newName: string
  ): boolean {
    assertComponentSetEditable(componentSetId)
    const node = getComponentSet(componentSetId)
    const normalizedName = newName.trim()
    const definition = node?.componentPropertyDefinitions.find((item) => item.id === propertyId)
    const before = captureVariantSnapshot(componentSetId)
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
      for (const variant of getComponentSetVariants(componentSetId)) {
        const value = variant.componentPropertyValues[definition.name] ?? ''
        ctx.graph.updateNode(variant.id, {
          componentPropertyValues: {
            ...omit(variant.componentPropertyValues, [definition.name]),
            [normalizedName]: value
          }
        })
        const updated = ctx.graph.getNode(variant.id)
        if (updated) updateVariantName(componentSetId, updated)
      }
    }
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, 'Rename property', before, after)
    return true
  }

  function renameVariantValue(
    componentSetId: string,
    propertyId: string,
    previousValue: string,
    newValue: string
  ): boolean {
    assertComponentSetEditable(componentSetId)
    const definition = getVariantDefinitions(componentSetId).find((item) => item.id === propertyId)
    const normalizedValue = newValue.trim()
    const before = captureVariantSnapshot(componentSetId)
    const componentSet = getComponentSet(componentSetId)
    if (
      !definition ||
      !componentSet ||
      !before ||
      !normalizedValue ||
      previousValue === normalizedValue
    )
      return false
    if (
      hasDuplicateCombination(componentSetId, (variant) => ({
        ...variantValues(componentSetId, variant),
        [definition.name]:
          variant.componentPropertyValues[definition.name] === previousValue
            ? normalizedValue
            : (variant.componentPropertyValues[definition.name] ?? '')
      }))
    ) {
      return false
    }

    ctx.graph.updateNode(componentSetId, {
      componentPropertyDefinitions: componentSet.componentPropertyDefinitions.map((item) =>
        item.id === propertyId
          ? {
              ...item,
              defaultValue:
                item.defaultValue === previousValue ? normalizedValue : item.defaultValue,
              variantOptions: item.variantOptions?.map((option) =>
                option === previousValue ? normalizedValue : option
              )
            }
          : item
      )
    })
    for (const variant of getComponentSetVariants(componentSetId)) {
      if (variant.componentPropertyValues[definition.name] !== previousValue) continue
      ctx.graph.updateNode(variant.id, {
        componentPropertyValues: {
          ...variant.componentPropertyValues,
          [definition.name]: normalizedValue
        }
      })
      const updated = ctx.graph.getNode(variant.id)
      if (updated) updateVariantName(componentSetId, updated)
    }
    refreshVariantOptions(componentSetId)
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, 'Rename variant value', before, after)
    return true
  }

  function setVariantPropertyValue(
    variantId: string,
    propertyId: string,
    value: string
  ): VariantMutationResult {
    assertNodeEditable(ctx.graph, variantId)
    const variant = ctx.graph.getNode(variantId)
    const componentSetId = variant?.parentId
    if (variant?.type !== 'COMPONENT' || !componentSetId) return { kind: 'invalid' }
    const definition = getVariantDefinitions(componentSetId).find((item) => item.id === propertyId)
    const normalizedValue = value.trim()
    const before = captureVariantSnapshot(componentSetId)
    if (!definition || !before || !normalizedValue) return { kind: 'invalid' }
    if (variant.componentPropertyValues[definition.name] === normalizedValue) {
      return { kind: 'unchanged' }
    }

    const requested = {
      ...variantValues(componentSetId, variant),
      [definition.name]: normalizedValue
    }
    const conflicting = findExactVariant(componentSetId, requested)
    if (conflicting && conflicting.id !== variantId) {
      return { kind: 'conflict', componentIds: [variantId, conflicting.id] }
    }

    ctx.graph.updateNode(variantId, {
      componentPropertyValues: {
        ...variant.componentPropertyValues,
        [definition.name]: normalizedValue
      }
    })
    const updated = ctx.graph.getNode(variantId)
    if (updated) updateVariantName(componentSetId, updated)
    refreshVariantOptions(componentSetId)
    const after = captureVariantSnapshot(componentSetId)
    if (after) recordSnapshotChange(componentSetId, `Change ${definition.name}`, before, after)
    return { kind: 'changed' }
  }

  function collectVariantOptions(componentSetId: string): Map<string, Set<string>> {
    const options = new Map<string, Set<string>>()
    for (const definition of getVariantDefinitions(componentSetId)) {
      options.set(definition.name, new Set())
    }
    for (const variant of getComponentSetVariants(componentSetId)) {
      for (const definition of getVariantDefinitions(componentSetId)) {
        const value = variant.componentPropertyValues[definition.name]
        if (value) options.get(definition.name)?.add(value)
      }
    }
    return options
  }

  function variantValues(componentSetId: string, variant: SceneNode): Record<string, string> {
    return Object.fromEntries(
      getVariantDefinitions(componentSetId).map((definition) => [
        definition.name,
        variant.componentPropertyValues[definition.name] ?? ''
      ])
    )
  }

  function findVariantByValues(
    componentSetId: string,
    values: Record<string, string>
  ): SceneNode | undefined {
    return getComponentSetVariants(componentSetId)
      .sort(sortByCanvasPosition)
      .find((variant) =>
        Object.entries(values).every(
          ([propertyName, value]) => variant.componentPropertyValues[propertyName] === value
        )
      )
  }

  function findExactVariant(
    componentSetId: string,
    values: Record<string, string>
  ): SceneNode | undefined {
    const definitions = getVariantDefinitions(componentSetId)
    if (definitions.some((definition) => !Object.hasOwn(values, definition.name))) return undefined
    return findVariantByValues(
      componentSetId,
      Object.fromEntries(
        definitions.map((definition) => [definition.name, values[definition.name]])
      )
    )
  }

  function getDefaultVariantForComponentSet(componentSetId: string): SceneNode | undefined {
    return getComponentSetVariants(componentSetId).sort(sortByCanvasPosition)[0]
  }

  function getComponentSetVariantConflicts(componentSetId: string): VariantConflict[] {
    const definitions = getVariantDefinitions(componentSetId)
    const byKey = new Map<string, VariantConflict>()
    for (const variant of getComponentSetVariants(componentSetId)) {
      const values = variantValues(componentSetId, variant)
      const key = definitions
        .map((definition) => `${definition.name}=${values[definition.name]}`)
        .join('\u0000')
      const entry = byKey.get(key) ?? { values, componentIds: [] }
      entry.componentIds.push(variant.id)
      byKey.set(key, entry)
    }
    return [...byKey.values()].filter((entry) => entry.componentIds.length > 1)
  }

  function validateComponentSet(componentSetId: string): VariantValidationIssue[] {
    const missing = getVariantDefinitions(componentSetId).flatMap((definition) => {
      const componentIds = getComponentSetVariants(componentSetId)
        .filter((variant) => !variant.componentPropertyValues[definition.name]?.trim())
        .map((variant) => variant.id)
      return componentIds.length > 0
        ? [
            {
              kind: 'missing-value' as const,
              propertyId: definition.id,
              propertyName: definition.name,
              componentIds
            }
          ]
        : []
    })
    return [
      ...missing,
      ...getComponentSetVariantConflicts(componentSetId).map((conflict) => ({
        kind: 'duplicate-combination' as const,
        ...conflict
      }))
    ]
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
    const options = collectVariantOptions(componentSetId).get(propertyName) ?? new Set<string>()
    return [...options].map((value) => ({
      value,
      available: Boolean(
        findExactVariant(componentSetId, {
          ...variantValues(componentSetId, component),
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
    if (component?.type !== 'COMPONENT' || !componentSetId || !getComponentSet(componentSetId)) {
      return { kind: 'invalid' }
    }

    const requested = {
      ...variantValues(componentSetId, component),
      [propertyName]: newValue
    }
    const target = findExactVariant(componentSetId, requested)
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
    if (variant?.type !== 'COMPONENT' || !componentSetId || !getComponentSet(componentSetId)) {
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
    const source = getDefaultVariantForComponentSet(componentSetId)
    return source ? duplicateVariant(source.id) : undefined
  }

  function removeVariant(variantId: string): boolean {
    assertNodeEditable(ctx.graph, variantId)
    const variant = ctx.graph.getNode(variantId)
    const componentSetId = variant?.parentId
    if (variant?.type !== 'COMPONENT' || !componentSetId) return false
    if (getComponentSetVariants(componentSetId).length <= 1) return false
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
    addPropertyDefinition,
    removePropertyDefinition,
    renamePropertyDefinition,
    reorderPropertyDefinitions,
    renameVariantValue,
    reorderVariantValues,
    setVariantPropertyValue,
    parseVariantName,
    buildVariantName,
    collectVariantOptions,
    findVariantByValues,
    getDefaultVariantForComponentSet,
    getComponentSetVariantConflicts,
    validateComponentSet,
    getVariantOptionAvailability,
    switchInstanceVariant,
    addVariant,
    duplicateVariant,
    removeVariant
  }
}
