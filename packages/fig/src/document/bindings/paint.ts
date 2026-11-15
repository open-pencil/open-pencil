import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  applyBoundPaintColor,
  copiesComponentPaints,
  paintBindingTarget,
  recordWrittenBoundPaints
} from '@open-pencil/scene-graph/variables'

/**
 * A saved bound paint is Figma's cache of its variable, edits included, and stays as saved until
 * the color its variable gives the layer changes, so the colors the variables give now count as
 * the ones last applied. A layer an instance copies from its component, with paints the instance
 * does not override, shows its variables in the instance's own context instead, so it takes their
 * colors once occurrence hierarchy and modes are available.
 */
export function applyDocumentPaintBindings(
  graph: SceneGraph,
  materialized: readonly SceneNode[]
): void {
  for (const node of materialized) {
    recordWrittenBoundPaints(graph, node, { fills: node.fills, strokes: node.strokes })
    for (const field of Object.keys(node.boundVariables)) {
      const target = paintBindingTarget(field)
      if (target && copiesComponentPaints(graph, node, target.list))
        applyBoundPaintColor(graph, node, field)
    }
  }
}
