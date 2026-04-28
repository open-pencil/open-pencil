import type { EditorCommandId } from './types'

export const EDITOR_COMMAND_SHORTCUTS: Partial<Record<EditorCommandId, string>> = {
  'edit.undo': '⌘Z',
  'edit.redo': '⇧⌘Z',
  'selection.selectAll': '⌘A',
  'selection.duplicate': '⌘D',
  'selection.delete': '⌫',
  'selection.group': '⌘G',
  'selection.ungroup': '⇧⌘G',
  'selection.createComponent': '⌥⌘K',
  'selection.createComponentSet': '⇧⌘K',
  'selection.detachInstance': '⌥⌘B',
  'selection.wrapInAutoLayout': '⇧A',
  'selection.bringToFront': ']',
  'selection.sendToBack': '[',
  'selection.toggleVisibility': '⇧⌘H',
  'selection.toggleLock': '⇧⌘L',
}
