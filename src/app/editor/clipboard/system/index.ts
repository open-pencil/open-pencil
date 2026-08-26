import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import {
  copySelectionToBrowserClipboard,
  createBrowserSystemClipboard,
  pasteFromBrowserClipboard
} from '@/app/editor/clipboard/system/browser'
import {
  copySelectionToTauriClipboard,
  pasteFromTauriClipboard,
  tauriSystemClipboard
} from '@/app/editor/clipboard/system/tauri'
import type { SystemClipboard } from '@/app/editor/clipboard/system/types'
import { isTauri } from '@/app/tauri/env'

export {
  copySelectionToBrowserClipboard,
  copySelectionToTauriClipboard,
  createBrowserSystemClipboard,
  pasteFromBrowserClipboard,
  pasteFromTauriClipboard
}
export type { BrowserClipboardEnvironment, ClipboardPayload, SystemClipboard } from './types'

export function createSystemClipboard(): SystemClipboard {
  return isTauri() ? tauriSystemClipboard : createBrowserSystemClipboard()
}

export async function executeClipboardCommand(
  store: EditorStore,
  command: 'copy' | 'cut' | 'paste',
  cursorPos?: Vector,
  clipboard: SystemClipboard = createSystemClipboard()
): Promise<boolean> {
  if (command === 'copy') return clipboard.copy(store)

  if (command === 'cut') {
    const copied = await clipboard.copy(store)
    if (!copied) return false
    store.deleteSelected()
    return true
  }

  return clipboard.paste(store, cursorPos)
}
