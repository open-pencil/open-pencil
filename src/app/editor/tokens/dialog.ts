import type { EditorStore } from '@/app/editor/active-store'

export function openVariablesDialog(store: EditorStore): void {
  store.state.variablesOpen = true
}
