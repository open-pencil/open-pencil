import { valibotSchema } from '@ai-sdk/valibot'
import { ALL_TOOLS, FigmaAPI, toolsToAI } from '@open-pencil/core'
import { tool } from 'ai'
import * as v from 'valibot'

import type { EditorStore } from '@/stores/editor'
import type { ExportFormat } from '@open-pencil/core'

export function createAITools(store: EditorStore) {
  return toolsToAI(
    ALL_TOOLS,
    {
      getFigma: () => {
        const api = new FigmaAPI(store.graph)
        api.currentPage = api.wrapNode(store.state.currentPageId)
        api.currentPage.selection = [...store.state.selectedIds]
          .map((id) => api.getNodeById(id))
          .filter((n): n is NonNullable<typeof n> => n !== null)
        api.exportImage = (nodeIds, opts) =>
          store.renderExportImage(nodeIds, opts.scale ?? 1, (opts.format ?? 'PNG') as ExportFormat)
        return api
      },
      onAfterExecute: () => {
        store.requestRender()
      },
      onFlashNodes: (nodeIds) => {
        store.flashNodes(nodeIds)
      }
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
