import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

import { loadReaderVariant, savedReaderVariants } from '#core/kiwi/fig/session/document-state'

import { findExactVariant, getVariantDefinitions } from './model'

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

/**
 * Every variant of the set the opened file holds, in saved order, with its values, when some of
 * them are not built yet. Empty when every variant is built.
 */
export function savedVariantValues(graph: SceneGraph, setId: string): SavedVariantValues[] {
  const definitions = getVariantDefinitions(graph, setId)
  return savedReaderVariants(graph, setId).map((variant) => ({
    id: variant.id,
    built: variant.built,
    values: savedValues(definitions, variant)
  }))
}

function shows(values: Record<string, string>, wanted: Record<string, string>): boolean {
  return Object.entries(wanted).every(([name, value]) => values[name] === value)
}

function unbuiltVariantsShowing(
  graph: SceneGraph,
  setId: string,
  wanted: Record<string, string>
): SavedVariantValues[] {
  return savedVariantValues(graph, setId).filter(
    (variant) => !variant.built && shows(variant.values, wanted)
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
  const definitions = getVariantDefinitions(graph, setId)
  if (definitions.some((definition) => !Object.hasOwn(requested, definition.name))) {
    return undefined
  }
  const exact = Object.fromEntries(
    definitions.map((definition) => [definition.name, requested[definition.name]])
  )
  const unbuilt = unbuiltVariantsShowing(graph, setId, exact).at(0)
  return unbuilt ? graph.getNode(loadReaderVariant(graph, unbuilt.id) ?? '') : undefined
}
