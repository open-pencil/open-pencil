import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

import { useEditorCommands } from '@open-pencil/vue/commands/useEditorCommands'
import { useEditor } from '@open-pencil/vue/context/editorContext'
import { menuMessages } from '@open-pencil/vue/i18n'
import { useSelectionState } from '@open-pencil/vue/selection/useSelectionState'

/**
 * Action entry used by menu models returned from {@link useMenuModel}.
 */
export interface MenuActionNode {
  separator?: false
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  sub?: MenuEntry[]
}

export interface MenuSeparatorNode {
  separator: true
}

export type MenuEntry = MenuActionNode | MenuSeparatorNode

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
  const { hasSelection, isGroup, isInstance, isComponent, canCreateComponentSet, selectedNode } =
    useSelectionState()

  const t = useStore(menuMessages)

  const editMenu = computed<MenuEntry[]>(() => [
    commandMenuItem('edit.undo'),
    commandMenuItem('edit.redo'),
    { separator: true },
    commandMenuItem('selection.duplicate'),
    commandMenuItem('selection.delete'),
    { separator: true },
    commandMenuItem('selection.selectAll')
  ])

  const viewMenu = computed<MenuEntry[]>(() => [
    commandMenuItem('view.zoom100'),
    commandMenuItem('view.zoomFit'),
    commandMenuItem('view.zoomSelection')
  ])

  const objectMenu = computed<MenuEntry[]>(() => [
    commandMenuItem('selection.group'),
    commandMenuItem('selection.ungroup'),
    { separator: true },
    commandMenuItem('selection.createComponent'),
    commandMenuItem('selection.createComponentSet'),
    commandMenuItem('selection.detachInstance'),
    { separator: true },
    commandMenuItem('selection.bringToFront'),
    commandMenuItem('selection.sendToBack')
  ])

  const arrangeMenu = computed<MenuEntry[]>(() => [commandMenuItem('selection.wrapInAutoLayout')])

  const appMenu = computed(() => [
    { label: t.value.edit, items: editMenu.value },
    { label: t.value.view, items: viewMenu.value },
    { label: t.value.object, items: objectMenu.value },
    { label: t.value.arrange, items: arrangeMenu.value }
  ])

  const canvasMenu = computed<MenuEntry[]>(() => {
    const moveToPageSubmenu: MenuEntry[] = otherPages.value.map((page) => ({
      label: page.name,
      action: () => moveSelectionToPage(page.id)
    }))

    return [
      commandMenuItem('selection.duplicate', '⌘D'),
      commandMenuItem('selection.delete', '⌫'),
      { separator: true },
      ...(moveToPageSubmenu.length > 0 && hasSelection.value
        ? [{ label: t.value.moveToPage, sub: moveToPageSubmenu } satisfies MenuActionNode]
        : []),
      commandMenuItem('selection.bringToFront', ']'),
      commandMenuItem('selection.sendToBack', '['),
      { separator: true },
      commandMenuItem('selection.group', '⌘G'),
      ...(isGroup.value ? [commandMenuItem('selection.ungroup', '⇧⌘G')] : []),
      ...(hasSelection.value ? [commandMenuItem('selection.wrapInAutoLayout', '⇧A')] : []),
      { separator: true },
      commandMenuItem('selection.createComponent', '⌥⌘K'),
      ...(canCreateComponentSet.value
        ? [commandMenuItem('selection.createComponentSet', '⇧⌘K')]
        : []),
      ...(isComponent.value && selectedNode.value
        ? [commandMenuItem('selection.createInstance')]
        : []),
      ...(isInstance.value ? [commandMenuItem('selection.goToMainComponent')] : []),
      ...(isInstance.value ? [commandMenuItem('selection.detachInstance', '⌥⌘B')] : []),
      ...(hasSelection.value
        ? [
            { separator: true } as MenuSeparatorNode,
            commandMenuItem('selection.toggleVisibility', '⇧⌘H'),
            commandMenuItem('selection.toggleLock', '⇧⌘L')
          ]
        : [])
    ]
  })

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
