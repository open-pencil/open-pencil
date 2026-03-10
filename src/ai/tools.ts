import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { makeFigmaFromStore } from '@/automation/figma-factory'
import { ALL_TOOLS, computeAllLayouts, toolsToAI } from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { SceneNode } from '@open-pencil/core'

export function createAITools(store: EditorStore) {
  let beforeSnapshot: Map<string, SceneNode> | null = null

  return toolsToAI(
    ALL_TOOLS,
    {
      getFigma: () => makeFigmaFromStore(store),
      onBeforeExecute: (def) => {
        if (def.mutates) {
          beforeSnapshot = store.snapshotPage()
        }
      },
      onAfterExecute: (def) => {
        if (def.mutates) {
          computeAllLayouts(store.graph, store.state.currentPageId)
          store.requestRender()
          if (beforeSnapshot) {
            const before = beforeSnapshot
            const after = store.snapshotPage()
            store.pushUndoEntry({
              label: `AI: ${def.name}`,
              forward: () => store.restorePageFromSnapshot(after),
              inverse: () => store.restorePageFromSnapshot(before)
            })
            beforeSnapshot = null
          }
        }
      },
      onFlashNodes: (nodeIds) => {
        store.flashNodes(nodeIds)
      }
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
