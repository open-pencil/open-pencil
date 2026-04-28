import { createEditorCommandActions } from '#vue/editor/commands/actions'
import { createEditorCommandMap } from '#vue/editor/commands/definitions'
import { useEditor } from '#vue/editor/context'
import { useSelectionCapabilities } from '#vue/editor/selection-capabilities/use'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { commandMessages } from '#vue/i18n'
import { usePageList } from '#vue/primitives/PageList/usePageList'
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

export type {
  EditorCommand,
  EditorCommandId,
  EditorCommandMenuEntry,
  EditorCommandMenuItem,
  EditorCommandMenuSeparator
} from './types'

/**
 * Builds a command-oriented interface on top of the current editor.
 *
 * Use this composable when building menus, toolbars, keyboard handlers, or
 * any other UI that should talk in terms of commands instead of raw editor
 * method calls.
 */
export function useEditorCommands() {
  const editor = useEditor()
  const selection = useSelectionState()
  const capabilities = useSelectionCapabilities()
  const { pages } = usePageList()

  const t = useStore(commandMessages)

  const otherPages = computed(() =>
    pages.value.filter((page) => page.id !== editor.state.currentPageId)
  )

  function moveSelectionToPage(pageId: string) {
    if (!capabilities.canMoveToPage.value) return
    editor.moveToPage(pageId)
  }

  const commands = createEditorCommandMap({
    editor,
    selection,
    capabilities,
    messages: t,
    otherPages,
    moveSelectionToPage
  })

  return {
    commands,
    otherPages,
    moveSelectionToPage,
    ...createEditorCommandActions(commands)
  }
}
