import { useEventListener } from '@vueuse/core'

import { TOOL_SHORTCUTS } from '@/app/editor/session'
import { isEditing } from '@/app/shell/keyboard/focus'
import { preventReservedKeyboardDefaults } from '@/app/shell/keyboard/reserved'
import { bindSpaceHandTool } from '@/app/shell/keyboard/space-tool'

import type {
  KeyboardShortcutOptions,
  KeyboardShortcutRunOptions
} from '@/app/shell/keyboard/types'

type ShortcutAction = (options: KeyboardShortcutRunOptions) => void

type ShortcutDefinition = {
  id: string
  matches: (event: KeyboardEvent) => boolean
  run: ShortcutAction
}

function isCommandModifier(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey
}

function mod(code: string, options: { shift?: boolean; alt?: boolean } = {}) {
  const shift = options.shift ?? false
  const alt = options.alt ?? false
  return (event: KeyboardEvent) =>
    isCommandModifier(event) &&
    event.code === code &&
    event.shiftKey === shift &&
    event.altKey === alt
}

function shift(code: string) {
  return (event: KeyboardEvent) =>
    event.code === code &&
    event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
}

function plain(code: string, options: { allowAlt?: boolean } = {}) {
  const allowAlt = options.allowAlt ?? false
  return (event: KeyboardEvent) =>
    event.code === code &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (allowAlt || !event.altKey)
}

function commandShortcut(
  id: string,
  matches: (event: KeyboardEvent) => boolean,
  command: Parameters<KeyboardShortcutOptions['runCommand']>[0]
): ShortcutDefinition {
  return { id, matches, run: ({ runCommand }) => runCommand(command) }
}

function runToolShortcut(event: KeyboardEvent, options: KeyboardShortcutRunOptions) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  const tool = TOOL_SHORTCUTS[event.code]
  if (!tool) return false
  options.spaceTool.resetToolBeforeSpace()
  options.store.setTool(tool)
  event.preventDefault()
  return true
}

export function registerKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const { inputFocused, store } = options
  const spaceTool = bindSpaceHandTool(inputFocused, store)

  const shortcuts: ShortcutDefinition[] = [
    commandShortcut('create-component', mod('KeyK', { alt: true }), 'selection.createComponent'),
    commandShortcut('detach-instance', mod('KeyB', { alt: true }), 'selection.detachInstance'),
    commandShortcut('create-component-set', mod('KeyK', { shift: true }), 'selection.createComponentSet'),
    commandShortcut('toggle-visibility', mod('KeyH', { shift: true }), 'selection.toggleVisibility'),
    commandShortcut('toggle-lock', mod('KeyL', { shift: true }), 'selection.toggleLock'),
    { id: 'export-selection-png', matches: mod('KeyE', { shift: true }), run: ({ actions }) => actions.exportSelectionPng() },
    { id: 'save-as', matches: mod('KeyS', { shift: true }), run: ({ store }) => void store.saveFigFileAs() },
    commandShortcut('ungroup', mod('KeyG', { shift: true }), 'selection.ungroup'),
    commandShortcut('redo-shift', mod('KeyZ', { shift: true }), 'edit.redo'),
    { id: 'toggle-ui', matches: mod('Backslash'), run: ({ actions }) => actions.toggleUI() },
    { id: 'toggle-ai', matches: mod('KeyJ'), run: ({ actions }) => actions.toggleAI() },
    { id: 'close-tab', matches: mod('KeyW'), run: ({ closeActiveTab }) => closeActiveTab() },
    { id: 'new-tab', matches: mod('KeyN'), run: ({ createTab }) => createTab() },
    { id: 'new-tab-alt', matches: mod('KeyT'), run: ({ createTab }) => createTab() },
    commandShortcut('undo', mod('KeyZ'), 'edit.undo'),
    commandShortcut('redo', mod('KeyY'), 'edit.redo'),
    commandShortcut('zoom-100', mod('Digit0'), 'view.zoom100'),
    commandShortcut('zoom-fit', mod('Digit1'), 'view.zoomFit'),
    commandShortcut('zoom-selection', mod('Digit2'), 'view.zoomSelection'),
    commandShortcut('duplicate', mod('KeyD'), 'selection.duplicate'),
    commandShortcut('select-all', mod('KeyA'), 'selection.selectAll'),
    { id: 'save', matches: mod('KeyS'), run: ({ store }) => void store.saveFigFile() },
    { id: 'open-file', matches: mod('KeyO'), run: ({ openFileDialog }) => openFileDialog() },
    commandShortcut('group', mod('KeyG'), 'selection.group'),
    commandShortcut('zoom-fit-shift', shift('Digit1'), 'view.zoomFit'),
    commandShortcut('zoom-selection-shift', shift('Digit2'), 'view.zoomSelection'),
    { id: 'toggle-auto-layout', matches: shift('KeyA'), run: ({ actions }) => actions.toggleAutoLayout() },
    commandShortcut('bring-to-front', plain('BracketRight'), 'selection.bringToFront'),
    commandShortcut('send-to-back', plain('BracketLeft'), 'selection.sendToBack'),
    { id: 'delete-backspace', matches: plain('Backspace'), run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete', matches: plain('Delete', { allowAlt: true }), run: ({ actions, keyEvent }) => actions.smartDelete(keyEvent.altKey) },
    { id: 'enter', matches: plain('Enter'), run: ({ actions }) => actions.confirmOrEnterText() },
    { id: 'escape', matches: plain('Escape'), run: ({ actions }) => actions.escapeOrDeselect() }
  ]

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (isEditing(event) || inputFocused.value || store.state.editingTextId) return
    if (store.state.scrubInputFocused) return

    preventReservedKeyboardDefaults(event)

    const runOptions = { ...options, keyEvent: event, spaceTool }
    if (runToolShortcut(event, runOptions)) return

    for (const shortcut of shortcuts) {
      if (!shortcut.matches(event)) continue
      shortcut.run(runOptions)
      event.preventDefault()
      return
    }
  })
}
