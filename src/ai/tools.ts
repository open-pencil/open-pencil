import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { makeFigmaFromStore } from '@/automation/figma-factory'
import { ALL_TOOLS, computeAllLayouts, toolsToAI } from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { SceneNode, StepBudget, ToolLogEntry } from '@open-pencil/core'

export const MAX_AGENT_STEPS = 50

let _toolLogEntries: ToolLogEntry[] = []
let _currentRunSteps = 0

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

let _stepUsages: StepUsage[] = []

export function getToolLogEntries(): ToolLogEntry[] {
  return _toolLogEntries
}

export function getStepUsages(): StepUsage[] {
  return _stepUsages
}

export function recordStepUsage(usage: StepUsage): void {
  _stepUsages.push(usage)
  _currentRunSteps++
}

export function resetRunSteps(): void {
  _currentRunSteps = 0
}

export function didHitStepLimit(): boolean {
  return _currentRunSteps >= MAX_AGENT_STEPS
}

export function clearToolLogEntries(): void {
  _toolLogEntries = []
  _stepUsages = []
}

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
      },
      onToolLog: (entry) => {
        _toolLogEntries.push(entry)
      },
      getStepBudget: (): StepBudget => ({
        current: _currentRunSteps,
        max: MAX_AGENT_STEPS
      })
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
