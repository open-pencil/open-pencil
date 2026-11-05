import { useActiveElement, useEventListener } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { createKeybindingsHandler, type KeyBindingMap } from 'tinykeys'
import { computed } from 'vue'

import { BOARD_TOOL_SHORTCUTS, resolveEditorProfile, TOOL_SHORTCUTS } from '@open-pencil/core'

import { isCanvasTextInput } from '#vue/canvas/text-edit'
import {
  editorCommandMetadata,
  useEditorCommands,
  type EditorCommandId
} from '#vue/editor/commands'
import { useEditor } from '#vue/editor/context'
import { useOpenOverlays } from '#vue/lifecycle/overlays'

import { createEditorKeyActions } from './actions'
import { isButtonActivation, isEditing, isInputElement } from './focus'
import { shortcutEvent } from './layout'
import { bindNudgeKeys } from './nudge'
import { overlayHoldsKeys } from './overlays'
import { bindSpaceHandTool } from './space-hand'

/** A key binding: the tinykeys keys it answers to and what it runs. */
export interface EditorShortcut {
  id: string
  keys: string | string[]
  run: (event: KeyboardEvent) => void
  /** Whether the browser's own action for the key is stopped; by default always. */
  preventDefault?: (event: KeyboardEvent) => boolean
  /** Runs wherever focus is, in a text field or with a dialog open, as app-wide keys do. */
  global?: boolean
  /** Switches or leaves the canvas's view, so it runs in every view, a preview's included. */
  view?: boolean
  /** Undo or redo, which run while a picker is open and text is not being typed. */
  history?: boolean
}

export interface EditorKeyboardOptions {
  /** The host's own keys: saving, tabs, panels. They follow the same focus rules as the editor's. */
  shortcuts?: readonly EditorShortcut[]
  /**
   * The host's own Escape, run before the editor's selection steps: return true when it handled
   * the key, as closing a comment card does.
   */
  onEscape?: () => boolean
  /** More reasons to hold the editor's keys back, as a focused value field of the host's. */
  ignore?: (event: KeyboardEvent) => boolean
}

const UNDO_REDO = new Set<EditorCommandId>(['edit.undo', 'edit.redo'])

/** The editor commands a key runs directly, by their registered keybinding. */
const KEY_COMMANDS: readonly EditorCommandId[] = [
  'edit.undo',
  'edit.redo',
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
  'selection.distributeVertical',
  'selection.ungroup',
  'selection.group',
  'selection.bringForward',
  'selection.bringToFront',
  'selection.sendBackward',
  'selection.sendToBack',
  'selection.selectParent',
  'selection.duplicate',
  'selection.selectAll',
  'selection.selectInverse',
  'view.zoom100',
  'view.zoomFit',
  'view.zoomSelection',
  'view.zoomNextFrame',
  'view.zoomPreviousFrame',
  'view.nextPage',
  'view.previousPage'
]

/**
 * Tab steps through sibling layers only while nothing on the page holds focus, so it still
 * moves focus through the panels' controls.
 */
function isCanvasFocus(event: KeyboardEvent) {
  return event.target === document.body || event.target instanceof HTMLCanvasElement
}

/**
 * Binds the editor's keyboard as OpenPencil binds it: the commands' keybindings, the profile's
 * tool keys, a held Space for the hand, arrow nudges, Delete, Enter, Escape, opacity digits, and
 * zoom, with the host's own `shortcuts` beside them. Keys wait while a text field, an open
 * dialog or menu, or text being edited has them, and a preview keeps only the keys that leave
 * it. Undo and redo stop the browser's own. Call it inside a component under `provideEditor`.
 */
export function useEditorKeyboard(options: EditorKeyboardOptions = {}) {
  const editor = useEditor()
  const { runCommand, setOpacityTarget } = useEditorCommands()
  const overlays = useOpenOverlays()
  const activeElement = useActiveElement({ triggerOnRemoval: true })
  const inputFocused = computed(() => isInputElement(activeElement.value))
  const actions = createEditorKeyActions({
    editor,
    runCommand,
    setOpacityTarget,
    onEscape: options.onEscape
  })
  const spaceTool = bindSpaceHandTool(inputFocused, editor)
  bindNudgeKeys(editor, overlays)

  const zoomAtViewportCenter = (delta: number) => () => {
    const { width, height } = editor.getViewportSize()
    editor.applyZoom(delta, width / 2, height / 2)
  }
  const command = (id: EditorCommandId): EditorShortcut[] => {
    const keys = editorCommandMetadata(id).keybinding
    return keys ? [{ id, keys, run: () => runCommand(id), history: UNDO_REDO.has(id) }] : []
  }
  const sibling = (
    id: 'selection.selectNextSibling' | 'selection.selectPreviousSibling'
  ): EditorShortcut => ({
    id,
    keys: editorCommandMetadata(id).keybinding ?? [],
    run: (event) => {
      if (isCanvasFocus(event)) runCommand(id)
    },
    preventDefault: isCanvasFocus
  })
  const bare = (event: KeyboardEvent) =>
    !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey

  const shortcuts: EditorShortcut[] = [
    ...KEY_COMMANDS.flatMap(command),
    {
      id: 'zoom-in',
      keys: ['$mod+Equal', '$mod+Shift+Equal'],
      run: zoomAtViewportCenter(-100),
      global: true
    },
    { id: 'zoom-out', keys: '$mod+Minus', run: zoomAtViewportCenter(100), global: true },
    { id: 'zoom-in-unmodified', keys: 'Shift+Equal', run: zoomAtViewportCenter(-100) },
    { id: 'zoom-out-unmodified', keys: 'Minus', run: zoomAtViewportCenter(100) },
    { id: 'toggle-auto-layout', keys: 'Shift+KeyA', run: () => actions.toggleAutoLayout() },
    // Figma's key, matched by key position since Shift turns ' into ".
    {
      id: 'toggle-pixel-grid',
      keys: 'Shift+Quote',
      run: () => {
        editor.state.showPixelGrid = editor.state.showPixelGrid === false
        editor.requestRepaint()
      }
    },
    { id: 'delete-backspace', keys: 'Backspace', run: () => actions.smartDelete(false) },
    { id: 'delete', keys: 'Delete', run: () => actions.smartDelete(false) },
    { id: 'delete-alt', keys: 'Alt+Delete', run: () => actions.smartDelete(true) },
    { id: 'enter', keys: 'Enter', run: () => actions.confirmOrEditSelection() },
    { id: 'escape', keys: 'Escape', run: () => actions.escapeOrDeselect(), view: true },
    sibling('selection.selectNextSibling'),
    sibling('selection.selectPreviousSibling'),
    ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit): EditorShortcut => ({
      id: `selection-opacity-${digit}`,
      keys: digit,
      run: (event) => {
        if (bare(event)) actions.opacityDigit(digit)
      },
      preventDefault: bare
    })),
    ...(options.shortcuts ?? [])
  ]

  /**
   * While text is edited its input handles the keys, undo and redo among them. Focus can leave it
   * for a panel field while the edit stays open, as after a typed font size; undo and redo then
   * run on the editor's history, which records the text edit's steps, rather than go nowhere.
   */
  function editingTextHandles(history: boolean) {
    if (!editor.state.editingTextId) return false
    return !history || isCanvasTextInput(document.activeElement)
  }

  /**
   * Other shortcuts wait for open popovers to close, but undo and redo work while a fill, stroke,
   * or colour picker is open, as in Figma; a text field in it keeps its own undo.
   */
  function heldBack(event: KeyboardEvent, history: boolean) {
    return (
      isButtonActivation(event) ||
      overlayHoldsKeys(event, overlays, history) ||
      isEditing(event) ||
      inputFocused.value ||
      editingTextHandles(history) ||
      !!options.ignore?.(event)
    )
  }

  const bindings: KeyBindingMap = {}
  const globalBindings: KeyBindingMap = {}
  const viewKeys = new Set<string>()
  const historyKeys = new Set<string>()

  // Every key a design or a board picks a tool with; which tool it picks, if any, comes from the
  // editor profile's key map when it is pressed, so a host's tool restrictions hold.
  for (const code of uniq([...Object.keys(TOOL_SHORTCUTS), ...Object.keys(BOARD_TOOL_SHORTCUTS)])) {
    bindings[code] = (event: KeyboardEvent) => {
      const tool = resolveEditorProfile(editor.state).toolKeys[code]
      if (!tool) return
      event.preventDefault()
      spaceTool.resetToolBeforeSpace()
      // FigJam's R always arms a square; the toolbar's shapes keep the kind picked last.
      if (tool === 'SHAPE_WITH_TEXT') editor.setShapeWithTextKind('SQUARE')
      editor.setTool(tool)
    }
  }

  for (const shortcut of shortcuts) {
    const keys = [shortcut.keys].flat()
    if (shortcut.view) for (const key of keys) viewKeys.add(key)
    if (shortcut.history) for (const key of keys) historyKeys.add(key)
    for (const key of keys) {
      ;(shortcut.global ? globalBindings : bindings)[key] = (event: KeyboardEvent) => {
        shortcut.run(event)
        if (shortcut.preventDefault?.(event) ?? true) event.preventDefault()
      }
    }
  }

  const editorHandler = createKeybindingsHandler(
    Object.fromEntries(
      Object.entries(bindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (heldBack(event, historyKeys.has(keys))) return
          const { shortcuts: allowed } = resolveEditorProfile(editor.state)
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

  return { actions }
}
