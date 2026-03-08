import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { makeFigmaFromStore } from '@/automation/figma-factory'
import { ALL_TOOLS, computeAllLayouts, toolsToAI } from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'

export function createAITools(store: EditorStore) {
  return toolsToAI(
    ALL_TOOLS,
    {
      getFigma: () => makeFigmaFromStore(store),
      onAfterExecute: () => {
        computeAllLayouts(store.graph, store.state.currentPageId)
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
