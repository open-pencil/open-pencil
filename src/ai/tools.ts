import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { aiOverlayLog } from '@/ai/chat-debug'
import { makeFigmaFromStore } from '@/automation/figma-factory'
import {
  CORE_TOOLS,
  collectFontKeys,
  computeAllLayouts,
  isFontLoaded,
  loadFont,
  toolsToAI
} from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { SceneNode, StepBudget, ToolLogEntry } from '@open-pencil/core'

export const MAX_AGENT_STEPS = 50

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

class RunState {
  toolLog: ToolLogEntry[] = []
  stepUsages: StepUsage[] = []
  currentSteps = 0

  recordStep(usage: StepUsage): void {
    this.stepUsages.push(usage)
    this.currentSteps++
  }

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }

  clear(): void {
    this.toolLog = []
    this.stepUsages = []
  }
}

export const runState = new RunState()

export function getToolLogEntries(): ToolLogEntry[] {
  return runState.toolLog
}

export function getStepUsages(): StepUsage[] {
  return runState.stepUsages
}

export function recordStepUsage(usage: StepUsage): void {
  runState.recordStep(usage)
}

export function resetRunSteps(): void {
  runState.resetSteps()
}

export function didHitStepLimit(): boolean {
  return runState.hitLimit()
}

export function clearToolLogEntries(): void {
  runState.clear()
}

export function createAITools(store: EditorStore) {
  let beforeSnapshot: Map<string, SceneNode> | null = null

  return toolsToAI(
    CORE_TOOLS,
    {
      getFigma: () => makeFigmaFromStore(store),
      onBeforeExecute: (def, args) => {
        if (def.mutates) {
          beforeSnapshot = store.snapshotPage()
        }
        const targetId = (args.replace_id ?? args.parent_id) as string | undefined
        const nodeExists = targetId ? !!store.graph.getNode(targetId) : false
        const rendererExists = !!store.renderer
        aiOverlayLog.push({
          ts: Date.now(),
          event: 'before-execute',
          tool: def.name,
          state: `targetId=${targetId ?? 'none'} nodeExists=${nodeExists} renderer=${rendererExists} activeNodes=${store.renderer?._aiActiveNodes.size ?? 0}`,
          targetId: targetId ?? ''
        })
        if (targetId && nodeExists) {
          store.aiMarkActive([targetId])
          aiOverlayLog.push({
            ts: Date.now(),
            event: 'mark-active',
            tool: def.name,
            state: `activeNodes=${store.renderer?._aiActiveNodes.size ?? 0} hasFlashes=${store.renderer?.hasActiveFlashes ?? false}`,
            targetId
          })
        }
      },
      onAfterExecute: async (def) => {
        if (def.mutates) {
          const pageId = store.state.currentPageId
          const pageNode = store.graph.getNode(pageId)
          if (pageNode) {
            const fontKeys = collectFontKeys(store.graph, pageNode.childIds)
            const missing = fontKeys.filter(([family]) => !isFontLoaded(family))
            if (missing.length > 0) {
              const results = await Promise.all(
                missing.map(([family, style]) => loadFont(family, style))
              )
              if (results.some((r) => r !== null)) {
                for (const [, node] of store.graph.nodes) {
                  if (node.type === 'TEXT' && node.textPicture) node.textPicture = null
                }
              }
            }
          }
          computeAllLayouts(store.graph, pageId)
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
        aiOverlayLog.push({
          ts: Date.now(),
          event: 'flash-nodes',
          tool: '',
          state: `clearing active=${store.renderer?._aiActiveNodes.size ?? 0} flashing=${nodeIds.length}`,
          targetId: nodeIds.join(',')
        })
        store.renderer?.aiClearActive()
        if (nodeIds.length > 0) {
          store.aiFlashDone(nodeIds)
        }
      },
      onToolLog: (entry) => {
        runState.toolLog.push(entry)
      },
      getStepBudget: (): StepBudget => ({
        current: runState.currentSteps,
        max: MAX_AGENT_STEPS
      })
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
