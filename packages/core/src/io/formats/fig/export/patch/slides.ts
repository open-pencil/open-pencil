import type { SceneGraph } from '@open-pencil/scene-graph'
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

/**
 * A layer's animation is kept in its slide's record, so adding, changing, or deleting one rewrites
 * the slide it was or is on.
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
    if (!node?.animation && !was?.animation) continue
    for (const parentId of new Set([node?.parentId, was?.parentId])) {
      const slide = parentId ? graph.closest(parentId, (item) => item.type === 'SLIDE') : undefined
      if (slide) add(slide.id)
    }
  }
}
