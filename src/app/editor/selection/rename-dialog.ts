import type { EditorStore } from '@/app/editor/active-store'

export function openRenameSelectionDialog(store: EditorStore): void {
  if (store.state.selectedIds.size === 0) return
  store.state.renameSelectionOpen = true
}
