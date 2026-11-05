import { useActiveElement, useEventListener } from '@vueuse/core'
import { createKeybindingsHandler } from 'tinykeys'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { useEditorCommands } from '#vue/editor/commands'
import { useEditor } from '#vue/editor/context'
import { useOpenOverlays } from '#vue/lifecycle/overlays'

import { createEditorKeyActions } from './actions'
import { isInputElement } from './focus'
import { createShortcutGuard } from './guard'
import { shortcutEvent } from './layout'
import { bindNudgeKeys } from './nudge'
import { editorShortcuts, toolShortcuts, type EditorShortcut } from './shortcuts'
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
 * zoom, with the host's own `shortcuts` beside them; a host shortcut on a key the editor uses
 * replaces the editor's. Keys wait while a text field, an open dialog or menu, or text being
 * edited has them, and a preview keeps only the keys that leave it. Undo and redo stop the
 * browser's own. Call it inside a component under `provideEditor`.
 */
export function useEditorKeyboard(options: EditorKeyboardOptions = {}) {
  const editor = useEditor()
  const { runCommand, setOpacityTarget } = useEditorCommands()
  const overlays = useOpenOverlays()
  const activeElement = useActiveElement({ triggerOnRemoval: true })
  const inputFocused = computed(() => isInputElement(activeElement.value))
  const active = () => toValue(options.active ?? true)

  const actions = createEditorKeyActions({
    editor,
    runCommand,
    setOpacityTarget,
    onEscape: options.onEscape
  })
  const spaceHand = bindSpaceHandTool(inputFocused, editor, active)
  bindNudgeKeys(editor, overlays, (event) => !active() || !!options.ignore?.(event))

  const mayRun = createShortcutGuard({ editor, overlays, inputFocused, ignore: options.ignore })
  const shortcuts = byKey([
    ...toolShortcuts(editor, () => spaceHand.resetToolBeforeSpace()),
    ...editorShortcuts(editor, runCommand, actions),
    ...(options.shortcuts ?? [])
  ])
  const handle = createKeybindingsHandler(
    Object.fromEntries(
      [...shortcuts].map(([key, shortcut]) => [
        key,
        (event: KeyboardEvent) => {
          if (!active() || !mayRun(event, shortcut)) return
          shortcut.run(event)
          if (shortcut.preventDefault?.(event) ?? true) event.preventDefault()
        }
      ])
    )
  )
  useEventListener(window, 'keydown', (event) => handle(shortcutEvent(event)), { capture: true })
}

/** One shortcut per key: a later one replaces an earlier one, as a host's replaces the editor's. */
function byKey(shortcuts: readonly EditorShortcut[]): Map<string, EditorShortcut> {
  return new Map(
    shortcuts.flatMap((shortcut) => [shortcut.keys].flat().map((key) => [key, shortcut]))
  )
}
