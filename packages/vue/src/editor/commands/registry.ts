import type { EditorCommandId } from './types'

export interface EditorCommandMetadata {
  /** The command's shortcut token (`formatShortcut`), shown in menus and bound to the key. */
  shortcut?: string
  /** More tokens that run the command, never shown. */
  aliases?: string[]
  contextTestId?: string
}

export const EDITOR_COMMAND_METADATA = {
  'edit.undo': { shortcut: 'MOD+Z' },
  'edit.redo': { shortcut: 'MOD+SHIFT+Z', aliases: ['MOD+Y'] },
  'selection.selectAll': { shortcut: 'MOD+A' },
  'selection.selectInverse': { shortcut: 'MOD+SHIFT+A' },
  // Enter also opens a vector's path or a text layer, so the app binds it with that.
  'selection.selectChildren': { shortcut: '↵' },
  'selection.selectParent': {
    shortcut: 'SHIFT+↵',
    aliases: ['\\']
  },
  'selection.selectNextSibling': { shortcut: '⇥' },
  'selection.selectPreviousSibling': { shortcut: 'SHIFT+⇥' },
  'selection.duplicate': {
    shortcut: 'MOD+D',
    contextTestId: 'context-duplicate'
  },
  'selection.delete': { shortcut: '⌫', contextTestId: 'context-delete' },
  'selection.group': { shortcut: 'MOD+G', contextTestId: 'context-group' },
  'selection.frameSelection': {
    shortcut: 'MOD+ALT+G',
    contextTestId: 'context-frame-selection'
  },
  'selection.wrapInSection': {},
  'selection.ungroup': { shortcut: 'MOD+SHIFT+G' },
  'selection.createComponent': {
    shortcut: 'MOD+ALT+K',
    contextTestId: 'context-create-component'
  },
  'selection.createComponentSet': { shortcut: 'MOD+SHIFT+K' },
  'selection.detachInstance': { shortcut: 'MOD+ALT+B' },
  'selection.detachIcon': {},
  'selection.goToMainComponent': {},
  'selection.createInstance': {},
  'selection.createSlot': { contextTestId: 'context-create-slot' },
  'selection.wrapInAutoLayout': { shortcut: 'SHIFT+A' },
  'selection.toggleMask': {
    shortcut: 'MOD+ALT+M',
    aliases: ['CTRL+META+M'],
    contextTestId: 'context-toggle-mask'
  },
  'selection.bringForward': {
    shortcut: 'MOD+]',
    contextTestId: 'context-bring-forward'
  },
  'selection.bringToFront': {
    shortcut: ']',
    contextTestId: 'context-bring-to-front'
  },
  'selection.sendBackward': {
    shortcut: 'MOD+[',
    contextTestId: 'context-send-backward'
  },
  'selection.sendToBack': {
    shortcut: '[',
    contextTestId: 'context-send-to-back'
  },
  'selection.toggleVisibility': {
    shortcut: 'MOD+SHIFT+H',
    contextTestId: 'context-toggle-visibility'
  },
  'selection.toggleLock': {
    shortcut: 'MOD+SHIFT+L',
    contextTestId: 'context-toggle-lock'
  },
  'selection.flipHorizontal': {
    shortcut: 'SHIFT+H',
    contextTestId: 'context-flip-horizontal'
  },
  'selection.flipVertical': {
    shortcut: 'SHIFT+V',
    contextTestId: 'context-flip-vertical'
  },
  'selection.distributeHorizontal': { shortcut: 'CTRL+ALT+H' },
  'selection.distributeVertical': { shortcut: 'CTRL+ALT+V' },
  'selection.tidyUp': { shortcut: 'CTRL+ALT+T' },
  'selection.packHorizontal': {},
  'selection.packVertical': {},
  'selection.arrangeSpread': {},
  'selection.arrangeCompact': {},
  'selection.arrangePack': {},
  'selection.arrangeFlowDown': {},
  'selection.arrangeFlowRight': {},
  'selection.arrangeTreeDown': {},
  'selection.arrangeTreeRight': {},
  'selection.arrangeRadial': {},
  'selection.arrangeNetwork': {},
  'selection.booleanUnion': {
    shortcut: 'ALT+SHIFT+U',
    contextTestId: 'context-boolean-union'
  },
  'selection.booleanSubtract': {
    shortcut: 'ALT+SHIFT+S',
    contextTestId: 'context-boolean-subtract'
  },
  'selection.booleanIntersect': {
    shortcut: 'ALT+SHIFT+I',
    contextTestId: 'context-boolean-intersect'
  },
  'selection.booleanExclude': {
    shortcut: 'ALT+SHIFT+E',
    contextTestId: 'context-boolean-exclude'
  },
  'selection.flatten': {
    shortcut: 'ALT+SHIFT+F',
    contextTestId: 'context-flatten'
  },
  'selection.outlineText': { contextTestId: 'context-outline-text' },
  'selection.outlineStroke': { contextTestId: 'context-outline-stroke' },
  'selection.moveToPage': {},
  'selection.setOpacity': { shortcut: '1-9, 0' },
  'view.zoom100': { shortcut: 'MOD+0', aliases: ['SHIFT+0'] },
  'view.zoomFit': { shortcut: 'SHIFT+1', aliases: ['MOD+1'] },
  'view.zoomSelection': { shortcut: 'SHIFT+2', aliases: ['MOD+2'] },
  'view.zoomNextFrame': { shortcut: 'N' },
  'view.zoomPreviousFrame': { shortcut: 'SHIFT+N' },
  'view.nextPage': { shortcut: '⇟' },
  'view.previousPage': { shortcut: '⇞' }
} satisfies Record<EditorCommandId, EditorCommandMetadata>

export function editorCommandMetadata(id: EditorCommandId): EditorCommandMetadata {
  return EDITOR_COMMAND_METADATA[id]
}

/** Every token a command's key answers to: its shortcut, then its aliases. */
export function editorCommandShortcuts(id: EditorCommandId): string[] {
  const { shortcut, aliases = [] } = editorCommandMetadata(id)
  return shortcut ? [shortcut, ...aliases] : aliases
}
