import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { hasBehaviour } from '@open-pencil/scene-graph/behaviours'
import { DECK_TYPES } from '@open-pencil/scene-graph/generated'

function containsControl(graph: SceneGraph, node: SceneNode): boolean {
  if (hasBehaviour(graph, node)) return true
  return graph.getChildren(node.id).some((child) => containsControl(graph, child))
}

function runsAsIsland(graph: SceneGraph, node: SceneNode): boolean {
  return (
    node.visible &&
    node.type !== 'COMPONENT' &&
    node.type !== 'COMPONENT_SET' &&
    containsControl(graph, node)
  )
}

/**
 * The layers of a slide, or of any other layer, that hold a control and run as live islands, as a
 * presentation shows them.
 */
export function slideIslandRoots(graph: SceneGraph, slideId: string): string[] {
  return graph
    .getChildren(slideId)
    .filter((node) => runsAsIsland(graph, node))
    .map((node) => node.id)
}

/** A deck's shown slides, in its grid's shown rows. */
function deckSlides(graph: SceneGraph, gridId: string): SceneNode[] {
  return graph
    .getChildren(gridId)
    .filter((row) => row.visible)
    .flatMap((row) => graph.getChildren(row.id))
    .filter((slide) => slide.type === 'SLIDE' && slide.visible)
}

/**
 * The layers a previewing canvas runs as live islands: each top-level layer of the page that
 * holds an instance with a behaviour, so the controls inside it and the layout around them run
 * as real components. In a deck they are the slides' own top-level layers, so each slide keeps
 * its build and the deck is not one island. The canvas leaves them to the islands.
 */
export function playIslandRoots(graph: SceneGraph, pageId: string): string[] {
  return graph.getChildren(pageId).flatMap((node) => {
    if (DECK_TYPES.has(node.type))
      return node.visible
        ? deckSlides(graph, node.id).flatMap((slide) => slideIslandRoots(graph, slide.id))
        : []
    return runsAsIsland(graph, node) ? [node.id] : []
  })
}
