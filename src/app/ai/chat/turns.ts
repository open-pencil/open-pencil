import type { UIMessage } from 'ai'
import * as v from 'valibot'
import { shallowReactive, shallowRef, type ShallowRef } from 'vue'

import type { UndoEntry } from '@open-pencil/scene-graph/undo'

import type { EditorStore } from '@/app/editor/active-store'

interface TurnRecord {
  store: EditorStore
  /** The turn's undo entries, oldest first. */
  entries: readonly UndoEntry[]
  /** Set by `revertTurn`; cleared when Redo puts the entries back on top of the undo stack. */
  reverted: boolean
}

/** Bumped on every undo stack change of a store, so turn state reads stay reactive. */
const historyVersions = new WeakMap<EditorStore, ShallowRef<number>>()

function historyVersion(store: EditorStore): number {
  let version = historyVersions.get(store)
  if (!version) {
    const created = shallowRef(0)
    // The store's emitter goes away with the store, and the listener with it.
    store.onEditorEvent('history:changed', () => {
      created.value++
      noticeRestoredTurns(store)
    })
    historyVersions.set(store, created)
    version = created
  }
  return version.value
}

/** Keyed by the assistant message the turn produced. The undo stack lives as long as the session. */
const turns = shallowReactive(new Map<string, TurnRecord>())
const restoredListeners = new Set<(messageId: string) => void>()

/** Whether a reverted turn's entries are the next ones Redo applies, oldest first. */
function nextToRedo({ entries, store }: TurnRecord): boolean {
  return entries.every((entry, index) => store.undo.peekRedo(index) === entry)
}

/** Whether the turn's entries are the newest on its store's undo stack, oldest deepest. */
function onTopOfUndo({ entries, store }: TurnRecord): boolean {
  return entries.every((entry, index) => store.undo.peekUndo(entries.length - 1 - index) === entry)
}

function noticeRestoredTurns(store: EditorStore): void {
  for (const [messageId, turn] of turns) {
    if (turn.store !== store || !turn.reverted || !onTopOfUndo(turn)) continue
    turns.set(messageId, { ...turn, reverted: false })
    for (const listener of restoredListeners) listener(messageId)
  }
}

/** Calls `listener` with a reverted turn's message when Redo brings its edits back. */
export function onTurnRestored(listener: (messageId: string) => void): () => void {
  restoredListeners.add(listener)
  return () => restoredListeners.delete(listener)
}

export function recordTurn(
  messageId: string,
  store: EditorStore,
  entries: readonly UndoEntry[]
): void {
  if (entries.length === 0) turns.delete(messageId)
  else turns.set(messageId, { store, entries: [...entries], reverted: false })
}

export interface TurnEdits {
  count: number
  /** Whether the turn's edits are still the newest on the undo stack, so undoing them touches nothing else. */
  revertable: boolean
  /** Whether the turn was reverted and Redo would bring back exactly its edits next. */
  restorable: boolean
}

/** Reactive: follows both the recorded turns and the store's undo stack. */
export function turnEdits(messageId: string): TurnEdits | null {
  const turn = turns.get(messageId)
  if (!turn) return null
  historyVersion(turn.store)
  return {
    count: turn.entries.length,
    revertable: onTopOfUndo(turn),
    restorable: turn.reverted && nextToRedo(turn)
  }
}

/** Undoes the turn's edits when nothing has been pushed on top of them. */
export function revertTurn(messageId: string): boolean {
  const turn = turns.get(messageId)
  if (!turn || !turnEdits(messageId)?.revertable) return false
  // Each step undoes one of the turn's entries, newest first.
  for (const _entry of turn.entries) turn.store.undoAction()
  // Kept, so that Redo restoring the edits can be noticed.
  turns.set(messageId, { ...turn, reverted: true })
  return true
}

/**
 * Redoes a reverted turn's edits while nothing has been edited since the revert. Listeners of
 * `onTurnRestored` hear about it as about any Redo that brings the edits back.
 */
export function restoreTurn(messageId: string): boolean {
  const turn = turns.get(messageId)
  if (!turn || !turnEdits(messageId)?.restorable) return false
  // Each step redoes one of the turn's entries, oldest first.
  for (const _entry of turn.entries) turn.store.redoAction()
  return true
}

export function clearTurns(): void {
  turns.clear()
}

/**
 * A reverted reply is marked in its message metadata, which conversations store, so the chat
 * still shows it after reopening. `reportedIn` is the user message whose request told the
 * model about it.
 */
const RevertedMetadata = v.object({ reverted: v.literal(true), reportedIn: v.optional(v.string()) })

export interface Revert {
  reportedIn?: string
}

export function revertOf(message: UIMessage): Revert | null {
  const parsed = v.safeParse(RevertedMetadata, message.metadata)
  return parsed.success ? { reportedIn: parsed.output.reportedIn } : null
}

/** The message with its revert mark replaced, or removed for `null`, keeping other metadata. */
export function withRevert(message: UIMessage, revert: Revert | null): UIMessage {
  const metadata = v.is(v.record(v.string(), v.unknown()), message.metadata) ? message.metadata : {}
  const { reverted: _reverted, reportedIn: _reportedIn, ...rest } = metadata
  if (!revert) return { ...message, metadata: rest }
  const reported = revert.reportedIn === undefined ? {} : { reportedIn: revert.reportedIn }
  return { ...message, metadata: { ...rest, reverted: true, ...reported } }
}

/**
 * Reverted replies a request after `messages` must report: those that no request in
 * `messages` has reported. A message being sent again is left out of `messages`, so the
 * reverts it reported are reported again.
 */
export function revertsToReport(messages: readonly UIMessage[]): string[] {
  const requests = new Set(
    messages.filter((message) => message.role === 'user').map((message) => message.id)
  )
  return messages.flatMap((message) => {
    const revert = revertOf(message)
    if (!revert) return []
    const { reportedIn } = revert
    return reportedIn !== undefined && requests.has(reportedIn) ? [] : [message.id]
  })
}
