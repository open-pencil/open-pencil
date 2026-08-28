import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { browserSystemClipboard } from '@/app/editor/clipboard/system/browser'
import { tauriSystemClipboard } from '@/app/editor/clipboard/system/tauri'
import type { SystemClipboard } from '@/app/editor/clipboard/system/types'
import { isTauri } from '@/app/tauri/env'

function resolveSystemClipboard(): SystemClipboard {
  return isTauri() ? tauriSystemClipboard : browserSystemClipboard
}

export async function executeClipboardCommand(
  store: EditorStore,
  command: 'copy' | 'cut' | 'paste',
  cursorPos?: Vector,
  clipboard: SystemClipboard = resolveSystemClipboard()
): Promise<boolean> {
  if (command === 'copy') return clipboard.copy(store)

  if (command === 'cut') {
    const selectedIds = new Set(store.state.selectedIds)
    const copied = await clipboard.copy(store)
    if (!copied) return false
    const selectionUnchanged =
      selectedIds.size === store.state.selectedIds.size &&
      [...selectedIds].every((id) => store.state.selectedIds.has(id))
    if (!selectionUnchanged) return false
    store.deleteSelected()
    return true
  }

  return clipboard.paste(store, cursorPos)
}

export type { SystemClipboard } from './types'
