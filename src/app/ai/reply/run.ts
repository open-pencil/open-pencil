import type { DocumentChange, PageSnapshot } from '@open-pencil/core'
import type { StepBudget } from '@open-pencil/core/tools'
import type { UndoEntry } from '@open-pencil/scene-graph/undo'

import { describeUndoneCalls, type CallRef } from '@/app/ai/chat/context'
import type { PreviewFocus } from '@/app/ai/preview/canvas'
import { DEFAULT_AGENT_STEPS, resolveAgentStepLimit } from '@/app/ai/reply/step-limit'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { addAgent, agentPlacement, type AgentHandle } from '@/app/presence/registry'

/**
 * One reply's run: the page it works on, its step budget, and the edits it made. It ends once,
 * finished, stopped, or failed; a tool that was already running finishes into the run it
 * started in, even after that run ended, so its edit stays part of that reply.
 */
/** An undo entry one of a run's tool calls pushed. */
export interface RunUndoCall extends CallRef {
  entry: UndoEntry
}

/** What a chat reply's undo entries start with, before the tool's name. */
export const AI_UNDO_PREFIX = 'AI'

/** The label of an AI tool call's undo entry, which Edit → Undo shows. */
export function aiUndoLabel(tool: string): string {
  return `${AI_UNDO_PREFIX}: ${tool}`
}

export class Run {
  currentSteps = 0
  /** Captured for the message in progress; settings changes apply to the next one. */
  readonly maxSteps: number
  /** The page the run works on. The user's navigation does not move it; the agent's does. */
  pageId: string
  /** Each page as it was before the run first edited it, for `diff_changes`. */
  readonly baselines = new Map<string, PageSnapshot>()
  /** Undo entries the run's edits pushed, oldest first, with the calls that pushed them. */
  readonly undoCalls: RunUndoCall[] = []
  /** The run's own calls the model was told the user undid while the run went on. */
  readonly reportedUndone = new Set<string>()
  /** Tool calls that changed the document, which a stopped reply's transcript reports. */
  readonly changedCalls = new Set<string>()
  /** False once the reply finished, was stopped, or failed; its agent no longer moves. */
  active = true
  private toolsInFlight = 0
  private whenSettled: Promise<void> = Promise.resolve()
  private settle: () => void = () => undefined

  /**
   * Whether the built-in chat's agent shows the run's work on the canvas and follows its page
   * changes; an ACP agent's run shows through its own MCP session instead.
   */
  readonly presence: boolean

  constructor(maxSteps: number, pageId: string, presence = true) {
    this.maxSteps = resolveAgentStepLimit(maxSteps)
    this.pageId = pageId
    this.presence = presence
  }

  hitLimit(): boolean {
    return this.currentSteps >= this.maxSteps
  }

  /** A tool started editing for this run; `settled` waits until every such tool is done. */
  beginTool(): void {
    if (this.toolsInFlight++ === 0) {
      this.whenSettled = new Promise((resolve) => {
        this.settle = resolve
      })
    }
  }

  endTool(): void {
    if (--this.toolsInFlight === 0) this.settle()
  }

  /** Resolves once no tool of this run is still editing. */
  settled(): Promise<void> {
    return this.whenSettled
  }
}

class RunState {
  run = new Run(DEFAULT_AGENT_STEPS, '')
  /** The built-in chat as other people see it; one per document, kept between replies. */
  agent: AgentHandle | null = null
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

/** Begin a run on the page the user is viewing, as a message is sent. */
export function startRun(store: EditorStore, maxSteps: number, model?: string): Run {
  const state = getRunState(store)
  const pageId = store.state.currentPageId
  state.run = new Run(maxSteps, pageId)
  state.agent ??= addAgent(store, 'chat', model)
  state.agent.update({ status: 'thinking', model, pageId })
  return state.run
}

/** Each ACP chat's document, by the chat id its agent's MCP session carries. */
const agentChats = new Map<string, EditorStore>()

/**
 * Begin a run for an ACP chat's reply. Its agent shows through its MCP session instead of as
 * the built-in chat, and its tool calls find the run by `chat` (`agentReplyRun`).
 */
export function startAgentRun(store: EditorStore, chat: string): Run {
  const state = getRunState(store)
  state.run = new Run(DEFAULT_AGENT_STEPS, store.state.currentPageId, false)
  agentChats.set(chat, store)
  return state.run
}

/** The ACP chat is gone, so a late call from its agent belongs to no reply. */
export function forgetAgentChat(chat: string): void {
  agentChats.delete(chat)
}

/**
 * The reply an ACP agent's tool call belongs to: its chat's run while the reply goes on, when
 * the call edits the chat's own document. A call elsewhere stays an ordinary agent edit.
 */
export function agentReplyRun(store: EditorStore, chat: string | undefined): Run | null {
  if (!chat || agentChats.get(chat) !== store) return null
  const run = currentRun(store)
  return run.active ? run : null
}

/**
 * The reply finished, failed, or was stopped: the agent stays listed but leaves the canvas.
 * Only the first call counts, and a later run is not ended by an earlier one's late call.
 */
export function endRun(store: EditorStore, run = currentRun(store)): void {
  const state = getRunState(store)
  if (!run.active) return
  run.active = false
  if (state.run !== run || !run.presence) return
  state.agent?.update({
    status: 'idle',
    cursor: undefined,
    selection: undefined,
    outline: undefined
  })
}

/** The run of the reply in progress, or of the last one. */
export function currentRun(store: EditorStore): Run {
  return getRunState(store).run
}

/** Whether the agent may still show where it works: its run is the latest and still going. */
function agentAtWork(store: EditorStore): AgentHandle | null {
  const { agent, run } = getRunState(store)
  return run.active && run.presence ? agent : null
}

/**
 * Point the run's agent at JSX it is still streaming: the element that appeared last, with
 * outlines of what it builds, until the tool runs and `markRunWork` names the real layers.
 */
export function markRunPreview(store: EditorStore, focus: PreviewFocus): void {
  agentAtWork(store)?.update({
    status: 'editing',
    cursor: { ...focus.cursor, pageId: runPageId(store) },
    selection: undefined,
    outline: focus.outline
  })
}

/** Point the run's agent at nodes a tool just created or changed. */
export function markRunWork(store: EditorStore, nodeIds: string[]): void {
  const agent = agentAtWork(store)
  const placement = agentPlacement(store, nodeIds, runPageId(store))
  if (!agent || !placement) return
  agent.update({ status: 'editing', ...placement })
}

/**
 * Point the run's agent at the layers a call changed, on whichever page they are, for calls such
 * as `eval` whose result names none. Only the outermost of them are outlined.
 */
export function markRunChange(store: EditorStore, change: DocumentChange): void {
  const { graph } = store
  const layers = new Set(
    [...change.created.map((node) => node.id), ...change.updated.map((update) => update.id)].filter(
      // Pages and the document root are where the agent works, not what it works on.
      (id) => id !== graph.rootId && graph.getNode(id)?.type !== 'CANVAS'
    )
  )
  const outermost = [...layers].filter((id) => {
    const parentId = graph.getNode(id)?.parentId
    return !parentId || !layers.has(parentId)
  })
  markRunWork(store, outermost)
}

export function recordStep(store?: EditorStore): void {
  getRunState(store).run.currentSteps++
}

export function stepBudget(store: EditorStore): StepBudget {
  const { currentSteps, maxSteps } = getRunState(store).run
  return { current: currentSteps, max: maxSteps }
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).run.hitLimit()
}

/** The run's page, or the viewed page when no run has started or its page was deleted. */
export function runPageId(store: EditorStore): string {
  const { pageId } = getRunState(store).run
  return pageId && store.graph.getNode(pageId)?.type === 'CANVAS'
    ? pageId
    : store.state.currentPageId
}

/** Move the run to `pageId`, and the user's view with it, as the agent's `switch_page` does. */
export async function moveRunToPage(store: EditorStore, run: Run, pageId: string): Promise<void> {
  // A stopped reply's late `switch_page` no longer takes the view anywhere, and an ACP agent's
  // page change is its own MCP session's to show.
  if (!run.active || !run.presence) return
  run.pageId = pageId
  getRunState(store).agent?.update({ pageId })
  if (store.state.currentPageId !== pageId) await store.switchPage(pageId)
}

/** The built-in chat's agent in this document, once it has replied. */
export function runAgentId(store: EditorStore): string | undefined {
  return getRunState(store).agent?.id
}

/** Keep `snapshot` as the run's starting state of its page unless the run already edited it. */
export function recordRunBaseline(run: Run, snapshot: PageSnapshot): void {
  const pageId = snapshot.nodes.values().next().value?.id
  if (pageId && !run.baselines.has(pageId)) run.baselines.set(pageId, snapshot)
}

export function runBaseline(store: EditorStore, pageId: string): PageSnapshot | null {
  return getRunState(store).run.baselines.get(pageId) ?? null
}

/**
 * Note the entry an edit just pushed, if it carries the run's label (`AI: <tool>`). An edit that
 * changed nothing pushes none, so the entry on top before it, `previous`, is not the edit's.
 */
export function recordRunUndoEntry(
  store: EditorStore,
  run: Run,
  call: CallRef,
  previous: UndoEntry | undefined
): void {
  const entry = store.undo.peekUndo()
  if (
    entry &&
    entry !== previous &&
    entry.label === aiUndoLabel(call.tool) &&
    !run.undoCalls.some((recorded) => recorded.entry === entry)
  ) {
    run.undoCalls.push({ ...call, entry })
  }
}

export function runUndoEntries(store: EditorStore): readonly UndoEntry[] {
  return getRunState(store).run.undoCalls.map(({ entry }) => entry)
}

/**
 * A note for the run's next tool result when the user undid or redid some of the run's own
 * edits since the model last heard; empty when nothing changed. Taking it counts as telling.
 */
export function takeRunUndoNote(store: EditorStore, run = currentRun(store)): string {
  const undone: CallRef[] = []
  const redone: CallRef[] = []
  for (const { entry, tool, toolCallId } of run.undoCalls) {
    const state = store.undo.stateOf(entry)
    if (state === 'undone' && !run.reportedUndone.has(toolCallId)) {
      undone.push({ tool, toolCallId })
      run.reportedUndone.add(toolCallId)
    } else if (state === 'applied' && run.reportedUndone.has(toolCallId)) {
      redone.push({ tool, toolCallId })
      run.reportedUndone.delete(toolCallId)
    }
  }
  return describeUndoneCalls({ undone, redone })
}
