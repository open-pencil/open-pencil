import { createFigDocumentSession } from '@open-pencil/fig'
import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'

import { buildFigPopulationDelta, installFigMutationJournal } from '#core/kiwi/fig/population/delta'

/** Format-neutral worker transport adapter for the replacement reader session. */
export function openReaderSession(
  bytes: ArrayBuffer,
  populate: 'all' | 'first-page' | 'none' = 'all'
) {
  const session = createFigDocumentSession(bytes, { derivedBounds: true })
  const pages: FigPageManifestEntry[] = session.pages.map((page) => ({
    sourceId: page.id,
    name: page.name,
    position: page.position,
    internalOnly: page.internalOnly
  }))
  const sourceByGraph = new Map<string, string>()
  for (const page of session.pages) {
    const id = session.graphPageId(page.id)
    if (id) sourceByGraph.set(id, page.id)
  }
  const loadedGraphIds = () =>
    [...session.loadedPageIds].flatMap((id) => {
      const graphId = session.graphPageId(id)
      return graphId ? [graphId] : []
    })
  if (populate === 'all') {
    for (const page of pages) if (!page.internalOnly) session.loadPage(page.sourceId)
  } else if (populate === 'first-page') {
    const page = pages.find((page) => !page.internalOnly)
    if (page) session.loadPage(page.sourceId)
  }
  return {
    checkpoint: () => session.checkpoint(),
    graph: session.graph,
    pages,
    populate(pageId: string) {
      const sourceId = sourceByGraph.get(pageId)
      if (!sourceId) throw new Error(`Unknown graph page ${pageId}`)
      const populated = !session.loadedPageIds.has(sourceId)
      const journal = installFigMutationJournal(session.graph)
      try {
        session.loadPage(sourceId)
        return {
          checkpoint: session.checkpoint(),
          populated,
          delta: buildFigPopulationDelta(session.graph, journal, loadedGraphIds())
        }
      } finally {
        journal.stop()
      }
    }
  }
}
