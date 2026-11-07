import { detectPlatform, type HotkeyChord, type HotkeyPlatform } from '@tanstack/hotkeys'

import type { EditorCommandId } from './types'

/** A shortcut Figma gives a different key on macOS than on Windows and Linux. */
export interface PlatformShortcut {
  mac: HotkeyChord
  other: HotkeyChord
}

export interface EditorCommandMetadata {
  /** The command's shortcut on this platform (`formatShortcut`), shown in menus and bound. */
  shortcut?: HotkeyChord
  /** More shortcuts that run the command, never shown. */
  aliases?: HotkeyChord[]
  contextTestId?: string
}

interface EditorCommandEntry extends Omit<EditorCommandMetadata, 'shortcut'> {
  shortcut?: HotkeyChord | PlatformShortcut
}

export const EDITOR_COMMAND_METADATA = {
  'edit.undo': { shortcut: 'Mod+Z' },
  'edit.redo': { shortcut: 'Mod+Shift+Z', aliases: ['Mod+Y'] },
  'selection.selectAll': { shortcut: 'Mod+A' },
  'selection.selectInverse': { shortcut: 'Mod+Shift+A' },
  // Enter also opens a vector's path or a text layer, so the app binds it with that.
  'selection.selectChildren': { shortcut: 'Enter' },
  'selection.selectParent': {
    shortcut: 'Shift+Enter',
    aliases: ['\\']
  },
  'selection.selectNextSibling': { shortcut: 'Tab' },
  'selection.selectPreviousSibling': { shortcut: 'Shift+Tab' },
  'selection.duplicate': {
    shortcut: 'Mod+D',
    contextTestId: 'context-duplicate'
  },
  'selection.delete': { shortcut: 'Backspace', contextTestId: 'context-delete' },
  'selection.group': { shortcut: 'Mod+G', contextTestId: 'context-group' },
  'selection.frameSelection': {
    shortcut: 'Mod+Alt+G',
    contextTestId: 'context-frame-selection'
  },
  'selection.wrapInSection': {},
  'selection.ungroup': { shortcut: 'Mod+Shift+G' },
  'selection.createComponent': {
    shortcut: 'Mod+Alt+K',
    contextTestId: 'context-create-component'
  },
  'selection.createComponentSet': { shortcut: 'Mod+Shift+K' },
  'selection.detachInstance': { shortcut: 'Mod+Alt+B' },
  'selection.detachIcon': {},
  'selection.goToMainComponent': {},
  'selection.createInstance': {},
  'selection.createSlot': { contextTestId: 'context-create-slot' },
  'selection.wrapInAutoLayout': { shortcut: 'Shift+A' },
  'selection.toggleMask': {
    shortcut: 'Mod+Alt+M',
    aliases: ['Control+Meta+M'],
    contextTestId: 'context-toggle-mask'
  },
  'selection.bringForward': {
    shortcut: 'Mod+]',
    contextTestId: 'context-bring-forward'
  },
  'selection.bringToFront': {
    shortcut: ']',
    contextTestId: 'context-bring-to-front'
  },
  'selection.sendBackward': {
    shortcut: 'Mod+[',
    contextTestId: 'context-send-backward'
  },
  'selection.sendToBack': {
    shortcut: '[',
    contextTestId: 'context-send-to-back'
  },
  'selection.toggleVisibility': {
    shortcut: 'Mod+Shift+H',
    contextTestId: 'context-toggle-visibility'
  },
  'selection.toggleLock': {
    shortcut: 'Mod+Shift+L',
    contextTestId: 'context-toggle-lock'
  },
  'selection.flipHorizontal': {
    shortcut: 'Shift+H',
    contextTestId: 'context-flip-horizontal'
  },
  'selection.flipVertical': {
    shortcut: 'Shift+V',
    contextTestId: 'context-flip-vertical'
  },
  // Figma's keys; elsewhere Ctrl+Alt+V pastes properties.
  'selection.distributeHorizontal': {
    shortcut: { mac: 'Control+Alt+H', other: 'Alt+Shift+H' }
  },
  'selection.distributeVertical': {
    shortcut: { mac: 'Control+Alt+V', other: 'Alt+Shift+V' }
  },
  'selection.tidyUp': { shortcut: { mac: 'Control+Alt+T', other: 'Control+Alt+Shift+T' } },
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
    shortcut: 'Alt+Shift+U',
    contextTestId: 'context-boolean-union'
  },
  'selection.booleanSubtract': {
    shortcut: 'Alt+Shift+S',
    contextTestId: 'context-boolean-subtract'
  },
  'selection.booleanIntersect': {
    shortcut: 'Alt+Shift+I',
    contextTestId: 'context-boolean-intersect'
  },
  'selection.booleanExclude': {
    shortcut: 'Alt+Shift+E',
    contextTestId: 'context-boolean-exclude'
  },
  'selection.flatten': {
    shortcut: 'Alt+Shift+F',
    contextTestId: 'context-flatten'
  },
  'selection.outlineText': { contextTestId: 'context-outline-text' },
  'selection.outlineStroke': { contextTestId: 'context-outline-stroke' },
  'selection.moveToPage': {},
  'selection.setOpacity': {},
  'view.zoom100': { shortcut: 'Mod+0', aliases: ['Shift+0'] },
  'view.zoomFit': { shortcut: 'Shift+1', aliases: ['Mod+1'] },
  'view.zoomSelection': { shortcut: 'Shift+2', aliases: ['Mod+2'] },
  'view.zoomNextFrame': { shortcut: 'N' },
  'view.zoomPreviousFrame': { shortcut: 'Shift+N' },
  'view.nextPage': { shortcut: 'PageDown' },
  'view.previousPage': { shortcut: 'PageUp' }
} satisfies Record<EditorCommandId, EditorCommandEntry>

/** A command's metadata, its shortcut picked for `platform`. */
export function editorCommandMetadata(
  id: EditorCommandId,
  platform: HotkeyPlatform = detectPlatform()
): EditorCommandMetadata {
  const entry: EditorCommandEntry = EDITOR_COMMAND_METADATA[id]
  const { shortcut } = entry
  if (shortcut === undefined || typeof shortcut === 'string') return { ...entry, shortcut }
  return { ...entry, shortcut: platform === 'mac' ? shortcut.mac : shortcut.other }
}

/** Every shortcut a command's key answers to on `platform`: its shortcut, then its aliases. */
export function editorCommandShortcuts(
  id: EditorCommandId,
  platform: HotkeyPlatform = detectPlatform()
): HotkeyChord[] {
  const { shortcut, aliases = [] } = editorCommandMetadata(id, platform)
  return shortcut ? [shortcut, ...aliases] : aliases
}
