import type { EditorCommand, EditorCommandId } from './types'
import type { EditorCommandMapOptions } from './context'

type SelectionCommandId = Extract<EditorCommandId, `selection.${string}`>

export function createSelectionCommands({
  editor,
  selection,
  capabilities,
  messages: t,
  otherPages,
  moveSelectionToPage,
}: EditorCommandMapOptions): Record<SelectionCommandId, EditorCommand> {
  return {
    'selection.selectAll': {
      id: 'selection.selectAll',
      get label() {
        return t.value.selectAll
      },
      enabled: capabilities.canSelectAll,
      run: () => editor.selectAll(),
    },
    'selection.duplicate': {
      id: 'selection.duplicate',
      get label() {
        return t.value.duplicate
      },
      enabled: capabilities.canDuplicate,
      run: () => editor.duplicateSelected(),
    },
    'selection.delete': {
      id: 'selection.delete',
      get label() {
        return t.value.delete
      },
      enabled: capabilities.canDelete,
      run: () => editor.deleteSelected(),
    },
    'selection.group': {
      id: 'selection.group',
      get label() {
        return t.value.group
      },
      enabled: capabilities.canGroup,
      run: () => editor.groupSelected(),
    },
    'selection.ungroup': {
      id: 'selection.ungroup',
      get label() {
        return t.value.ungroup
      },
      enabled: capabilities.canUngroup,
      run: () => editor.ungroupSelected(),
    },
    'selection.createComponent': {
      id: 'selection.createComponent',
      get label() {
        return t.value.createComponent
      },
      enabled: capabilities.canCreateComponent,
      run: () => editor.createComponentFromSelection(),
    },
    'selection.createComponentSet': {
      id: 'selection.createComponentSet',
      get label() {
        return t.value.createComponentSet
      },
      enabled: capabilities.canCreateComponentSet,
      run: () => editor.createComponentSetFromComponents(),
    },
    'selection.createInstance': {
      id: 'selection.createInstance',
      get label() {
        return t.value.createInstance
      },
      enabled: capabilities.canCreateInstance,
      run: () => {
        const node = selection.selectedNode.value
        if (node?.type === 'COMPONENT') editor.createInstanceFromComponent(node.id)
      },
    },
    'selection.detachInstance': {
      id: 'selection.detachInstance',
      get label() {
        return t.value.detachInstance
      },
      enabled: capabilities.canDetachInstance,
      run: () => editor.detachInstance(),
    },
    'selection.goToMainComponent': {
      id: 'selection.goToMainComponent',
      get label() {
        return t.value.goToMainComponent
      },
      enabled: capabilities.canGoToMainComponent,
      run: () => editor.goToMainComponent(),
    },
    'selection.wrapInAutoLayout': {
      id: 'selection.wrapInAutoLayout',
      get label() {
        return t.value.addAutoLayout
      },
      enabled: capabilities.canWrapInAutoLayout,
      run: () => editor.wrapInAutoLayout(),
    },
    'selection.bringToFront': {
      id: 'selection.bringToFront',
      get label() {
        return t.value.bringToFront
      },
      enabled: capabilities.canBringToFront,
      run: () => editor.bringToFront(),
    },
    'selection.sendToBack': {
      id: 'selection.sendToBack',
      get label() {
        return t.value.sendToBack
      },
      enabled: capabilities.canSendToBack,
      run: () => editor.sendToBack(),
    },
    'selection.toggleVisibility': {
      id: 'selection.toggleVisibility',
      get label() {
        return t.value.toggleVisibility
      },
      enabled: capabilities.canToggleVisibility,
      run: () => editor.toggleVisibility(),
    },
    'selection.toggleLock': {
      id: 'selection.toggleLock',
      get label() {
        return t.value.toggleLock
      },
      enabled: capabilities.canToggleLock,
      run: () => editor.toggleLock(),
    },
    'selection.moveToPage': {
      id: 'selection.moveToPage',
      get label() {
        return t.value.moveToPage
      },
      enabled: capabilities.canMoveToPage,
      run: () => {
        moveSelectionToPage(otherPages.value[0].id)
      },
    },
  }
}
