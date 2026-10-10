import { uniq } from 'es-toolkit/array'

import {
  compareCanvasPosition,
  defaultVariant,
  type ComponentPropertyDefinition,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

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

export function getComponentSet(graph: SceneGraph, componentSetId: string): SceneNode | undefined {
  const node = graph.getNode(componentSetId)
  return node?.type === 'COMPONENT_SET' ? node : undefined
}

export function getVariantDefinitions(
  graph: SceneGraph,
  componentSetId: string
): ComponentPropertyDefinition[] {
  return (getComponentSet(graph, componentSetId)?.componentPropertyDefinitions ?? []).filter(
    (definition) => definition.type === 'VARIANT'
  )
}

export function getComponentSetVariants(graph: SceneGraph, componentSetId: string): SceneNode[] {
  const node = getComponentSet(graph, componentSetId)
  if (!node) return []
  return node.childIds
    .map((id) => graph.getNode(id))
    .filter((child): child is SceneNode => child?.type === 'COMPONENT')
}

export function variantValues(
  graph: SceneGraph,
  componentSetId: string,
  variant: SceneNode
): Record<string, string> {
  return Object.fromEntries(
    getVariantDefinitions(graph, componentSetId).map((definition) => [
      definition.name,
      variant.componentPropertyValues[definition.name] ?? ''
    ])
  )
}

export function collectVariantOptions(
  graph: SceneGraph,
  componentSetId: string
): Map<string, Set<string>> {
  const options = new Map<string, Set<string>>()
  for (const definition of getVariantDefinitions(graph, componentSetId)) {
    options.set(definition.name, new Set())
  }
  for (const variant of getComponentSetVariants(graph, componentSetId)) {
    for (const definition of getVariantDefinitions(graph, componentSetId)) {
      const value = variant.componentPropertyValues[definition.name]
      if (value) options.get(definition.name)?.add(value)
    }
  }
  return options
}

/** Declared values stay available even before a component uses them. */
export function getVariantOptions(graph: SceneGraph, setId: string, propertyId: string): string[] {
  const definition = getVariantDefinitions(graph, setId).find((item) => item.id === propertyId)
  if (!definition) return []
  return uniq([
    ...(definition.variantOptions ?? []),
    ...(collectVariantOptions(graph, setId).get(definition.name) ?? [])
  ])
}

export function findVariantByValues(
  graph: SceneGraph,
  componentSetId: string,
  values: Record<string, string>
): SceneNode | undefined {
  return getComponentSetVariants(graph, componentSetId)
    .sort(compareCanvasPosition)
    .find((variant) =>
      Object.entries(values).every(
        ([propertyName, value]) => variant.componentPropertyValues[propertyName] === value
      )
    )
}

export function findExactVariant(
  graph: SceneGraph,
  componentSetId: string,
  values: Record<string, string>
): SceneNode | undefined {
  const definitions = getVariantDefinitions(graph, componentSetId)
  if (definitions.some((definition) => !Object.hasOwn(values, definition.name))) return undefined
  return findVariantByValues(
    graph,
    componentSetId,
    Object.fromEntries(definitions.map((definition) => [definition.name, values[definition.name]]))
  )
}

export function getDefaultVariantForComponentSet(
  graph: SceneGraph,
  componentSetId: string
): SceneNode | undefined {
  const set = getComponentSet(graph, componentSetId)
  return set && defaultVariant(graph, set)
}

export function getComponentSetVariantConflicts(
  graph: SceneGraph,
  componentSetId: string
): VariantConflict[] {
  const definitions = getVariantDefinitions(graph, componentSetId)
  const byKey = new Map<string, VariantConflict>()
  for (const variant of getComponentSetVariants(graph, componentSetId)) {
    const values = variantValues(graph, componentSetId, variant)
    const key = definitions
      .map((definition) => `${definition.name}=${values[definition.name]}`)
      .join('\u0000')
    const entry = byKey.get(key) ?? { values, componentIds: [] }
    entry.componentIds.push(variant.id)
    byKey.set(key, entry)
  }
  return [...byKey.values()].filter((entry) => entry.componentIds.length > 1)
}

export function validateComponentSet(
  graph: SceneGraph,
  componentSetId: string
): VariantValidationIssue[] {
  const missing = getVariantDefinitions(graph, componentSetId).flatMap((definition) => {
    const componentIds = getComponentSetVariants(graph, componentSetId)
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
    ...getComponentSetVariantConflicts(graph, componentSetId).map((conflict) => ({
      kind: 'duplicate-combination' as const,
      ...conflict
    }))
  ]
}

export function hasDuplicateCombination(
  graph: SceneGraph,
  componentSetId: string,
  valuesForVariant: (variant: SceneNode) => Record<string, string>
): boolean {
  const seen = new Set<string>()
  const definitions = getVariantDefinitions(graph, componentSetId)
  for (const variant of getComponentSetVariants(graph, componentSetId)) {
    const values = valuesForVariant(variant)
    const key = definitions.map((definition) => values[definition.name] ?? '').join('\u0000')
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}
