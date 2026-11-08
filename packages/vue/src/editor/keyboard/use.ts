import {
  detectPlatform,
  matchesKeyboardEvent,
  normalizeHotkey,
  parseHotkey,
  type HotkeyPlatform,
  type ParsedHotkeyChord
} from '@tanstack/hotkeys'
import { useActiveElement, useEventListener } from '@vueuse/core'
import { sortBy } from 'es-toolkit'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { RefusedEditError } from '@open-pencil/core'

import { useEditorCommands } from '#vue/editor/commands'
import { useEditor } from '#vue/editor/context'
import { useOpenOverlays } from '#vue/lifecycle/overlays'

import { createEditorKeyActions } from './actions'
import { isInputElement } from './focus'
import { createShortcutGuard } from './guard'
import { bindNudgeKeys } from './nudge'
import { pressedInClosingOverlay } from './overlays'
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
 * Binds the editor's keyboard as OpenPencil binds it: the commands' shortcuts, the profile's
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
  const platform = detectPlatform()
  const bindings = keyBindings(platform, [
    ...toolShortcuts(editor, () => spaceHand.resetToolBeforeSpace()),
    ...editorShortcuts(editor, runCommand, actions),
    ...(options.shortcuts ?? [])
  ])
  useEventListener(
    window,
    'keydown',
    (event) => {
      const shortcut = bindings.find(({ chord }) =>
        matchesKeyboardEvent(event, chord, platform)
      )?.shortcut
      if (!shortcut || !active() || !mayRun(event, shortcut)) return
      runRefusable(() => shortcut.run(event))
      if (!(shortcut.preventDefault?.(event) ?? true)) return
      event.preventDefault()
      // The key was the canvas's; a closing menu still holding focus must not act on it as well.
      if (pressedInClosingOverlay(event)) event.stopPropagation()
    },
    { capture: true }
  )
}

/** Runs a key's action; one the document refuses, as a read-only one does, does nothing. */
function runRefusable(run: () => void) {
  try {
    run()
  } catch (error) {
    if (!(error instanceof RefusedEditError)) throw error
  }
}

interface KeyBinding {
  chord: ParsedHotkeyChord
  shortcut: EditorShortcut
}

/**
 * One shortcut per chord, a later one replacing an earlier one as a host's replaces the editor's,
 * with the chords holding more modifiers first. A key typed with Shift, as AZERTY types its
 * digits, also matches the chord without it, so `Shift+1` must be tried before `1`.
 */
function keyBindings(platform: HotkeyPlatform, shortcuts: readonly EditorShortcut[]): KeyBinding[] {
  const byChord = new Map(
    shortcuts.flatMap((shortcut) =>
      [shortcut.keys].flat().map((key) => [normalizeHotkey(key, platform), shortcut] as const)
    )
  )
  const bindings = [...byChord].map(([key, shortcut]) => ({
    chord: parseHotkey(key, platform),
    shortcut
  }))
  return sortBy(bindings, [({ chord }) => -chord.modifiers.length])
}
