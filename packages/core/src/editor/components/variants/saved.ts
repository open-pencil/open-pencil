import { uniq } from 'es-toolkit/array'

import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

import {
  loadReaderVariant,
  loadReaderVariants,
  savedReaderVariants
} from '#core/kiwi/fig/session/document-state'

import { findExactVariant, getVariantDefinitions, getVariantOptions, variantValues } from './model'

type SavedReaderVariant = ReturnType<typeof savedReaderVariants>[number]

export interface SavedVariantValues {
  id: string
  built: boolean
  values: Record<string, string>
}

/** A saved variant's values by the set's current property names, read as import reads them. */
function savedValues(
  definitions: readonly ComponentPropertyDefinition[],
  variant: SavedReaderVariant
): Record<string, string> {
  const fromName: Record<string, string> = {
    ...Object.fromEntries(definitions.map((definition) => [definition.name, ''])),
    ...(variant.specs.length === 0 ? parseVariantName(variant.name) : {})
  }
  return Object.fromEntries(
    definitions.map((definition) => [
      definition.name,
      variant.specs.find((spec) => spec.propDefId === definition.id)?.value ??
        fromName[definition.name]
    ])
  )
}

/** A built variant shows the values its layer has now; one the user deleted shows none. */
function currentValues(
  graph: SceneGraph,
  setId: string,
  definitions: readonly ComponentPropertyDefinition[],
  variant: SavedReaderVariant
): SavedVariantValues[] {
  if (variant.layerId === undefined) {
    return [{ id: variant.id, built: false, values: savedValues(definitions, variant) }]
  }
  const layer = graph.getNode(variant.layerId)
  return layer ? [{ id: variant.id, built: true, values: variantValues(graph, setId, layer) }] : []
}

/**
 * Every variant of the set the opened file holds, in saved order, with its values, when some of
 * them are not built yet. Empty when every variant is built.
 */
export function savedVariantValues(graph: SceneGraph, setId: string): SavedVariantValues[] {
  const definitions = getVariantDefinitions(graph, setId)
  return savedReaderVariants(graph, setId).flatMap((variant) =>
    currentValues(graph, setId, definitions, variant)
  )
}

/**
 * Build every variant of the set the opened file holds, so an edit to the set's properties,
 * values or names reaches all of them, as it does a set whose variants are all built. Returns
 * whether they are: none is when one of them nests a layer the user deleted. When `accept`
 * throws once they are built, they are removed again and the error rethrown.
 */
export function buildSavedVariants(graph: SceneGraph, setId: string, accept?: () => void): boolean {
  const unbuiltIds = savedReaderVariants(graph, setId)
    .filter((variant) => variant.layerId === undefined)
    .map((variant) => variant.id)
  return unbuiltIds.length === 0 || loadReaderVariants(graph, unbuiltIds, accept)
}

/** A variant property's values across the set, those of variants not built yet included. */
export function variantPropertyValues(
  graph: SceneGraph,
  setId: string,
  propertyId: string
): string[] {
  const definition = getVariantDefinitions(graph, setId).find((item) => item.id === propertyId)
  const saved = definition
    ? savedVariantValues(graph, setId).flatMap(({ values }) => values[definition.name] || [])
    : []
  return uniq([...getVariantOptions(graph, setId, propertyId), ...saved])
}

function shows(values: Record<string, string>, wanted: Record<string, string>): boolean {
  return Object.entries(wanted).every(([name, value]) => values[name] === value)
}

/** A variant the file saves with exactly these values that no load has built. */
export function unbuiltVariantWith(
  graph: SceneGraph,
  setId: string,
  requested: Record<string, string>
): SavedVariantValues | undefined {
  const definitions = getVariantDefinitions(graph, setId)
  if (definitions.some((definition) => !Object.hasOwn(requested, definition.name))) {
    return undefined
  }
  const exact = Object.fromEntries(
    definitions.map((definition) => [definition.name, requested[definition.name]])
  )
  return savedVariantValues(graph, setId).find(
    (variant) => !variant.built && shows(variant.values, exact)
  )
}

/** The variant with exactly these values, built from the opened file first when no load built it. */
export function findOrBuildVariant(
  graph: SceneGraph,
  setId: string,
  requested: Record<string, string>
): SceneNode | undefined {
  const built = findExactVariant(graph, setId, requested)
  if (built) {
    return built
  }
  const unbuilt = unbuiltVariantWith(graph, setId, requested)
  return unbuilt ? graph.getNode(loadReaderVariant(graph, unbuilt.id) ?? '') : undefined
}
