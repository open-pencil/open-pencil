import { idOf, type SourceIndex } from '#fig/instance-overrides/source-index'
import { extractVariantPropSpecs } from '#fig/node-change/convert'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { VariantPropSpec } from '@open-pencil/scene-graph'

/**
 * A variant record of a component set, by GUID, read from its header: its specs name the set's
 * variant properties by id, as import reads them, and its name stands in when it has none.
 */
export interface SavedVariant {
  id: string
  name: string
  specs: VariantPropSpec[]
  /** The layer a load built for it; none while it is only saved. */
  layerId: string | undefined
}

/** Every component set's variant record GUIDs, in saved order. */
export function indexComponentSetVariants(
  index: SourceIndex,
  isComponentSet: (header: NodeChange) => boolean
): Map<string, string[]> {
  const sets = new Map<string, string[]>()
  for (const [id, children] of index.children) {
    const variantIds = children.flatMap((child) => {
      const variantId = idOf(child)
      return child.type === 'SYMBOL' && variantId ? [variantId] : []
    })
    const set = index.sources.get(id)
    if (variantIds.length > 0 && set && isComponentSet(set)) {
      sets.set(id, variantIds)
    }
  }
  return sets
}

/**
 * The saved variants of the sets the graph holds, for the sets some of whose variants no load
 * has built yet, read from record headers.
 */
export function createSavedVariants(source: {
  sets: () => ReadonlyMap<string, readonly string[]>
  layerOf: () => ReadonlyMap<string, string>
  isBuilt: (id: string) => boolean
  header: (id: string) => NodeChange | undefined
}) {
  const savedVariant = (id: string): SavedVariant => {
    const header = source.header(id)
    return {
      id,
      name: header?.name ?? '',
      specs: header ? extractVariantPropSpecs(header) : [],
      layerId: source.isBuilt(id) ? source.layerOf().get(id) : undefined
    }
  }
  const savedOf = (setId: string): SavedVariant[] => {
    const variantIds = source.sets().get(setId) ?? []
    return variantIds.every(source.isBuilt) ? [] : variantIds.map(savedVariant)
  }
  return {
    ofSetLayer(layerId: string): SavedVariant[] {
      const layerOf = source.layerOf()
      for (const setId of source.sets().keys()) {
        if (layerOf.get(setId) === layerId) {
          return savedOf(setId)
        }
      }
      return []
    },
    bySetLayer(): Array<[string, SavedVariant[]]> {
      const layerOf = source.layerOf()
      return [...source.sets().keys()].flatMap((setId) => {
        const layerId = layerOf.get(setId)
        const saved = layerId ? savedOf(setId) : []
        return layerId && saved.length > 0 ? [[layerId, saved] as [string, SavedVariant[]]] : []
      })
    }
  }
}
