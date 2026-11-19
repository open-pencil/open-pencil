import { isEqual } from 'es-toolkit'

import { STYLE_LINK_FIELDS } from '../shared-styles'
import { remapStyleRunReferences } from '../text/references'
import type { SceneNode } from '../types'

/** How a layer's references to variables, collections, modes, and styles are renamed. */
export interface ResourceReferences {
  variable: (id: string) => string
  collection: (id: string) => string
  mode: (id: string) => string
  style: (id: string) => string
  /** The layer a text link names; links keep naming theirs without it. */
  layer?: (id: string) => string
}

/**
 * `node`'s references to variables, collections, modes, and styles, renamed as a copy into
 * another document renames them: its bindings, the modes it sets, the styles it and its text
 * ranges and vector regions use. Only the fields that change are returned. Instance overrides
 * name layers too, so their callers rename them with the layers.
 */
export function remappedResourceReferences(
  node: SceneNode,
  references: ResourceReferences
): Partial<SceneNode> {
  const { variable, collection, mode, style, layer } = references
  const remapped: Partial<SceneNode> = {
    boundVariables: Object.fromEntries(
      Object.entries(node.boundVariables).map(([field, id]) => [field, variable(id)])
    ),
    variableModes: Object.fromEntries(
      Object.entries(node.variableModes).map(([id, modeId]) => [collection(id), mode(modeId)])
    ),
    styleRuns: remapStyleRunReferences(node.styleRuns, { variable, style, node: layer })
  }
  for (const field of STYLE_LINK_FIELDS) {
    const id = node[field]
    if (id) remapped[field] = style(id)
  }
  if (node.vectorNetwork?.regions.some((region) => region.fillStyleId)) {
    remapped.vectorNetwork = {
      ...node.vectorNetwork,
      regions: node.vectorNetwork.regions.map((region) =>
        region.fillStyleId ? { ...region, fillStyleId: style(region.fillStyleId) } : region
      )
    }
  }
  return Object.fromEntries(
    Object.entries(remapped).filter(
      ([field, value]) => !isEqual(value, node[field as keyof SceneNode])
    )
  )
}
