import type { SceneGraph } from '@open-pencil/scene-graph'
import { documentThumbnail } from '@open-pencil/scene-graph/thumbnail'

type ThumbnailPage = {
  id: string
  name: string
}

const COVER_PAGE_NAME = 'cover'

/**
 * The page a `.fig` thumbnail shows: the conventional Cover page, or the first page when there is
 * none, as Figma's own thumbnail does.
 */
export function figThumbnailPageId(pages: readonly ThumbnailPage[]): string | undefined {
  const normalizedNames = pages.map((page) => ({
    page,
    name: page.name.trim().toLocaleLowerCase()
  }))
  return (
    normalizedNames.find(({ name }) => name === COVER_PAGE_NAME)?.page.id ??
    normalizedNames.find(({ name }) => name.includes(COVER_PAGE_NAME))?.page.id ??
    pages.at(0)?.id
  )
}

/** What a document's thumbnail draws: one page, whole or only `nodeIds` of it. */
export interface ThumbnailSubject {
  pageId: string
  nodeIds?: readonly string[]
}

/**
 * What `graph`'s thumbnail draws: the layer chosen with Set as thumbnail, or else everything on
 * `pageId`, by default the cover page. Null when there is no page to draw.
 */
export function documentThumbnailSubject(
  graph: SceneGraph,
  pageId: string | undefined = figThumbnailPageId(graph.getPages())
): ThumbnailSubject | null {
  const chosen = documentThumbnail(graph)
  const chosenPageId = chosen ? graph.pageOf(chosen.id) : null
  if (chosen && chosenPageId) return { pageId: chosenPageId, nodeIds: [chosen.id] }
  const page = pageId ? graph.getNode(pageId) : undefined
  return page ? { pageId: page.id } : null
}
