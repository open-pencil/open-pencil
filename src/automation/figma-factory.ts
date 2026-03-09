import { FigmaAPI } from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { ExportFormat } from '@open-pencil/core'

export function makeFigmaFromStore(store: EditorStore): FigmaAPI {
  const api = new FigmaAPI(store.graph)
  api.currentPage = api.wrapNode(store.state.currentPageId)
  api.currentPage.selection = [...store.state.selectedIds]
    .map((id) => api.getNodeById(id))
    .filter((n): n is NonNullable<typeof n> => n !== null)
  api.viewport = {
    center: {
      x: (-store.state.panX + window.innerWidth / 2) / store.state.zoom,
      y: (-store.state.panY + window.innerHeight / 2) / store.state.zoom
    },
    zoom: store.state.zoom
  }
  api.exportImage = (nodeIds, opts) =>
    store.renderExportImage(nodeIds, opts.scale ?? 1, (opts.format ?? 'PNG') as ExportFormat)
  return api
}
