import type { EditorCommandId } from './types'

export interface EditorCommandMetadata {
  shortcut?: string
  keybinding?: string | string[]
  contextTestId?: string
}

export const EDITOR_COMMAND_METADATA = {
  'edit.undo': { shortcut: 'MOD+Z', keybinding: '$mod+KeyZ' },
  'edit.redo': { shortcut: 'MOD+SHIFT+Z', keybinding: ['$mod+Shift+KeyZ', '$mod+KeyY'] },
  'selection.selectAll': { shortcut: 'MOD+A', keybinding: '$mod+KeyA' },
  'selection.duplicate': {
    shortcut: 'MOD+D',
    keybinding: '$mod+KeyD',
    contextTestId: 'context-duplicate'
  },
  'selection.delete': { shortcut: '⌫', contextTestId: 'context-delete' },
  'selection.group': { shortcut: 'MOD+G', keybinding: '$mod+KeyG', contextTestId: 'context-group' },
  'selection.frameSelection': {
    shortcut: 'MOD+ALT+G',
    keybinding: '$mod+Alt+KeyG',
    contextTestId: 'context-frame-selection'
  },
  'selection.ungroup': { shortcut: 'MOD+SHIFT+G', keybinding: '$mod+Shift+KeyG' },
  'selection.createComponent': {
    shortcut: 'MOD+ALT+K',
    keybinding: '$mod+Alt+KeyK',
    contextTestId: 'context-create-component'
  },
  'selection.createComponentSet': { shortcut: 'MOD+SHIFT+K', keybinding: '$mod+Shift+KeyK' },
  'selection.detachInstance': { shortcut: 'MOD+ALT+B', keybinding: '$mod+Alt+KeyB' },
  'selection.goToMainComponent': {},
  'selection.createInstance': {},
  'selection.wrapInAutoLayout': { shortcut: 'SHIFT+A', keybinding: 'Shift+KeyA' },
  'selection.toggleMask': {
    shortcut: 'MOD+ALT+M',
    keybinding: ['Control+Meta+KeyM', '$mod+Alt+KeyM'],
    contextTestId: 'context-toggle-mask'
  },
  'selection.bringToFront': {
    shortcut: ']',
    keybinding: 'BracketRight',
    contextTestId: 'context-bring-to-front'
  },
  'selection.sendToBack': {
    shortcut: '[',
    keybinding: 'BracketLeft',
    contextTestId: 'context-send-to-back'
  },
  'selection.toggleVisibility': {
    shortcut: 'MOD+SHIFT+H',
    keybinding: '$mod+Shift+KeyH',
    contextTestId: 'context-toggle-visibility'
  },
  'selection.toggleLock': {
    shortcut: 'MOD+SHIFT+L',
    keybinding: '$mod+Shift+KeyL',
    contextTestId: 'context-toggle-lock'
  },
  'selection.flipHorizontal': {
    shortcut: 'SHIFT+H',
    keybinding: 'Shift+KeyH',
    contextTestId: 'context-flip-horizontal'
  },
  'selection.flipVertical': {
    shortcut: 'SHIFT+V',
    keybinding: 'Shift+KeyV',
    contextTestId: 'context-flip-vertical'
  },
  'selection.booleanUnion': {
    shortcut: 'ALT+SHIFT+U',
    keybinding: 'Alt+Shift+KeyU',
    contextTestId: 'context-boolean-union'
  },
  'selection.booleanSubtract': {
    shortcut: 'ALT+SHIFT+S',
    keybinding: 'Alt+Shift+KeyS',
    contextTestId: 'context-boolean-subtract'
  },
  'selection.booleanIntersect': {
    shortcut: 'ALT+SHIFT+I',
    keybinding: 'Alt+Shift+KeyI',
    contextTestId: 'context-boolean-intersect'
  },
  'selection.booleanExclude': {
    shortcut: 'ALT+SHIFT+E',
    keybinding: 'Alt+Shift+KeyE',
    contextTestId: 'context-boolean-exclude'
  },
  'selection.flatten': {
    shortcut: 'ALT+SHIFT+F',
    keybinding: 'Alt+Shift+KeyF',
    contextTestId: 'context-flatten'
  },
  'selection.outlineText': { contextTestId: 'context-outline-text' },
  'selection.outlineStroke': { contextTestId: 'context-outline-stroke' },
  'selection.moveToPage': {},
  'view.zoom100': { keybinding: '$mod+Digit0' },
  'view.zoomFit': { keybinding: ['$mod+Digit1', 'Shift+Digit1'] },
  'view.zoomSelection': { keybinding: ['$mod+Digit2', 'Shift+Digit2'] }
} satisfies Record<EditorCommandId, EditorCommandMetadata>

export function editorCommandMetadata(id: EditorCommandId): EditorCommandMetadata {
  return EDITOR_COMMAND_METADATA[id]
}
