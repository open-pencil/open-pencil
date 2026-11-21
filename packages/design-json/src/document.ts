import type { ResolvedOptions } from '#design-json/options'
import type { DesignJSONDocument, DesignJSONPage } from '#design-json/types'
import { toJSONValue } from '#design-json/values'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** The document the layers belong to: its kind, its pages, its libraries, and its `.fig` origin. */
export function describeDocument(graph: SceneGraph, options: ResolvedOptions): DesignJSONDocument {
  return {
    rootId: graph.rootId,
    kind: graph.documentKind,
    colorSpace: graph.documentColorSpace,
    figKiwiVersion: graph.figKiwiVersion,
    pages: graph.getPages(true).map(describePage),
    enabledLibraries: Object.fromEntries(graph.enabledLibraries),
    ...figSchemaOf(graph, options)
  }
}

/** The `.fig` schema, only when asked for; null for a document that was not read from a `.fig`. */
function figSchemaOf(graph: SceneGraph, options: ResolvedOptions): { figSchema?: unknown } {
  if (!options.figSchema) return {}
  return { figSchema: toJSONValue(graph.figSchemaDeflated, options.bytes) ?? null }
}

function describePage(page: SceneNode): DesignJSONPage {
  return { id: page.id, name: page.name, internalOnly: page.internalOnly }
}
