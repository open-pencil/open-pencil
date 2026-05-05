import { tinykeys } from 'tinykeys'
import type { KeyBindingMap } from 'tinykeys'
import { onScopeDispose } from 'vue'

import { TOOL_SHORTCUTS } from '@/app/editor/session'
import { isEditing } from '@/app/shell/keyboard/focus'
import { bindSpaceHandTool } from '@/app/shell/keyboard/space-tool'
import type {
  KeyboardShortcutOptions,
  KeyboardShortcutRunOptions
} from '@/app/shell/keyboard/types'

type ShortcutAction = (options: KeyboardShortcutRunOptions) => void

type ShortcutDefinition = {
  id: string
  keys: string | string[]
  run: ShortcutAction
}

function commandShortcut(
  id: string,
  keys: string | string[],
  command: Parameters<KeyboardShortcutOptions['runCommand']>[0]
): ShortcutDefinition {
  return { id, keys, run: ({ runCommand }) => runCommand(command) }
}

function shouldIgnoreShortcut(event: KeyboardEvent, options: KeyboardShortcutOptions) {
  return (
    isEditing(event) ||
    options.inputFocused.value ||
    !!options.store.state.editingTextId ||
    !!options.store.state.scrubInputFocused
  )
}

function bindShortcut(
  bindings: KeyBindingMap,
  keys: string | string[],
  run: (event: KeyboardEvent) => void
) {
  for (const key of Array.isArray(keys) ? keys : [keys]) bindings[key] = run
}

function bindToolShortcuts(bindings: KeyBindingMap, options: KeyboardShortcutRunOptions) {
  for (const [code, tool] of Object.entries(TOOL_SHORTCUTS)) {
    if (!tool) continue
    bindings[code] = (event: KeyboardEvent) => {
      event.preventDefault()
      options.spaceTool.resetToolBeforeSpace()
      options.store.setTool(tool)
    }
  }
}

export function registerKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const spaceTool = bindSpaceHandTool(options.inputFocused, options.store)
  const runOptions = (event: KeyboardEvent): KeyboardShortcutRunOptions => ({
    ...options,
    keyEvent: event,
    spaceTool
  })

  const shortcuts: ShortcutDefinition[] = [
    commandShortcut('create-component', '$mod+Alt+KeyK', 'selection.createComponent'),
    commandShortcut('detach-instance', '$mod+Alt+KeyB', 'selection.detachInstance'),
    commandShortcut('create-component-set', '$mod+Shift+KeyK', 'selection.createComponentSet'),
    commandShortcut('toggle-visibility', '$mod+Shift+KeyH', 'selection.toggleVisibility'),
    commandShortcut('toggle-lock', '$mod+Shift+KeyL', 'selection.toggleLock'),
    {
      id: 'export-selection-png',
      keys: '$mod+Shift+KeyE',
      run: ({ actions }) => actions.exportSelectionPng()
    },
    { id: 'save-as', keys: '$mod+Shift+KeyS', run: ({ store }) => void store.saveFigFileAs() },
    commandShortcut('ungroup', '$mod+Shift+KeyG', 'selection.ungroup'),
    commandShortcut('redo-shift', '$mod+Shift+KeyZ', 'edit.redo'),
    { id: 'toggle-ui', keys: '$mod+Backslash', run: ({ actions }) => actions.toggleUI() },
    { id: 'toggle-ai', keys: '$mod+KeyJ', run: ({ actions }) => actions.toggleAI() },
    { id: 'close-tab', keys: '$mod+KeyW', run: ({ closeActiveTab }) => closeActiveTab() },
    { id: 'new-tab', keys: ['$mod+KeyN', '$mod+KeyT'], run: ({ createTab }) => createTab() },
    commandShortcut('undo', '$mod+KeyZ', 'edit.undo'),
    commandShortcut('redo', '$mod+KeyY', 'edit.redo'),
    commandShortcut('zoom-100', '$mod+Digit0', 'view.zoom100'),
    commandShortcut('zoom-fit', '$mod+Digit1', 'view.zoomFit'),
    commandShortcut('zoom-selection', '$mod+Digit2', 'view.zoomSelection'),
    commandShortcut('duplicate', '$mod+KeyD', 'selection.duplicate'),
    commandShortcut('select-all', '$mod+KeyA', 'selection.selectAll'),
    { id: 'save', keys: '$mod+KeyS', run: ({ store }) => void store.saveFigFile() },
    { id: 'open-file', keys: '$mod+KeyO', run: ({ openFileDialog }) => openFileDialog() },
    commandShortcut('group', '$mod+KeyG', 'selection.group'),
    commandShortcut('zoom-fit-shift', 'Shift+Digit1', 'view.zoomFit'),
    commandShortcut('zoom-selection-shift', 'Shift+Digit2', 'view.zoomSelection'),
    {
      id: 'toggle-auto-layout',
      keys: 'Shift+KeyA',
      run: ({ actions }) => actions.toggleAutoLayout()
    },
    commandShortcut('bring-to-front', 'BracketRight', 'selection.bringToFront'),
    commandShortcut('send-to-back', 'BracketLeft', 'selection.sendToBack'),
    { id: 'delete-backspace', keys: 'Backspace', run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete', keys: 'Delete', run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete-alt', keys: 'Alt+Delete', run: ({ actions }) => actions.smartDelete(true) },
    { id: 'enter', keys: 'Enter', run: ({ actions }) => actions.confirmOrEnterText() },
    { id: 'escape', keys: 'Escape', run: ({ actions }) => actions.escapeOrDeselect() }
  ]

  const bindings: KeyBindingMap = {}
  bindToolShortcuts(bindings, runOptions(new KeyboardEvent('keydown')))

  for (const shortcut of shortcuts) {
    bindShortcut(bindings, shortcut.keys, (event) => {
      event.preventDefault()
      shortcut.run(runOptions(event))
    })
  }

  const unsubscribe = tinykeys(
    window,
    Object.fromEntries(
      Object.entries(bindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (shouldIgnoreShortcut(event, options)) return
          handler(event)
        }
      ])
    )
  )

  onScopeDispose(unsubscribe)
}
