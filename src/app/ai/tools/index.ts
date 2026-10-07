import { tool } from 'ai'

import { graphFromPageSnapshot } from '@open-pencil/core/editor'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  registerComponentCatalog,
  isAtomicTool,
  toolChangesDocument,
  toolsToAI,
  type ToolDef
} from '@open-pencil/core/tools'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { executeAtomicEditorTool } from '@/app/automation/execution/editor'
import { recordToolCompleted, type AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

import { aiToolDefinitions } from './catalog'
import { recordToolChange } from './changes/capture'
import { createMutex } from './mutex'
import {
  markRunWork,
  moveRunToPage,
  recordRunBaseline,
  recordRunUndoEntry,
  runBaseline,
  runPageId,
  stepBudget
} from './run'

export {
  didHitStepLimit,
  endRun,
  markRunPreview,
  recordStep,
  runAgentId,
  runPageId,
  runUndoEntries,
  startRun
} from './run'

export function createAITools(store: EditorStore, diagnosticContext?: AIDiagnosticContext) {
  const acquireMutation = createMutex()
  const libraryService = useLibraryService()
  libraryService.bindEditor(store)
  registerComponentCatalog(store.graph, libraryService)

  async function runTool(
    def: ToolDef,
    figma: FigmaAPI,
    args: Record<string, unknown>,
    pageId: string
  ): Promise<unknown> {
    if (isAtomicTool(def)) {
      return executeAtomicEditorTool(store, figma, def, args, { label: 'AI' })
    }
    return store.runMutationWithLayout(
      () => def.execute(figma, args),
      pageId,
      async () => {
        const pageNode = store.graph.getNode(pageId)
        if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
      }
    )
  }

  return toolsToAI(
    aiToolDefinitions,
    {
      getFigma: () => {
        const figma = makeFigmaFromStore(store, runPageId(store))
        figma.changeBaseline = (pageId) => {
          const baseline = runBaseline(store, pageId)
          return baseline ? graphFromPageSnapshot(store.graph, baseline) : null
        }
        return figma
      },
      executeTool: async (def, figma, args, { toolCallId }) => {
        const pageId = figma.currentPageId
        if (!def.mutates) return def.execute(figma, args)
        // A step's calls may run concurrently; whole-page snapshots must not interleave.
        const release = await acquireMutation()
        const before = store.snapshotPage(pageId)
        if (toolChangesDocument(def)) recordRunBaseline(store, before)
        try {
          return await runTool(def, figma, args, pageId)
        } finally {
          const after = store.snapshotPage(pageId)
          // Atomic tools record their own undo entry.
          if (!isAtomicTool(def)) {
            store.pushUndoEntry({
              label: `AI: ${def.name}`,
              forward: () => store.restorePageFromSnapshot(after),
              inverse: () => store.restorePageFromSnapshot(before)
            })
          }
          // Every entry the run pushes belongs to its turn, view changes included: one left on
          // top, such as a closing zoom to fit, would otherwise keep the turn from reverting.
          // Atomic and snapshot edits both label their entries this way.
          recordRunUndoEntry(store, `AI: ${def.name}`)
          // View tools (selection, viewport, pages) cannot change the document.
          if (toolChangesDocument(def)) {
            try {
              recordToolChange(store, toolCallId, before, after)
            } catch (error) {
              // The change record is a review aid; the edit and its undo entry already stand.
              console.warn('Could not record AI tool change', error)
            }
          }
          try {
            // `switch_page` moves the run, and the user's view with it.
            if (figma.currentPageId !== pageId) await moveRunToPage(store, figma.currentPageId)
          } finally {
            release()
          }
        }
      },
      onAfterExecute: (def) => {
        if (def.mutates && !isAtomicTool(def)) store.requestRender()
      },
      onFlashNodes: (nodeIds) => {
        markRunWork(store, nodeIds)
        store.renderer?.aiClearActive()
        if (nodeIds.length > 0) {
          store.aiFlashDone(nodeIds)
        }
      },
      onToolLog: (entry) => {
        recordToolCompleted(
          {
            tool: entry.tool,
            durationMs: entry.durationMs,
            mutates: entry.mutates,
            failed: Boolean(entry.error)
          },
          diagnosticContext,
          entry.cause
        )
      },
      getStepBudget: () => stepBudget(store)
    },
    { tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
