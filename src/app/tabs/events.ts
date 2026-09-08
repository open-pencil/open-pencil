import type { EditorStore } from '@/app/editor/session'

export type ActiveDocumentListener = (store: EditorStore) => void

const listeners = new Set<ActiveDocumentListener>()

export function emitActiveDocumentOpened(store: EditorStore): void {
  for (const listener of listeners) listener(store)
}

export function onActiveDocumentOpened(listener: ActiveDocumentListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
