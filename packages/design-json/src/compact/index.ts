import { inferNesting } from '#design-json/compact/overlap'
import { compactImages, summarize } from '#design-json/compact/summary'
import { draftLayers, finishDraft } from '#design-json/compact/tree'
import {
  COMPACT_DESIGN_FORMAT,
  COMPACT_DESIGN_VERSION,
  type CompactDesign,
  type CompactDesignOptions,
  type CompactNode
} from '#design-json/compact/types'
import { designTokens } from '#design-json/tokens'

import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * The structure of a design in brief, as something that renders it needs it: each visible
 * layer's kind, box, layout, look, text, images, and component, its children nested, and an
 * index of the whole. With `inferNesting`, layers drawn inside or over one another are nested or
 * grouped, each marked `inferred`.
 */
export function compactDesign(
  graph: SceneGraph,
  nodeIds: readonly string[],
  options: CompactDesignOptions = {}
): CompactDesign {
  const roots = compactRoots(graph, nodeIds, options)
  return {
    format: COMPACT_DESIGN_FORMAT,
    version: COMPACT_DESIGN_VERSION,
    roots,
    images: compactImages(graph, roots),
    tokens: designTokens(graph),
    summary: summarize(roots)
  }
}

/** The layers asked for, their boxes on the canvas, nested as the options say. */
function compactRoots(
  graph: SceneGraph,
  nodeIds: readonly string[],
  options: CompactDesignOptions
): CompactNode[] {
  const drafts = draftLayers(graph, nodeIds, options)
  const placed = options.inferNesting ? inferNesting(drafts) : drafts
  return placed.map((draft) => finishDraft(draft, { x: 0, y: 0 }))
}
