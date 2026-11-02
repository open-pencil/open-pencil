import type { EditorStore } from '@/app/editor/active-store'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste/replace'
import { executeClipboardCommand } from '@/app/editor/clipboard/system'
import { requestRenameSelection } from '@/app/editor/selection/rename-dialog'
import { onCanvasSelection } from '@/app/shell/commands/focused'

export function createSelectionMenuActions(store: EditorStore) {
  return {
    copy: () => void executeClipboardCommand(store, 'copy'),
    cut: () => void executeClipboardCommand(store, 'cut'),
    paste: () => void executeClipboardCommand(store, 'paste'),
    'paste-to-replace': onCanvasSelection(() => void pasteClipboardToReplace(store)),
    'selection.rename': onCanvasSelection(() => requestRenameSelection(store))
  }
}
