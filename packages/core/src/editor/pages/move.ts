import type { SceneGraph } from '@open-pencil/scene-graph'
import { siblingOrderKeys } from '@open-pencil/scene-graph/order-keys'

export interface MovePageOptions {
  includeInternal?: boolean
}

/** Move a page in graph order and keep its persisted order keys in sync. */
export function movePageInGraph(
  graph: SceneGraph,
  pageId: string,
  index: number,
  options: MovePageOptions = {}
): number | null {
  const rootId = graph.rootId
  const page = graph.getNode(pageId)
  if (page?.type !== 'CANVAS' || page.parentId !== rootId || !Number.isFinite(index)) {
    return null
  }

  const includeInternal = options.includeInternal ?? false
  const pages = graph.getPages(includeInternal)
  const currentIndex = pages.findIndex((candidate) => candidate.id === pageId)
  if (currentIndex === -1) return null

  if (pages.length === 1) return currentIndex

  const nextIndex = Math.max(0, Math.min(Math.trunc(index), pages.length - 1))
  const rootChildren = graph.getChildren(rootId)
  const currentRootIndex = rootChildren.findIndex((child) => child.id === pageId)
  const remainingChildren = rootChildren.filter((child) => child.id !== pageId)
  const remainingPages = remainingChildren.filter(
    (child) => child.type === 'CANVAS' && (includeInternal || !child.internalOnly)
  )
  let rootIndex = remainingChildren.length
  if (nextIndex < remainingPages.length) {
    const nextPage = remainingPages[nextIndex]
    rootIndex = remainingChildren.findIndex((child) => child.id === nextPage.id)
  } else if (remainingPages.length > 0) {
    const lastPage = remainingPages[remainingPages.length - 1]
    rootIndex = remainingChildren.findIndex((child) => child.id === lastPage.id) + 1
  }
  if (currentRootIndex === rootIndex) return nextIndex

  graph.insertChildAt(pageId, rootId, rootIndex)
  persistPageOrder(graph)
  return nextIndex
}

function persistPageOrder(graph: SceneGraph): void {
  const pages = graph.getPages(true)
  const orderKeys = siblingOrderKeys(pages.map((page) => page.source.orderKey))
  pages.forEach((page, index) => {
    const orderKey = orderKeys[index]
    if (page.source.orderKey === orderKey) return
    graph.updateNode(page.id, { source: { ...page.source, orderKey } })
  })
}
