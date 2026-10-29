import type { UIMessage } from 'ai'
import { isEqual } from 'es-toolkit'
import { shallowReactive, shallowRef, type ShallowRef } from 'vue'

import type { UndoneCalls } from '@/app/ai/chat/context'
import { undoOf, type ReplyUndo } from '@/app/ai/chat/metadata'
import type { RunUndoCall } from '@/app/ai/reply/run'
import { currentRun } from '@/app/ai/tools'
import type { EditorStore } from '@/app/editor/active-store'

interface TurnRecord {
  store: EditorStore
  /** The reply's edits, oldest first. */
  calls: readonly RunUndoCall[]
  /** The calls whose edit is undone, as the undo history last showed them. */
  undone: ReadonlySet<string>
}

/** Keyed by the assistant message the turn produced. The undo stack lives as long as the session. */
const turns = shallowReactive(new Map<string, TurnRecord>())
const undoListeners = new Set<(messageId: string, undone: readonly string[]) => void>()

/** Bumped on every undo stack change of a store, so turn state reads stay reactive. */
const historyVersions = new WeakMap<EditorStore, ShallowRef<number>>()

function historyVersion(store: EditorStore): number {
  let version = historyVersions.get(store)
  if (!version) {
    const created = shallowRef(0)
    // The store's emitter goes away with the store, and the listener with it.
    store.onEditorEvent('history:changed', () => {
      created.value++
      noticeUndoneCalls(store)
    })
    historyVersions.set(store, created)
    version = created
  }
  return version.value
}

/**
 * The calls whose edit is undone now. An edit that left the history keeps what it was last:
 * undone and then dropped by a later edit stays undone, applied and trimmed stays applied.
 */
function undoneNow({ store, calls, undone }: TurnRecord): Set<string> {
  return new Set(
    calls
      .filter(({ entry, toolCallId }) => {
        const state = store.undo.stateOf(entry)
        return state === 'undone' || (state === null && undone.has(toolCallId))
      })
      .map(({ toolCallId }) => toolCallId)
  )
}

/** Undo, Redo, or the chat's Revert and Restore changed which of a store's AI edits apply. */
function noticeUndoneCalls(store: EditorStore): void {
  for (const [messageId, turn] of turns) {
    if (turn.store !== store) continue
    const undone = undoneNow(turn)
    if (isEqual(undone, turn.undone)) continue
    turns.set(messageId, { ...turn, undone })
    for (const listener of undoListeners) listener(messageId, [...undone])
  }
}

/** Calls `listener` with a reply and its undone calls whenever the history changes them. */
export function onTurnUndoChanged(
  listener: (messageId: string, undone: readonly string[]) => void
): () => void {
  undoListeners.add(listener)
  return () => undoListeners.delete(listener)
}

export function recordTurn(
  messageId: string,
  store: EditorStore,
  calls: readonly RunUndoCall[]
): void {
  if (calls.length === 0) {
    turns.delete(messageId)
    return
  }
  historyVersion(store)
  const record: TurnRecord = {
    store,
    calls: [...calls],
    undone: new Set()
  }
  turns.set(messageId, { ...record, undone: undoneNow(record) })
}

/**
 * Records a reply's turn from its run once the run's last edit landed, so an edit a stopped
 * reply's tool finishes afterwards still belongs to it. Returns what the reply's message
 * keeps: its edits, those undone already, and those the run told the model about.
 */
export async function recordReplyTurn(
  messageId: string,
  store: EditorStore
): Promise<ReplyUndo | null> {
  const run = currentRun(store)
  await run.settled()
  recordTurn(messageId, store, run.undoCalls)
  const turn = turns.get(messageId)
  if (!turn) return null
  return {
    edits: turn.calls.map(({ tool, toolCallId }) => ({ tool, toolCallId })),
    undone: [...turn.undone],
    reported:
      run.reportedUndone.size > 0 ? { undone: [...run.reportedUndone], in: messageId } : undefined
  }
}

export interface TurnEdits {
  count: number
  undone: number
  /** Whether the edits still applied are the newest on the undo stack, so undoing them touches nothing else. */
  revertable: boolean
  /** Whether Redo would bring back exactly the undone edits next. */
  restorable: boolean
}

function split(turn: TurnRecord) {
  const undone = turn.calls.filter((call) => turn.undone.has(call.toolCallId))
  const applied = turn.calls.filter((call) => !turn.undone.has(call.toolCallId))
  return { undone, applied }
}

/** Reactive: follows both the recorded turns and the store's undo stack. */
export function turnEdits(messageId: string): TurnEdits | null {
  const turn = turns.get(messageId)
  if (!turn) return null
  historyVersion(turn.store)
  const { undone, applied } = split(turn)
  const { undo } = turn.store
  return {
    count: turn.calls.length,
    undone: undone.length,
    revertable:
      applied.length > 0 &&
      applied.every(({ entry }, index) => undo.peekUndo(applied.length - 1 - index) === entry),
    restorable:
      undone.length > 0 && undone.every(({ entry }, index) => undo.peekRedo(index) === entry)
  }
}

/** Undoes the turn's edits still applied, when nothing has been pushed on top of them. */
export function revertTurn(messageId: string): boolean {
  const turn = turns.get(messageId)
  if (!turn || !turnEdits(messageId)?.revertable) return false
  // Each step undoes one of the turn's entries, newest first; the history change marks them.
  for (const _call of split(turn).applied) turn.store.undoAction()
  return true
}

/** Redoes the turn's undone edits while nothing has been edited since they were undone. */
export function restoreTurn(messageId: string): boolean {
  const turn = turns.get(messageId)
  if (!turn || !turnEdits(messageId)?.restorable) return false
  // Each step redoes one of the turn's entries, oldest first.
  for (const _call of split(turn).undone) turn.store.redoAction()
  return true
}

export function clearTurns(): void {
  turns.clear()
}

/** A reply whose undone edits changed since the model last heard, and how. */
export interface UndoReport {
  messageId: string
  undone: readonly string[]
  calls: UndoneCalls
}

/**
 * What a request after `messages` must tell the model about undone edits: for each reply,
 * those undone or redone since the model last heard. A report counts while the message that
 * carried it is still in `messages`; one being sent again is left out, so it is made again.
 */
export function undoToReport(messages: readonly UIMessage[]): UndoReport[] {
  const ids = new Set(messages.map((message) => message.id))
  return messages.flatMap((message) => {
    const undo = undoOf(message)
    if (!undo) return []
    const known = new Set(undo.reported && ids.has(undo.reported.in) ? undo.reported.undone : [])
    const now = new Set(undo.undone)
    const undone = undo.edits.filter(
      (call) => now.has(call.toolCallId) && !known.has(call.toolCallId)
    )
    const redone = undo.edits.filter(
      (call) => !now.has(call.toolCallId) && known.has(call.toolCallId)
    )
    if (undone.length === 0 && redone.length === 0) return []
    return [{ messageId: message.id, undone: undo.undone, calls: { undone, redone } }]
  })
}
