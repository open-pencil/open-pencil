import {
  detectPlatform,
  matchesKeyboardEvent,
  normalizeHotkey,
  parseHotkey,
  type HotkeyPlatform,
  type ParsedHotkeyChord
} from '@tanstack/hotkeys'
import { useActiveElement, useEventListener } from '@vueuse/core'
import { groupBy, sortBy } from 'es-toolkit'
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
  /**
   * The host's own keys: saving, tabs, panels. They follow the same focus rules as the editor's,
   * and run before an editor key on the same chord, which runs only when theirs returns `false`.
   */
  shortcuts?: readonly EditorShortcut[]
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
 * goes first, and the editor's runs when the host's declines it, as an Escape that closes the
 * host's popover only while one is open does. Keys wait while a text field, an open dialog or menu, or text being
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

  const actions = createEditorKeyActions({ editor, runCommand, setOpacityTarget })
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
      if (!active()) return
      const chain = bindings.find(({ chord }) => matchesKeyboardEvent(event, chord, platform))
      const shortcut = chain?.shortcuts.find(
        (candidate) => mayRun(event, candidate) && runRefusable(() => candidate.run(event))
      )
      if (!shortcut || !(shortcut.preventDefault?.(event) ?? true)) return
      event.preventDefault()
      // The key was the canvas's; a closing menu still holding focus must not act on it as well.
      if (pressedInClosingOverlay(event)) event.stopPropagation()
    },
    { capture: true }
  )
}

/**
 * Runs a key's action and says whether it took the key: one that returns `false` declines it,
 * and one the document refuses, as a read-only one does, does nothing but still takes it.
 */
function runRefusable(run: () => unknown): boolean {
  try {
    return run() !== false
  } catch (error) {
    if (!(error instanceof RefusedEditError)) throw error
    return true
  }
}

interface KeyBinding {
  chord: ParsedHotkeyChord
  /** The shortcuts on the chord, the one tried first first. */
  shortcuts: EditorShortcut[]
}

/**
 * The shortcuts on each chord, a later one tried before an earlier one as a host's goes before
 * the editor's, with the chords holding more modifiers first. A key typed with Shift, as AZERTY types its
 * digits, also matches the chord without it, so `Shift+1` must be tried before `1`.
 */
function keyBindings(platform: HotkeyPlatform, shortcuts: readonly EditorShortcut[]): KeyBinding[] {
  const byChord = groupBy(
    shortcuts
      .flatMap((shortcut) =>
        [shortcut.keys].flat().map((key) => ({ key: normalizeHotkey(key, platform), shortcut }))
      )
      .reverse(),
    ({ key }) => key
  )
  const bindings = Object.entries(byChord).map(([key, entries]) => ({
    chord: parseHotkey(key, platform),
    shortcuts: entries.map(({ shortcut }) => shortcut)
  }))
  return sortBy(bindings, [({ chord }) => -chord.modifiers.length])
}
