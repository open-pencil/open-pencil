import { isEmptyObject } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createStyleBindingLookup,
  resolvedTextStyleBindings
} from '@open-pencil/scene-graph/variables'

type SizedText = Pick<SceneNode, 'fontSize' | 'styleRuns'>

function firstCharacterSize(text: SizedText): number {
  const firstRun = text.styleRuns.find((run) => run.start === 0)
  return firstRun?.style.fontSize ?? text.fontSize
}

function shapedInResolvedMode(node: SceneNode, updates: Partial<SceneNode>): boolean {
  const resolvedSize = firstCharacterSize({ ...node, ...updates })
  const sizeMoved = resolvedSize !== firstCharacterSize(node)
  return sizeMoved && node.derivedTextGlyphs?.[0]?.fontSize === resolvedSize
}

function keepingSavedTextLayout(node: SceneNode, updates: Partial<SceneNode>): Partial<SceneNode> {
  if (!shapedInResolvedMode(node, updates)) {
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
      graph.updateNode(node.id, keepingSavedTextLayout(node, updates))
    }
  }
}
