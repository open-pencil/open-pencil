import type { EditorStore } from '@/app/editor/active-store'

export function requestRenameSelection(store: EditorStore): void {
  const selectedIds = [...store.state.selectedIds]
  if (selectedIds.length === 0) return
  if (selectedIds.length === 1) {
    store.state.renameNodeId = selectedIds[0]
    return
  }
  store.state.renameSelectionOpen = true
}
