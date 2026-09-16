import { tool } from 'ai'

import {
  CORE_TOOLS,
  EXTENDED_TOOLS,
  registerComponentCatalog,
  isAtomicTool,
  toolsToAI
} from '@open-pencil/core/tools'
import type { StepBudget } from '@open-pencil/core/tools'
import type { SceneNode } from '@open-pencil/scene-graph'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { executeAtomicEditorTool } from '@/app/automation/execution/editor'
import { recordToolCompleted, type AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

export const MAX_AGENT_STEPS = 50

class RunState {
  currentSteps = 0

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }
}

const runStates = new WeakMap<EditorStore, RunState>()

function getRunState(store?: EditorStore): RunState {
  const target = store ?? getActiveEditorStore()
  const existing = runStates.get(target)
  if (existing) return existing
  const created = new RunState()
  runStates.set(target, created)
  return created
}

export function recordStep(store?: EditorStore): void {
  getRunState(store).currentSteps++
}

export function resetRunSteps(store?: EditorStore): void {
  getRunState(store).resetSteps()
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

export function createAITools(store: EditorStore, diagnosticContext?: AIDiagnosticContext) {
  let beforeSnapshot: Map<string, SceneNode> | null = null
  const runState = getRunState(store)
  const libraryService = useLibraryService()
  libraryService.bindEditor(store)
  registerComponentCatalog(store.graph, libraryService)

  return toolsToAI(
    [
      ...CORE_TOOLS,
      ...EXTENDED_TOOLS.filter((def) =>
        ['get_components', 'list_libraries', 'insert_library_component'].includes(def.name)
      )
    ],
    {
      getFigma: () => makeFigmaFromStore(store),
      executeTool: async (def, figma, args) => {
        if (isAtomicTool(def)) {
          return executeAtomicEditorTool(store, figma, def, args, { label: 'AI' })
        }
        if (def.mutates) beforeSnapshot = store.snapshotPage()
        return def.mutates
          ? store.runMutationWithLayout(
              () => def.execute(figma, args),
              figma.currentPageId,
              async () => {
                const pageNode = store.graph.getNode(figma.currentPageId)
                if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
              }
            )
          : def.execute(figma, args)
      },
      onAfterExecute: async (def) => {
        if (isAtomicTool(def)) return
        if (def.mutates) {
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
          diagnosticContext
        )
      },
      getStepBudget: (): StepBudget => ({
        current: runState.currentSteps,
        max: MAX_AGENT_STEPS
      })
    },
    { tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
