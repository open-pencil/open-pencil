import { shallowReactive, shallowRef, type ShallowRef } from 'vue'

import type { UndoEntry } from '@open-pencil/scene-graph/undo'

import type { EditorStore } from '@/app/editor/active-store'

interface TurnRecord {
  store: EditorStore
  /** The turn's undo entries, oldest first. */
  entries: readonly UndoEntry[]
}

/** Bumped on every undo stack change of a store, so turn state reads stay reactive. */
const historyVersions = new WeakMap<EditorStore, ShallowRef<number>>()

function historyVersion(store: EditorStore): number {
  let version = historyVersions.get(store)
  if (!version) {
    const created = shallowRef(0)
    // The store's emitter goes away with the store, and the listener with it.
    store.onEditorEvent('history:changed', () => created.value++)
    historyVersions.set(store, created)
    version = created
  }
  return version.value
}

/** Keyed by the assistant message the turn produced. The undo stack lives as long as the session. */
const turns = shallowReactive(new Map<string, TurnRecord>())

export function recordTurn(
  messageId: string,
  store: EditorStore,
  entries: readonly UndoEntry[]
): void {
  if (entries.length === 0) turns.delete(messageId)
  else turns.set(messageId, { store, entries: [...entries] })
}

export interface TurnEdits {
  count: number
  /** Whether the turn's edits are still the newest on the undo stack, so undoing them touches nothing else. */
  revertable: boolean
}

/** Reactive: follows both the recorded turns and the store's undo stack. */
export function turnEdits(messageId: string): TurnEdits | null {
  const turn = turns.get(messageId)
  if (!turn) return null
  const { entries, store } = turn
  historyVersion(store)
  const revertable = entries.every(
    (entry, index) => store.undo.peekUndo(entries.length - 1 - index) === entry
  )
  return { count: entries.length, revertable }
}

/** Undoes the turn's edits when nothing has been pushed on top of them. */
export function revertTurn(messageId: string): boolean {
  const turn = turns.get(messageId)
  if (!turn || !turnEdits(messageId)?.revertable) return false
  // Each step undoes one of the turn's entries, newest first.
  for (const _entry of turn.entries) turn.store.undoAction()
  turns.delete(messageId)
  return true
}

export function clearTurns(): void {
  turns.clear()
}
