import { commentThreadIdsByLayer, documentComments } from '#design-json/comments'
import { describeDocument } from '#design-json/document'
import { writeLayersById, type LayerWriter } from '#design-json/layers'
import { resolveOptions } from '#design-json/options'
import { addReferences } from '#design-json/references/index'
import {
  DESIGN_JSON_FORMAT,
  DESIGN_JSON_VERSION,
  type DesignJSON,
  type DesignJSONLayer,
  type DesignJSONOptions
} from '#design-json/types'

import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * The layers as JSON, with every field the design keeps for them, what it computes for them,
 * their children nested, and what they reference: the variables they use and those they alias,
 * the collections those belong to, the main components of their instances, the shared styles
 * they use, and the images their paints draw. The document's pages and comments come along.
 */
export function designToJSON(
  graph: SceneGraph,
  nodeIds: readonly string[],
  options: DesignJSONOptions = {}
): DesignJSON {
  const writer = createLayerWriter(graph, options)
  const document = documentWithLayers(writer, writeLayersById(writer, nodeIds))
  if (writer.options.references) addReferences(document, writer)
  return document
}

function createLayerWriter(graph: SceneGraph, options: DesignJSONOptions): LayerWriter {
  return {
    graph,
    options: resolveOptions(options),
    component: false,
    commentThreadIds: commentThreadIdsByLayer(graph)
  }
}

/** The document around the layers, with its comments and nothing referenced yet. */
function documentWithLayers(writer: LayerWriter, layers: DesignJSONLayer[]): DesignJSON {
  const { graph, options } = writer
  return {
    format: DESIGN_JSON_FORMAT,
    version: DESIGN_JSON_VERSION,
    document: describeDocument(graph, options),
    layers,
    variables: {},
    variableCollections: {},
    components: {},
    styles: {},
    images: {},
    comments: documentComments(graph, options)
  }
}
