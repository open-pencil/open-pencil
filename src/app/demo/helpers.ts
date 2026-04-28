import type { EditorStore } from '@/app/editor/session'

export function makeComponent(store: EditorStore, ids: string[]): string {
  store.select(ids)
  store.createComponentFromSelection()
  return [...store.state.selectedIds][0]
}
