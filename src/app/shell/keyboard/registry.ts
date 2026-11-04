import { useEventListener } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { createKeybindingsHandler } from 'tinykeys'
import type { KeyBindingMap } from 'tinykeys'

import { BOARD_TOOL_SHORTCUTS, resolveEditorProfile } from '@open-pencil/core'
import { isCanvasTextInput } from '@open-pencil/vue/canvas/text-edit'
import { editorCommandMetadata, type EditorCommandId } from '@open-pencil/vue/editor/commands'

import { isCloudBinding, openVersionDialog } from '@/app/cloud/integration'
import { useComments } from '@/app/comments/use'
import {
  copySelectionProperties,
  pasteClipboardProperties
} from '@/app/editor/clipboard/properties'
import { requestRenameSelection } from '@/app/editor/selection/rename-dialog'
import { TOOL_SHORTCUTS } from '@/app/editor/session'
import { openSettingsDialog } from '@/app/settings/dialog'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { isButtonActivation, isEditing } from '@/app/shell/keyboard/focus'
import { shortcutEvent } from '@/app/shell/keyboard/layout'
import { bindSpaceHandTool } from '@/app/shell/keyboard/space-tool'
import type {
  KeyboardShortcutOptions,
  KeyboardShortcutRunOptions
} from '@/app/shell/keyboard/types'
import { appMenuTinykeysShortcut } from '@/app/shell/menu/shortcut'
import { showsDocument } from '@/app/tabs'

type ShortcutAction = (options: KeyboardShortcutRunOptions) => void

type ShortcutDefinition = {
  id: string
  keys: string | string[]
  run: ShortcutAction
  shouldPreventDefault?: (event: KeyboardEvent) => boolean
  global?: boolean
  /** Whether the shortcut switches or leaves the canvas's view, so it runs in every view. */
  view?: boolean
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

function zoomAtViewportCenter(delta: number): ShortcutAction {
  return ({ store }) => {
    const center = store.viewportCanvasCenter()
    store.applyZoom(delta, center.x, center.y)
  }
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

/**
 * Tab steps through sibling layers only while nothing on the page holds focus, so it still
 * moves focus through the panels' controls.
 */
function isCanvasFocus(event: KeyboardEvent) {
  return event.target === document.body || event.target instanceof HTMLCanvasElement
}

function siblingShortcut(
  command: 'selection.selectNextSibling' | 'selection.selectPreviousSibling'
): ShortcutDefinition {
  return {
    id: command,
    keys: editorCommandMetadata(command).keybinding ?? [],
    run: ({ keyEvent, runCommand }) => {
      if (isCanvasFocus(keyEvent)) runCommand(command)
    },
    shouldPreventDefault: isCanvasFocus
  }
}

const EDITOR_SHORTCUT_OVERLAY_SELECTOR =
  '[data-picker-content], [role="dialog"], [role="listbox"], [role="menu"]'
const PICKER_SELECTOR = '[data-picker-content]'
const OPEN_LAYER_SELECTOR = '[data-dismissable-layer]:not([data-state="closed"])'

function originatedInOverlay(event: KeyboardEvent, allowPickers = false) {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target.matches(EDITOR_SHORTCUT_OVERLAY_SELECTOR) &&
        !(allowPickers && target.closest(PICKER_SELECTOR))
    )
}

/** A popover, menu, or dialog that is open; one fading out after closing no longer counts. */
function hasOpenDismissableLayer(allowPickers = false) {
  return [...document.querySelectorAll(OPEN_LAYER_SELECTOR)].some(
    (layer) => !(allowPickers && layer.closest(PICKER_SELECTOR))
  )
}

/**
 * While text is edited its input handles the keys, undo and redo among them. Focus can leave it
 * for a panel field while the edit stays open, as after a typed font size; undo and redo then
 * run on the editor's history, which records the text edit's steps, rather than go nowhere.
 */
function editingTextHandles(options: KeyboardShortcutOptions, history: boolean) {
  if (!options.store.state.editingTextId) return false
  return !history || isCanvasTextInput(document.activeElement)
}

/**
 * Other shortcuts wait for open popovers to close, but undo and redo work while a fill, stroke,
 * or colour picker is open, as in Figma; a text field in it keeps its own undo.
 */
function shouldIgnoreShortcut(
  event: KeyboardEvent,
  options: KeyboardShortcutOptions,
  history = false
) {
  return (
    isButtonActivation(event) ||
    hasOpenDismissableLayer(history) ||
    originatedInOverlay(event, history) ||
    isEditing(event) ||
    options.inputFocused.value ||
    editingTextHandles(options, history) ||
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

/**
 * Binds every key a design or a board picks a tool with; which tool a key picks, if any, comes
 * from the editor profile's key map when it is pressed.
 */
function bindToolShortcuts(bindings: KeyBindingMap, options: KeyboardShortcutRunOptions) {
  const codes = uniq([...Object.keys(TOOL_SHORTCUTS), ...Object.keys(BOARD_TOOL_SHORTCUTS)])
  for (const code of codes) {
    bindings[code] = (event: KeyboardEvent) => {
      const tool = resolveEditorProfile(options.store.state).toolKeys[code]
      if (!tool) return
      event.preventDefault()
      options.spaceTool.resetToolBeforeSpace()
      // FigJam's R always arms a square; the toolbar's shapes keep the kind picked last.
      if (tool === 'SHAPE_WITH_TEXT') options.store.setShapeWithTextKind('SQUARE')
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
      'selection.flipVertical',
      'selection.tidyUp',
      'selection.distributeHorizontal',
      'selection.distributeVertical'
    ),
    {
      id: 'copy-properties',
      keys: '$mod+Alt+KeyC',
      run: ({ store }) => void copySelectionProperties(store)
    },
    {
      id: 'paste-properties',
      keys: '$mod+Alt+KeyV',
      run: ({ store }) => void pasteClipboardProperties(store)
    },
    {
      id: 'export-selection-png',
      keys: appMenuTinykeysShortcut('export-selection') ?? '$mod+Shift+KeyE',
      run: ({ actions }) => actions.exportSelectionPNG()
    },
    {
      id: 'save-as',
      keys: appMenuTinykeysShortcut('save-as') ?? '$mod+Shift+KeyS',
      run: ({ store }) => {
        if (showsDocument()) void store.saveFigFileAs()
      }
    },
    {
      id: 'save-version',
      keys: appMenuTinykeysShortcut('save-version') ?? '$mod+Alt+KeyS',
      run: ({ store }) => {
        if (isCloudBinding(store.getStorageBinding())) openVersionDialog(store)
      }
    },
    ...commandShortcuts('selection.ungroup', 'edit.redo'),
    {
      id: 'toggle-preview',
      keys: appMenuTinykeysShortcut('toggle-preview') ?? '$mod+Alt+Enter',
      run: ({ actions }) => actions.togglePlay(),
      view: true
    },
    {
      id: 'toggle-rulers',
      keys: 'Shift+KeyR',
      run: ({ store }) => {
        store.state.showRulers = !store.state.showRulers
        store.requestRepaint()
      }
    },
    {
      id: 'toggle-multiplayer-cursors',
      keys: '$mod+Alt+Backslash',
      run: ({ store }) => {
        store.state.showRemoteCursors = !store.state.showRemoteCursors
        store.requestRepaint()
      }
    },
    // Figma's keys, matched by key position since Shift turns ' into ".
    {
      id: 'toggle-pixel-grid',
      keys: 'Shift+Quote',
      run: ({ store }) => {
        store.state.showPixelGrid = store.state.showPixelGrid === false
        store.requestRepaint()
      }
    },
    {
      id: 'toggle-pixel-grid-snap',
      keys: '$mod+Shift+Quote',
      run: ({ store }) =>
        setSnappingPreference('pixelGrid', !store.state.snappingPreferences.pixelGrid)
    },
    {
      id: 'toggle-ui',
      keys: appMenuTinykeysShortcut('toggle-ui') ?? '$mod+Backslash',
      run: ({ actions }) => actions.toggleUI()
    },
    { id: 'toggle-ai', keys: '$mod+KeyJ', run: ({ actions }) => actions.toggleAI() },
    {
      id: 'toggle-comments',
      keys: appMenuTinykeysShortcut('view-comments') ?? 'Shift+KeyC',
      run: () => useComments().toggleOnCanvas()
    },
    {
      id: 'open-settings',
      keys: appMenuTinykeysShortcut('settings') ?? '$mod+Comma',
      run: () => openSettingsDialog(),
      global: true
    },
    {
      id: 'zoom-in',
      keys: [appMenuTinykeysShortcut('zoom-in') ?? '$mod+Equal', '$mod+Shift+Equal'],
      run: zoomAtViewportCenter(-100),
      global: true
    },
    {
      id: 'zoom-out',
      keys: appMenuTinykeysShortcut('zoom-out') ?? '$mod+Minus',
      run: zoomAtViewportCenter(100),
      global: true
    },
    {
      id: 'zoom-in-unmodified',
      keys: 'Shift+Equal',
      run: zoomAtViewportCenter(-100)
    },
    {
      id: 'zoom-out-unmodified',
      keys: 'Minus',
      run: zoomAtViewportCenter(100)
    },
    {
      id: 'close-tab',
      keys: appMenuTinykeysShortcut('close') ?? '$mod+KeyW',
      run: ({ closeActiveTab }) => closeActiveTab()
    },
    {
      id: 'new-design',
      keys: appMenuTinykeysShortcut('new') ?? '$mod+KeyN',
      run: ({ createTab }) => createTab()
    },
    {
      id: 'new-tab',
      keys: appMenuTinykeysShortcut('new-tab') ?? '$mod+KeyT',
      run: ({ openNewFileTab }) => openNewFileTab()
    },
    {
      id: 'next-tab',
      keys: 'Control+Tab',
      run: ({ switchAdjacentTab }) => switchAdjacentTab(1),
      global: true
    },
    {
      id: 'previous-tab',
      keys: 'Control+Shift+Tab',
      run: ({ switchAdjacentTab }) => switchAdjacentTab(-1),
      global: true
    },
    {
      id: 'rename-selection',
      keys: appMenuTinykeysShortcut('selection.rename') ?? '$mod+KeyR',
      run: ({ store }) => requestRenameSelection(store)
    },
    ...commandShortcuts(
      'edit.undo',
      'view.zoom100',
      'view.zoomFit',
      'view.zoomSelection',
      'view.zoomNextFrame',
      'view.zoomPreviousFrame',
      'view.nextPage',
      'view.previousPage',
      'selection.selectParent',
      'selection.duplicate',
      'selection.selectAll',
      'selection.selectInverse'
    ),
    {
      id: 'save',
      keys: appMenuTinykeysShortcut('save') ?? '$mod+KeyS',
      run: ({ store }) => {
        if (showsDocument()) void store.saveFigFile()
      }
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
    { id: 'delete-backspace', keys: 'Backspace', run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete', keys: 'Delete', run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete-alt', keys: 'Alt+Delete', run: ({ actions }) => actions.smartDelete(true) },
    { id: 'enter', keys: 'Enter', run: ({ actions }) => actions.confirmOrEditSelection() },
    {
      id: 'escape',
      keys: 'Escape',
      run: ({ actions }) => actions.escapeOrDeselect(),
      view: true
    },
    siblingShortcut('selection.selectNextSibling'),
    siblingShortcut('selection.selectPreviousSibling'),
    ...opacityBindings()
  ]

  const bindings: KeyBindingMap = {}
  const globalBindings: KeyBindingMap = {}
  /** Keys that switch or leave the canvas's view, which every view keeps. */
  const viewKeys = new Set(
    shortcuts.filter((shortcut) => shortcut.view).flatMap((shortcut) => [shortcut.keys].flat())
  )
  const historyKeys = new Set(
    shortcuts
      .filter((shortcut) => shortcut.id === 'edit.undo' || shortcut.id === 'edit.redo')
      .flatMap((shortcut) => [shortcut.keys].flat())
  )
  bindToolShortcuts(bindings, runOptions(new KeyboardEvent('keydown')))

  for (const shortcut of shortcuts) {
    bindShortcut(shortcut.global ? globalBindings : bindings, shortcut.keys, (event) => {
      shortcut.run(runOptions(event))
      if (shortcut.shouldPreventDefault?.(event) ?? true) event.preventDefault()
    })
  }

  const editorHandler = createKeybindingsHandler(
    Object.fromEntries(
      Object.entries(bindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (shouldIgnoreShortcut(event, options, historyKeys.has(keys))) return
          const { shortcuts: allowed } = resolveEditorProfile(options.store.state)
          if (allowed === 'view' && !viewKeys.has(keys)) return
          handler(event)
        }
      ])
    )
  )
  const globalHandler = createKeybindingsHandler(globalBindings)

  useEventListener(window, 'keydown', (event) => editorHandler(shortcutEvent(event)), {
    capture: true
  })
  useEventListener(window, 'keydown', (event) => globalHandler(shortcutEvent(event)), {
    capture: true
  })
}
