import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { hasBehaviour } from '@open-pencil/scene-graph/behaviours'

function containsControl(graph: SceneGraph, node: SceneNode): boolean {
  if (hasBehaviour(graph, node)) return true
  return graph.getChildren(node.id).some((child) => containsControl(graph, child))
}

/**
 * The layers a previewing canvas runs as live islands: each top-level layer of the page that
 * holds an instance with a behaviour, so the controls inside it and the layout around them run
 * as real components. The canvas leaves them to the islands.
 */
export function playIslandRoots(graph: SceneGraph, pageId: string): string[] {
  return graph
    .getChildren(pageId)
    .filter((node) => node.visible && node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')
    .filter((node) => containsControl(graph, node))
    .map((node) => node.id)
}
