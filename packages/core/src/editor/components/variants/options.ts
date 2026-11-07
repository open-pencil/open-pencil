import type { EditorContext } from '#core/editor/types'

import {
  prepareComponentSetEdit,
  captureVariantSnapshot,
  recordSnapshotChange,
  setVariantValues
} from './history'
import {
  getComponentSet,
  getComponentSetVariants,
  getVariantOptions,
  variantValues,
  type VariantMutationResult
} from './model'
import { variantPropertyValues } from './saved'

export function addVariantValue(
  ctx: EditorContext,
  setId: string,
  propertyId: string,
  value: string
): boolean {
  const set = getComponentSet(ctx.graph, setId)
  const definition = set?.componentPropertyDefinitions.find(
    (item) => item.id === propertyId && item.type === 'VARIANT'
  )
  const normalized = value.trim()
  if (!set || !definition || !normalized) return false
  if (variantPropertyValues(ctx.graph, setId, propertyId).includes(normalized)) return false
  if (!prepareComponentSetEdit(ctx, setId)) return false
  const before = captureVariantSnapshot(ctx, setId)
  if (!before) return false
  const options = getVariantOptions(ctx.graph, setId, propertyId)
  ctx.graph.updateNode(setId, {
    componentPropertyDefinitions: set.componentPropertyDefinitions.map((item) =>
      item.id === propertyId ? { ...item, variantOptions: [...options, normalized] } : item
    )
  })
  const after = captureVariantSnapshot(ctx, setId)
  if (after) recordSnapshotChange(ctx, setId, 'Add variant value', before, after)
  return true
}

export function removeVariantValue(
  ctx: EditorContext,
  setId: string,
  propertyId: string,
  value: string,
  replacement?: string
): VariantMutationResult {
  const set = getComponentSet(ctx.graph, setId)
  const definition = set?.componentPropertyDefinitions.find(
    (item) => item.id === propertyId && item.type === 'VARIANT'
  )
  if (!set || !definition) return { kind: 'invalid' }
  if (!variantPropertyValues(ctx.graph, setId, propertyId).includes(value))
    return { kind: 'invalid' }
  if (!prepareComponentSetEdit(ctx, setId)) return { kind: 'invalid' }
  const before = captureVariantSnapshot(ctx, setId)
  if (!before) return { kind: 'invalid' }
  const options = getVariantOptions(ctx.graph, setId, propertyId)
  const remaining = options.filter((option) => option !== value)
  const variants = getComponentSetVariants(ctx.graph, setId)
  const affected = variants.filter(
    (node) => node.componentPropertyValues[definition.name] === value
  )
  if (affected.length && (!replacement || !remaining.includes(replacement)))
    return { kind: 'invalid' }
  if (affected.length) {
    const affectedIds = new Set(affected.map((node) => node.id))
    const combinations = new Map<string, string[]>()
    for (const node of variants) {
      const values = variantValues(ctx.graph, setId, node)
      if (affectedIds.has(node.id) && replacement) values[definition.name] = replacement
      const key = JSON.stringify(values)
      const ids = combinations.get(key) ?? []
      ids.push(node.id)
      combinations.set(key, ids)
    }
    const conflicts = [...combinations.values()]
      .filter((ids) => ids.length > 1 && ids.some((id) => affectedIds.has(id)))
      .flat()
    if (conflicts.length) return { kind: 'conflict', componentIds: conflicts }
  }
  ctx.graph.updateNode(setId, {
    componentPropertyDefinitions: set.componentPropertyDefinitions.map((item) =>
      item.id === propertyId
        ? {
            ...item,
            variantOptions: remaining,
            defaultValue:
              item.defaultValue === value
                ? (replacement ?? remaining.at(0) ?? '')
                : item.defaultValue
          }
        : item
    )
  })
  if (replacement)
    for (const node of affected)
      setVariantValues(ctx.graph, setId, node.id, {
        ...node.componentPropertyValues,
        [definition.name]: replacement
      })
  const after = captureVariantSnapshot(ctx, setId)
  if (after) recordSnapshotChange(ctx, setId, 'Remove variant value', before, after)
  return { kind: 'changed' }
}
