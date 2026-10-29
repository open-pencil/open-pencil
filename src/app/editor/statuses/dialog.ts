import type { EditorStore } from '@/app/editor/active-store'

export function openStatusesDialog(store: EditorStore): void {
  store.state.statusesOpen = true
}
