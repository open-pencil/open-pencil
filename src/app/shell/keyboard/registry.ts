import { tinykeys } from 'tinykeys'
import type { KeyBindingMap } from 'tinykeys'
import { onScopeDispose } from 'vue'

import { editorCommandMetadata } from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { requestRenameSelection } from '@/app/editor/selection/rename-dialog'
import { TOOL_SHORTCUTS } from '@/app/editor/session'
import { isEditing } from '@/app/shell/keyboard/focus'
import { bindSpaceHandTool } from '@/app/shell/keyboard/space-tool'
import type {
  KeyboardShortcutOptions,
  KeyboardShortcutRunOptions
} from '@/app/shell/keyboard/types'
import { appMenuTinykeysShortcut } from '@/app/shell/menu/shortcut'

type ShortcutAction = (options: KeyboardShortcutRunOptions) => void

type ShortcutDefinition = {
  id: string
  keys: string | string[]
  run: ShortcutAction
  shouldPreventDefault?: (event: KeyboardEvent) => boolean
  /** When true, only fires while presenting and bypasses the edit-shortcut ignore guard. */
  presentation?: boolean
}

function commandShortcut(
  command: EditorCommandId,
  keys = editorCommandMetadata(command).keybinding
): ShortcutDefinition | null {
  return keys ? { id: command, keys, run: ({ runCommand }) => runCommand(command) } : null
}

function commandShortcuts(...commands: EditorCommandId[]): ShortcutDefinition[] {
  return commands.flatMap((command) => {
    const shortcut = commandShortcut(command)
    return shortcut ? [shortcut] : []
  })
}

function opacityBindings(): ShortcutDefinition[] {
  return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => ({
    id: `selection-opacity-${digit}`,
    keys: digit,
    run: ({ keyEvent, actions }) => {
      if (keyEvent.metaKey || keyEvent.ctrlKey || keyEvent.altKey || keyEvent.shiftKey) return
      actions.opacityDigit(digit)
    },
    shouldPreventDefault: (event) =>
      !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
  }))
}

const EDITOR_SHORTCUT_OVERLAY_SELECTOR =
  '[data-picker-content], [role="dialog"], [role="listbox"], [role="menu"]'

function originatedInOverlay(event: KeyboardEvent) {
  return event
    .composedPath()
    .some((target) => target instanceof Element && target.matches(EDITOR_SHORTCUT_OVERLAY_SELECTOR))
}

function hasOpenDismissableLayer() {
  return document.querySelector('[data-dismissable-layer]') !== null
}

function shouldIgnoreShortcut(event: KeyboardEvent, options: KeyboardShortcutOptions) {
  return (
    // Presentation owns the keyboard; editing shortcuts stand down entirely.
    options.store.state.presenting ||
    hasOpenDismissableLayer() ||
    originatedInOverlay(event) ||
    isEditing(event) ||
    options.inputFocused.value ||
    !!options.store.state.editingTextId ||
    !!options.store.state.numberFieldFocused
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
    ...commandShortcuts(
      'selection.createComponent',
      'selection.detachInstance',
      'selection.createComponentSet',
      'selection.toggleMask',
      'selection.toggleVisibility',
      'selection.toggleLock',
      'selection.flipHorizontal',
      'selection.flipVertical'
    ),
    {
      id: 'export-selection-png',
      keys: appMenuTinykeysShortcut('export-selection') ?? '$mod+Shift+KeyE',
      run: ({ actions }) => actions.exportSelectionPng()
    },
    {
      id: 'save-as',
      keys: appMenuTinykeysShortcut('save-as') ?? '$mod+Shift+KeyS',
      run: ({ store }) => void store.saveFigFileAs()
    },
    ...commandShortcuts('selection.ungroup', 'edit.redo'),
    {
      id: 'toggle-ui',
      keys: appMenuTinykeysShortcut('toggle-ui') ?? '$mod+Backslash',
      run: ({ actions }) => actions.toggleUI()
    },
    { id: 'toggle-ai', keys: '$mod+KeyJ', run: ({ actions }) => actions.toggleAI() },
    {
      id: 'close-tab',
      keys: appMenuTinykeysShortcut('close') ?? '$mod+KeyW',
      run: ({ closeActiveTab }) => closeActiveTab()
    },
    { id: 'new-tab', keys: ['$mod+KeyN', '$mod+KeyT'], run: ({ createTab }) => createTab() },
    {
      id: 'rename-selection',
      keys: appMenuTinykeysShortcut('selection.rename') ?? '$mod+KeyR',
      run: ({ store }) => requestRenameSelection(store)
    },
    {
      id: 'new-deck',
      keys: appMenuTinykeysShortcut('new-deck') ?? '$mod+Shift+KeyN',
      run: ({ createDeckTab }) => createDeckTab()
    },
    ...commandShortcuts(
      'edit.undo',
      'view.zoom100',
      'view.zoomFit',
      'view.zoomSelection',
      'selection.duplicate',
      'selection.selectAll',
      'selection.selectInverse'
    ),
    {
      id: 'save',
      keys: appMenuTinykeysShortcut('save') ?? '$mod+KeyS',
      run: ({ store }) => void store.saveFigFile()
    },
    {
      id: 'open-file',
      keys: appMenuTinykeysShortcut('open') ?? '$mod+KeyO',
      run: ({ openFileDialog }) => openFileDialog()
    },
    ...commandShortcuts('selection.group'),
    {
      id: 'toggle-auto-layout',
      keys: 'Shift+KeyA',
      run: ({ actions }) => actions.toggleAutoLayout()
    },
    ...commandShortcuts(
      'selection.bringForward',
      'selection.bringToFront',
      'selection.sendBackward',
      'selection.sendToBack'
    ),
    {
      id: 'delete-backspace',
      keys: 'Backspace',
      // Backspace is shared: previous-slide while presenting, delete otherwise.
      run: ({ actions, store }) => {
        if (store.state.presenting) actions.presentPrevious()
        else actions.smartDelete(false)
      }
    },
    { id: 'delete', keys: 'Delete', run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete-alt', keys: 'Alt+Delete', run: ({ actions }) => actions.smartDelete(true) },
    { id: 'enter', keys: 'Enter', run: ({ actions }) => actions.confirmOrEnterText() },
    // Escape exits presentation first (see escapeOrDeselect); keep a single binding so
    // capture-phase registration order stays deterministic with no second listener.
    { id: 'escape', keys: 'Escape', run: ({ actions }) => actions.escapeOrDeselect() },
    ...opacityBindings(),
    // Presentation-only navigation — same tinykeys registry (capture:true) so they are
    // not beaten by earlier Escape/arrow listeners.
    {
      id: 'present-next',
      keys: ['ArrowRight', 'ArrowDown', 'Space', 'PageDown'],
      run: ({ actions }) => actions.presentNext(),
      presentation: true
    },
    {
      id: 'present-previous',
      keys: ['ArrowLeft', 'ArrowUp', 'PageUp'],
      run: ({ actions }) => actions.presentPrevious(),
      presentation: true
    },
    {
      id: 'present-first',
      keys: 'Home',
      run: ({ actions }) => actions.presentFirst(),
      presentation: true
    },
    {
      id: 'present-last',
      keys: 'End',
      run: ({ actions }) => actions.presentLast(),
      presentation: true
    },
    ...commandShortcuts('view.present', 'view.presentWithNotes')
  ]

  const bindings: KeyBindingMap = {}
  const presentationBindings: KeyBindingMap = {}
  bindToolShortcuts(bindings, runOptions(new KeyboardEvent('keydown')))

  for (const shortcut of shortcuts) {
    const target = shortcut.presentation ? presentationBindings : bindings
    bindShortcut(target, shortcut.keys, (event) => {
      shortcut.run(runOptions(event))
      if (shortcut.shouldPreventDefault?.(event) ?? true) event.preventDefault()
    })
  }

  // Escape / Backspace must still fire while presenting: shouldIgnoreShortcut includes
  // `presenting`, so those shared keys get an explicit bypass when the store is presenting.
  const PRESENTATION_SHARED_KEYS = new Set(['Escape', 'Backspace'])

  const unsubscribe = tinykeys(
    window,
    Object.fromEntries([
      ...Object.entries(bindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (options.store.state.presenting && PRESENTATION_SHARED_KEYS.has(keys)) {
            handler(event)
            return
          }
          if (shouldIgnoreShortcut(event, options)) return
          handler(event)
        }
      ]),
      ...Object.entries(presentationBindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (!options.store.state.presenting) return
          handler(event)
        }
      ])
    ]),
    { capture: true }
  )

  onScopeDispose(unsubscribe)
}
