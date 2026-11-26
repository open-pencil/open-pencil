import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { EditorState } from '#core/editor/types'

/** The slide on the canvas's stage, or null while the whole page shows. Only a slide of the page shown is staged. */
export function stagedSlide(
  graph: SceneGraph,
  state: Pick<EditorState, 'focusedSlideId' | 'currentPageId'>
): SceneNode | null {
  const slide = state.focusedSlideId ? graph.getNode(state.focusedSlideId) : undefined
  return slide?.type === 'SLIDE' && graph.pageOf(slide.id) === state.currentPageId ? slide : null
}

/**
 * What the canvas shows the layers of, and so what clicks are found in and new layers fall back
 * to: the slide on the stage, or the page.
 */
export function canvasRootId(
  graph: SceneGraph,
  state: Pick<EditorState, 'focusedSlideId' | 'currentPageId'>
): string {
  return stagedSlide(graph, state)?.id ?? state.currentPageId
}
