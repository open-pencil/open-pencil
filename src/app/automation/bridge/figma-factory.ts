import {
  FigmaAPI,
  MAX_IMAGE_FETCH_BYTES,
  type FigmaViewportHost
} from '@open-pencil/core/figma-api'
import { createCanvasKitRasterCodec } from '@open-pencil/core/io/formats/raster'

import { renderAutomationImage } from '@/app/automation/bridge/export-handlers'
import type { EditorStore } from '@/app/editor/active-store'
import { listFonts } from '@/app/editor/fonts'
import { activeTab } from '@/app/tabs'
import { createTauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

// Figma loads `createImageAsync` URLs through its own server; on desktop the native proxy does
// the same, past CORS, which a browser cannot.
const imageFetch = IS_TAURI
  ? createTauriFetch({ maxResponseBytes: MAX_IMAGE_FETCH_BYTES })
  : undefined

/**
 * `figma.viewport` as the editor's view: reading it reads the canvas, and moving it moves the
 * canvas the person sees. Only the page on screen can move; another page or a document in a
 * background tab has no view to scroll, so the call says how to show it first.
 */
function editorViewport(store: EditorStore): FigmaViewportHost {
  function assertOnScreen(pageId: string) {
    if (activeTab.value?.store === store && store.state.currentPageId === pageId) return
    const page = store.graph.getNode(pageId)?.name ?? pageId
    throw new Error(
      `Page "${page}" is not on screen, so its view cannot move. ` +
        'Show it with activate_document (document_id and page_id) first.'
    )
  }
  return {
    get: () => {
      const { width, height } = store.getViewportSize()
      const { panX, panY, zoom } = store.state
      return { center: { x: (width / 2 - panX) / zoom, y: (height / 2 - panY) / zoom }, zoom }
    },
    set: (pageId, center, zoom) => {
      assertOnScreen(pageId)
      store.centerOn(center.x, center.y, zoom)
    },
    fit: (pageId, bounds) => {
      assertOnScreen(pageId)
      store.zoomToBounds(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height)
    }
  }
}

export function makeFigmaFromStore(
  store: EditorStore,
  pageId = store.state.currentPageId,
  signal?: AbortSignal
): FigmaAPI {
  const api = new FigmaAPI(store.graph, {
    fetch: imageFetch,
    signal,
    // A page not yet visited has no layers until the editor prepares it, as it does a page it
    // switches to: with its fonts and layout.
    loadPage: async (id) => {
      if (!(await store.preparePageNodes(id)))
        throw new Error(`Page "${id}" was closed before it finished loading`)
    },
    pageOfNode: (id) => store.pageHoldingNode(id),
    // The font manager lists the installed families once the host has read them.
    prepareFontList: async () => {
      await listFonts()
    },
    // The editor syncs instances after edits; a script's reads sync them at once, as in Figma.
    flushComponentSync: () => store.flushComponentSync(),
    // The editor tells its renderers about edits itself; an API made per call that listened too
    // would stay on the graph after the call, one more listener for every call.
    renderer: () => store.renderer ?? null,
    viewport: editorViewport(store)
  })
  api.icons = store.iconProvider
  api.theme = store.state.theme ?? 'light'
  api.currentPage = api.wrapNode(pageId)
  // The user's selection belongs to the page on screen.
  api.currentPage.selection =
    pageId === store.state.currentPageId
      ? [...store.state.selectedIds]
          .map((id) => api.getNodeById(id))
          .filter((n): n is NonNullable<typeof n> => n !== null)
      : []
  api.exportImage = async (nodeIds, opts) =>
    renderAutomationImage(store, nodeIds, { ...opts, pageId: opts.pageId ?? pageId })
  if (store.renderer) api.rasterCodec = createCanvasKitRasterCodec(store.renderer.ck)
  return api
}
