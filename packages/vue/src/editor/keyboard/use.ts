import { useActiveElement, useEventListener } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { createKeybindingsHandler, type KeyBindingMap } from 'tinykeys'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { BOARD_TOOL_SHORTCUTS, resolveEditorProfile, TOOL_SHORTCUTS } from '@open-pencil/core'

import { isCanvasTextInput } from '#vue/canvas/text-edit'
import { useEditorCommands } from '#vue/editor/commands'
import { useEditor } from '#vue/editor/context'
import { useOpenOverlays } from '#vue/lifecycle/overlays'

import { createEditorKeyActions } from './actions'
import { isButtonActivation, isEditing, isInputElement } from './focus'
import { shortcutEvent } from './layout'
import { bindNudgeKeys } from './nudge'
import { overlayHoldsKeys } from './overlays'
import { editorShortcuts, type EditorShortcut } from './shortcuts'
import { bindSpaceHandTool } from './space-hand'

export interface EditorKeyboardOptions {
  /** The host's own keys: saving, tabs, panels. They follow the same focus rules as the editor's. */
  shortcuts?: readonly EditorShortcut[]
  /**
   * The host's own Escape, run once nothing in progress took it (a path, a pen or pencil stroke,
   * a preview, a rotation, the eyedropper) and before the selection clears: return true when it
   * handled the key, as closing a comment card does.
   */
  onEscape?: () => boolean
  /** More reasons to hold the editor's keys back, as a focused value field of the host's. */
  ignore?: (event: KeyboardEvent) => boolean
  /**
   * Whether this editor takes the keys now. The keys listen on the window, so a page with more
   * than one editor passes the one in use, and the others stay still. Every key, the held Space
   * hand and nudging included, follows it; by default the editor always does.
   */
  active?: MaybeRefOrGetter<boolean>
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
  const active = () => toValue(options.active ?? true)
  const spaceTool = bindSpaceHandTool(inputFocused, editor, active)
  bindNudgeKeys(editor, overlays, (event) => !active() || !!options.ignore?.(event))

  const shortcuts: EditorShortcut[] = [
    ...editorShortcuts(editor, runCommand, actions),
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
  /** The shortcut that owns each editor key: a host's replaces the editor's, flags and all. */
  const owners = new Map<string, EditorShortcut>()

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
    for (const key of [shortcut.keys].flat()) {
      // A key has one shortcut: the one bound last, global or not, replaces any before it.
      if (shortcut.global) {
        Reflect.deleteProperty(bindings, key)
        owners.delete(key)
      } else {
        Reflect.deleteProperty(globalBindings, key)
        owners.set(key, shortcut)
      }
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
          const owner = owners.get(keys)
          if (!active() || heldBack(event, !!owner?.history)) return
          const { shortcuts: allowed } = resolveEditorProfile(editor.state)
          if (allowed === 'view' && !owner?.view) return
          handler(event)
        }
      ])
    )
  )
  const globalHandler = createKeybindingsHandler(
    Object.fromEntries(
      Object.entries(globalBindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (active()) handler(event)
        }
      ])
    )
  )

  useEventListener(window, 'keydown', (event) => editorHandler(shortcutEvent(event)), {
    capture: true
  })
  useEventListener(window, 'keydown', (event) => globalHandler(shortcutEvent(event)), {
    capture: true
  })

  return { actions }
}
