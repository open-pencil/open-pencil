import { FigmaAPI, MAX_IMAGE_FETCH_BYTES } from '@open-pencil/core/figma-api'
import { createCanvasKitRasterCodec } from '@open-pencil/core/io/formats/raster'

import { renderAutomationImage } from '@/app/automation/bridge/export-handlers'
import type { EditorStore } from '@/app/editor/active-store'
import { listFonts } from '@/app/editor/fonts'
import { createTauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

// Figma loads `createImageAsync` URLs through its own server; on desktop the native proxy does
// the same, past CORS, which a browser cannot.
const imageFetch = IS_TAURI
  ? createTauriFetch({ maxResponseBytes: MAX_IMAGE_FETCH_BYTES })
  : undefined

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
    renderer: () => store.renderer ?? null
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
  api.viewport = {
    center: {
      x: (-store.state.panX + window.innerWidth / 2) / store.state.zoom,
      y: (-store.state.panY + window.innerHeight / 2) / store.state.zoom
    },
    zoom: store.state.zoom
  }
  api.exportImage = async (nodeIds, opts) =>
    renderAutomationImage(store, nodeIds, { ...opts, pageId: opts.pageId ?? pageId })
  if (store.renderer) api.rasterCodec = createCanvasKitRasterCodec(store.renderer.ck)
  return api
}
