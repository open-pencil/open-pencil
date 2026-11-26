import { isEmptyObject } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createStyleBindingLookup,
  inheritedTextStyleBindings,
  resolvedTextStyleBindings,
  type TextStyleLookup
} from '@open-pencil/scene-graph/variables'

function changesOnlyFontSize(updates: Partial<SceneNode>): boolean {
  return Object.keys(updates).every((field) => field === 'fontSize')
}

function shapedInResolvedMode(
  node: SceneNode,
  updates: Partial<SceneNode>,
  styles: TextStyleLookup
): boolean {
  const sizeIsBound = 'fontSize' in inheritedTextStyleBindings(node, styles)
  return (
    sizeIsBound &&
    changesOnlyFontSize(updates) &&
    node.derivedTextGlyphs?.[0]?.fontSize === (updates.fontSize ?? node.fontSize)
  )
}

function keepingSavedTextLayout(
  node: SceneNode,
  updates: Partial<SceneNode>,
  styles: TextStyleLookup
): Partial<SceneNode> {
  if (!shapedInResolvedMode(node, updates, styles)) {
    return updates
  }
  return {
    ...updates,
    derivedLayout: node.derivedLayout,
    derivedTextGlyphs: node.derivedTextGlyphs
  }
}

export function applyDocumentTextStyleBindings(
  graph: SceneGraph,
  materialized: readonly SceneNode[]
): void {
  const styles = createStyleBindingLookup(graph)
  for (const node of materialized) {
    const updates = resolvedTextStyleBindings(graph, node, styles)
    if (!isEmptyObject(updates)) {
      graph.updateNode(node.id, keepingSavedTextLayout(node, updates, styles))
    }
  }
}
