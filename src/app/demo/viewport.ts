import type { Editor } from '@open-pencil/core'

type DemoViewportEditor = Pick<Editor, 'graph' | 'state' | 'zoomToBounds'>

/** The air around the first chapter when the tour opens, in canvas units. */
const MARGIN = 80

/**
 * Open the tour on its first chapter: the chapters are sections stacked on one page, so the
 * opening view fills the screen with the first and the rest follow below it.
 */
export function showFirstChapter(store: DemoViewportEditor): void {
  const first = store.graph
    .getChildren(store.state.currentPageId)
    .filter((node) => node.type === 'SECTION')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .at(0)
  if (!first) return
  store.zoomToBounds(
    first.x - MARGIN,
    first.y - MARGIN,
    first.x + first.width + MARGIN,
    first.y + first.height + MARGIN
  )
}
