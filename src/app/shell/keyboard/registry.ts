import { whenever } from '@vueuse/core'
import { computed } from 'vue'

import { TOOL_SHORTCUTS } from '@/app/editor/session'
import { bindSpaceHandTool } from '@/app/shell/keyboard/space-tool'

import type { ComputedRef } from 'vue'
import type { KeyboardShortcutOptions } from '@/app/shell/keyboard/types'

type ShortcutAction = (options: KeyboardShortcutOptions) => void

type ShortcutDefinition = {
  id: string
  when: ComputedRef<boolean>
  run: ShortcutAction
}

function createShortcutMatchers({
  keys,
  inputFocused,
  store
}: Pick<KeyboardShortcutOptions, 'keys' | 'inputFocused' | 'store'>) {
  function mod(combo: string): ComputedRef<boolean> {
    const hasShift = combo.includes('shift')
    const hasAlt = combo.includes('alt')
    const base = computed(() => keys[`meta+${combo}`].value || keys[`control+${combo}`].value)
    if (hasShift && hasAlt) return base
    if (hasShift) return computed(() => base.value && !keys['alt'].value)
    if (hasAlt) return computed(() => base.value && !keys['shift'].value)
    return computed(() => base.value && !keys['shift'].value && !keys['alt'].value)
  }

  function shift(key: string): ComputedRef<boolean> {
    return computed(
      () =>
        !inputFocused.value &&
        keys[`shift+${key}`].value &&
        !keys['meta'].value &&
        !keys['control'].value
    )
  }

  function plain(key: string, options?: { allowAlt?: boolean }): ComputedRef<boolean> {
    const allowAlt = options?.allowAlt ?? false
    return computed(
      () =>
        !inputFocused.value &&
        keys[key].value &&
        !keys['meta'].value &&
        !keys['control'].value &&
        !keys['shift'].value &&
        (allowAlt || !keys['alt'].value) &&
        !store.state.editingTextId &&
        !store.state.scrubInputFocused
    )
  }

  return { mod, shift, plain }
}

function commandShortcut(
  id: string,
  when: ComputedRef<boolean>,
  command: Parameters<KeyboardShortcutOptions['runCommand']>[0]
): ShortcutDefinition {
  return { id, when, run: ({ runCommand }) => runCommand(command) }
}

export function registerKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const { keys, inputFocused, store } = options
  const { mod, shift, plain } = createShortcutMatchers({ keys, inputFocused, store })
  const spaceTool = bindSpaceHandTool(keys, inputFocused, store)

  for (const [code, tool] of Object.entries(TOOL_SHORTCUTS)) {
    if (!tool) continue
    whenever(plain(code), () => {
      spaceTool.resetToolBeforeSpace()
      store.setTool(tool)
    })
  }

  const shortcuts: ShortcutDefinition[] = [
    commandShortcut('create-component', mod('alt+keyk'), 'selection.createComponent'),
    commandShortcut('detach-instance', mod('alt+keyb'), 'selection.detachInstance'),
    commandShortcut('create-component-set', mod('shift+keyk'), 'selection.createComponentSet'),
    commandShortcut('toggle-visibility', mod('shift+keyh'), 'selection.toggleVisibility'),
    commandShortcut('toggle-lock', mod('shift+keyl'), 'selection.toggleLock'),
    { id: 'export-selection-png', when: mod('shift+keye'), run: ({ actions }) => actions.exportSelectionPng() },
    { id: 'save-as', when: mod('shift+keys'), run: ({ store }) => void store.saveFigFileAs() },
    commandShortcut('ungroup', mod('shift+keyg'), 'selection.ungroup'),
    { id: 'toggle-ui', when: mod('backslash'), run: ({ actions }) => actions.toggleUI() },
    { id: 'toggle-ai', when: mod('keyj'), run: ({ actions }) => actions.toggleAI() },
    { id: 'close-tab', when: mod('keyw'), run: ({ closeActiveTab }) => closeActiveTab() },
    { id: 'new-tab', when: mod('keyn'), run: ({ createTab }) => createTab() },
    { id: 'new-tab-alt', when: mod('keyt'), run: ({ createTab }) => createTab() },
    commandShortcut('zoom-100', mod('digit0'), 'view.zoom100'),
    commandShortcut('zoom-fit', mod('digit1'), 'view.zoomFit'),
    commandShortcut('zoom-selection', mod('digit2'), 'view.zoomSelection'),
    commandShortcut('duplicate', mod('keyd'), 'selection.duplicate'),
    commandShortcut('select-all', mod('keya'), 'selection.selectAll'),
    { id: 'save', when: mod('keys'), run: ({ store }) => void store.saveFigFile() },
    { id: 'open-file', when: mod('keyo'), run: ({ openFileDialog }) => openFileDialog() },
    commandShortcut('group', mod('keyg'), 'selection.group'),
    commandShortcut('zoom-fit-shift', shift('digit1'), 'view.zoomFit'),
    commandShortcut('zoom-selection-shift', shift('digit2'), 'view.zoomSelection'),
    { id: 'toggle-auto-layout', when: shift('keya'), run: ({ actions }) => actions.toggleAutoLayout() },
    commandShortcut('bring-to-front', plain('BracketRight'), 'selection.bringToFront'),
    commandShortcut('send-to-back', plain('BracketLeft'), 'selection.sendToBack'),
    { id: 'delete-backspace', when: plain('Backspace'), run: ({ actions }) => actions.smartDelete(false) },
    { id: 'delete', when: plain('Delete', { allowAlt: true }), run: ({ actions, keys }) => actions.smartDelete(keys['alt'].value) },
    { id: 'enter', when: plain('Enter'), run: ({ actions }) => actions.confirmOrEnterText() },
    { id: 'escape', when: plain('Escape'), run: ({ actions }) => actions.escapeOrDeselect() }
  ]

  for (const shortcut of shortcuts) {
    whenever(shortcut.when, () => shortcut.run(options))
  }
}
