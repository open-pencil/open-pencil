import { computed, reactive } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { useEditorStore } from '@/app/editor/active-store'

import { pagePlacement } from './placement'
import {
  canShowLivePage,
  normalizeLiveURL,
  pageLabel,
  pluginDataWithLivePage,
  readLivePage,
  type LivePage
} from './schema'

/** One frame on the current page that shows a page of the running application. */
export type LivePageEntry = {
  nodeId: string
  page: LivePage
  node: SceneNode
  at: Vector
}

/**
 * How many times each page was reloaded; a frame remounts its page on a new value, which is how a
 * page reloads without touching the address the person typed.
 */
const reloads = reactive<Record<string, number>>({})

/**
 * The pages of the running application shown on the canvas: which frames show one, where they sit,
 * and how to link, unlink, and reload them. A page lives on its frame's plugin data, so it travels
 * with the document and an undo brings it back like any other edit.
 *
 * A canvas can show two pages at once: `pageId` names the page a caller draws, which a split pane
 * passes so each pane draws the frames of the page it shows.
 */
export function useLivePages(options: { pageId?: () => string } = {}) {
  const store = useEditorStore()

  const pages = computed<LivePageEntry[]>(() => {
    // A frame can be moved, resized, or relinked without the page itself changing.
    void store.state.sceneVersion
    const pageId = options.pageId?.() ?? store.state.currentPageId
    return store.graph.getChildren(pageId).flatMap((node) => {
      if (!node.visible || !canShowLivePage(node)) return []
      const page = readLivePage(node)
      if (!page) return []
      return [{ nodeId: node.id, page, node, at: store.graph.getAbsolutePosition(node.id) }]
    })
  })

  /** Where a page draws: its frame's border box in the layer's own pixels. */
  function placementOf(entry: LivePageEntry) {
    return pagePlacement(entry.at, entry.node.width, entry.node.height)
  }

  function pageOf(nodeId: string): LivePage | null {
    const node = store.graph.getNode(nodeId)
    return node ? readLivePage(node) : null
  }

  /** Link a frame to a page, or unlink it with null, as one undoable edit. */
  function setPage(nodeId: string, page: LivePage | null): void {
    const node = store.graph.getNode(nodeId)
    if (!node || !canShowLivePage(node)) return
    store.updateNodeWithUndo(
      nodeId,
      { pluginData: pluginDataWithLivePage(node, page) },
      page ? 'Link page' : 'Unlink page'
    )
    if (page === null) reloads[nodeId] = 0
  }

  /**
   * Link a frame to the address as typed, or answer false when the address is not one this app
   * can load. A frame keeps its own size; the page fills it.
   */
  function link(nodeId: string, rawURL: string, label?: string): boolean {
    const url = normalizeLiveURL(rawURL)
    const node = store.graph.getNode(nodeId)
    if (url === '' || !node || !canShowLivePage(node)) return false
    setPage(nodeId, { url, label: pageLabel(label ?? node.name), mode: 'live' })
    return true
  }

  function reload(nodeId: string): void {
    reloads[nodeId] = (reloads[nodeId] ?? 0) + 1
  }

  function reloadAll(): void {
    for (const entry of pages.value) reload(entry.nodeId)
  }

  function revisionOf(nodeId: string): number {
    return reloads[nodeId] ?? 0
  }

  return { pages, placementOf, pageOf, setPage, link, reload, reloadAll, revisionOf }
}

export type LivePages = ReturnType<typeof useLivePages>
