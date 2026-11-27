import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { DECK_TYPES } from '@open-pencil/scene-graph/generated'
import { slideRows, slideSettings } from '@open-pencil/scene-graph/slides'

import { archiveBaseline, type ArchiveChangeSummary } from '#core/kiwi/fig/session/archive/changes'

/**
 * A slide's transition names the slide after it, so deleting, skipping, adding, or moving one
 * changes the record of the slide before. Only records whose target changed are patched.
 */
export function addTransitionSlides(
  graph: SceneGraph,
  changes: ArchiveChangeSummary,
  add: (id: string) => unknown
): void {
  const before = archiveBaseline(graph)?.before
  // A slide that left its page, or was deleted after it did, shows only in what it was.
  const deckChanged = [...changes.touched].some((id) => {
    const node = graph.getNode(id) ?? before?.get(id)
    return node !== undefined && DECK_TYPES.has(node.type)
  })
  if (!deckChanged) return
  for (const page of graph.getPages())
    for (const slide of slideRows(graph, page.id).flat())
      if (slideSettings(slide)?.transition) add(slide.id)
}

/** Whether a layer or any layer inside it animates on its slide. */
function holdsAnimation(graph: SceneGraph, id: string): boolean {
  const node = graph.getNode(id)
  if (!node) return false
  return node.animation !== null || node.childIds.some((child) => holdsAnimation(graph, child))
}

/**
 * The slide a layer was or is on: up its saved parents when it changed since the archive was
 * read, or its current ones otherwise.
 */
function slideAbove(
  graph: SceneGraph,
  parentId: string | null | undefined,
  saved: ReadonlyMap<string, SceneNode> | undefined
): string | undefined {
  let id = parentId
  // Saved parents can be bad data: a parent cycle ends the walk.
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const node = saved?.get(id) ?? graph.getNode(id)
    if (!node) return undefined
    if (node.type === 'SLIDE') return node.id
    id = node.parentId
  }
  return undefined
}

/**
 * A layer's animation is kept in its slide's record, so adding, changing, or deleting one rewrites
 * the slide it was or is on, as does moving or deleting a layer holding animated ones.
 */
export function addAnimatedSlides(
  graph: SceneGraph,
  changes: ArchiveChangeSummary,
  add: (id: string) => unknown
): void {
  const before = archiveBaseline(graph)?.before
  for (const id of changes.touched) {
    const node = graph.getNode(id)
    const was = before?.get(id)
    if (!holdsAnimation(graph, id) && !was?.animation) continue
    for (const slide of [
      slideAbove(graph, node?.parentId, undefined),
      slideAbove(graph, was?.parentId, before)
    ])
      if (slide) add(slide)
  }
}
