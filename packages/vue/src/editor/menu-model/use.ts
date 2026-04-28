import {
  buildCanvasMenu,
  buildEditMenu,
  buildObjectMenu,
  buildViewMenu
} from '#vue/editor/menu-model/builders'
import { useEditorCommands } from '#vue/editor/commands/use'
import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { menuMessages } from '#vue/i18n'
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

export type { MenuActionNode, MenuEntry, MenuSeparatorNode } from '#vue/editor/menu-model/types'

import type { MenuEntry } from '#vue/editor/menu-model/types'

/**
 * Returns ready-to-render menu models derived from the current editor state.
 *
 * This is a higher-level API than {@link useEditorCommands}: it groups
 * commands into app and canvas menu structures and computes context-sensitive
 * labels like Hide/Show and Lock/Unlock.
 */
export function useMenuModel() {
  const editor = useEditor()
  const { menuItem: commandMenuItem, otherPages, moveSelectionToPage } = useEditorCommands()
  const selection = useSelectionState()

  const t = useStore(menuMessages)

  const editMenu = computed<MenuEntry[]>(() => buildEditMenu(commandMenuItem))

  const viewMenu = computed<MenuEntry[]>(() => buildViewMenu(commandMenuItem))

  const objectMenu = computed<MenuEntry[]>(() => buildObjectMenu(commandMenuItem))

  const arrangeMenu = computed<MenuEntry[]>(() => [commandMenuItem('selection.wrapInAutoLayout')])

  const appMenu = computed(() => [
    { label: t.value.edit, items: editMenu.value },
    { label: t.value.view, items: viewMenu.value },
    { label: t.value.object, items: objectMenu.value },
    { label: t.value.arrange, items: arrangeMenu.value }
  ])

  const canvasMenu = computed<MenuEntry[]>(() =>
    buildCanvasMenu({
      commandMenuItem,
      otherPages: otherPages.value,
      moveSelectionToPage,
      selection,
      t: t.value
    })
  )

  const selectionLabelMenu = computed(() => ({
    visibility: (editor.getSelectedNode()?.visible ?? true) ? t.value.hide : t.value.show,
    lock: (editor.getSelectedNode()?.locked ?? false) ? t.value.unlock : t.value.lock
  }))

  return {
    appMenu,
    canvasMenu,
    selectionLabelMenu
  }
}
