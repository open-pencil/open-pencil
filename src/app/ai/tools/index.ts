import { tool } from 'ai'

import { registerComponentCatalog, isAtomicTool, toolsToAI } from '@open-pencil/core/tools'
import type { StepBudget } from '@open-pencil/core/tools'
import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_AGENT_STEPS, resolveAgentStepLimit } from '@/app/ai/chat/step-limit'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { executeAtomicEditorTool } from '@/app/automation/execution/editor'
import { recordToolCompleted, type AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

import { aiToolDefinitions } from './catalog'

class RunState {
  currentSteps = 0
  /** Captured for the message in progress; settings changes apply to the next one. */
  maxSteps = DEFAULT_AGENT_STEPS

  resetSteps(maxSteps: number): void {
    this.currentSteps = 0
    this.maxSteps = resolveAgentStepLimit(maxSteps)
  }

  hitLimit(): boolean {
    return this.currentSteps >= this.maxSteps
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

export function resetRunSteps(store: EditorStore, maxSteps: number): void {
  getRunState(store).resetSteps(maxSteps)
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
    aiToolDefinitions,
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
        max: runState.maxSteps
      })
    },
    { tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
