import type { PageSnapshot } from '@open-pencil/core/editor'
import { computeContentBounds } from '@open-pencil/core/io'
import type { StepBudget } from '@open-pencil/core/tools'
import type { UndoEntry } from '@open-pencil/scene-graph/undo'

import { DEFAULT_AGENT_STEPS, resolveAgentStepLimit } from '@/app/ai/chat/step-limit'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { addAgent, type AgentHandle } from '@/app/presence/registry'

class RunState {
  currentSteps = 0
  /** Captured for the message in progress; settings changes apply to the next one. */
  maxSteps = DEFAULT_AGENT_STEPS
  /** The page the run works on. The user's navigation does not move it; the agent's does. */
  pageId: string | null = null
  /** The built-in chat as other people see it; one per document, kept between replies. */
  agent: AgentHandle | null = null
  /** Each page as it was before the run first edited it, for `diff_changes`. */
  baselines = new Map<string, PageSnapshot>()
  /** Undo entries the run's edits pushed, oldest first, so its turn can be reverted. */
  undoEntries: UndoEntry[] = []

  start(maxSteps: number, pageId: string): void {
    this.currentSteps = 0
    this.maxSteps = resolveAgentStepLimit(maxSteps)
    this.pageId = pageId
    this.baselines = new Map()
    this.undoEntries = []
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

/** Begin a run on the page the user is viewing. */
export function startRun(store: EditorStore, maxSteps: number, model?: string): void {
  const run = getRunState(store)
  run.start(maxSteps, store.state.currentPageId)
  run.agent ??= addAgent(store, 'chat', model)
  run.agent.update({ status: 'thinking', model })
}

/** The reply finished, failed, or was stopped: the agent stays listed but leaves the canvas. */
export function endRun(store: EditorStore): void {
  getRunState(store).agent?.update({ status: 'idle', cursor: undefined, selection: undefined })
}

/** Point the run's agent at nodes a tool just created or changed. */
export function markRunWork(store: EditorStore, nodeIds: string[]): void {
  const run = getRunState(store)
  const bounds = computeContentBounds(store.graph, nodeIds)
  if (!run.agent || !bounds) return
  run.agent.update({
    status: 'editing',
    cursor: { x: bounds.minX, y: bounds.minY, pageId: runPageId(store) },
    selection: nodeIds
  })
}

export function recordStep(store?: EditorStore): void {
  getRunState(store).currentSteps++
}

export function stepBudget(store: EditorStore): StepBudget {
  const { currentSteps, maxSteps } = getRunState(store)
  return { current: currentSteps, max: maxSteps }
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

/** The run's page, or the viewed page when no run has started or its page was deleted. */
export function runPageId(store: EditorStore): string {
  const { pageId } = getRunState(store)
  return pageId && store.graph.getNode(pageId)?.type === 'CANVAS'
    ? pageId
    : store.state.currentPageId
}

/** Move the run to `pageId`, and the user's view with it, as the agent's `switch_page` does. */
export async function moveRunToPage(store: EditorStore, pageId: string): Promise<void> {
  getRunState(store).pageId = pageId
  if (store.state.currentPageId !== pageId) await store.switchPage(pageId)
}

/** Keep `snapshot` as the run's starting state of its page unless the run already edited it. */
export function recordRunBaseline(store: EditorStore, snapshot: PageSnapshot): void {
  const pageId = snapshot.values().next().value?.id
  const { baselines } = getRunState(store)
  if (pageId && !baselines.has(pageId)) baselines.set(pageId, snapshot)
}

export function runBaseline(store: EditorStore, pageId: string): PageSnapshot | null {
  return getRunState(store).baselines.get(pageId) ?? null
}

/** Note the entry an edit just pushed, if it carries the run's label (`AI: <tool>`). */
export function recordRunUndoEntry(store: EditorStore, label: string): void {
  const entry = store.undo.peekUndo()
  const { undoEntries } = getRunState(store)
  if (entry?.label === label && !undoEntries.includes(entry)) undoEntries.push(entry)
}

export function runUndoEntries(store: EditorStore): readonly UndoEntry[] {
  return getRunState(store).undoEntries
}
