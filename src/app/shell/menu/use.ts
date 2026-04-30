import { tryOnScopeDispose } from '@vueuse/core'

import { useEditorStore } from '@/app/editor/active-store'
import { importFileDialog, openFileDialog } from '@/app/shell/menu/files'
import { createTab, closeTab, activeTab } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

const store = useEditorStore()

const MENU_ACTIONS: Partial<Record<string, () => void>> = {
  new: () => createTab(),
  open: () => void openFileDialog(),
  import: () => void importFileDialog(),
  close: () => {
    if (activeTab.value) closeTab(activeTab.value.id)
  },
  save: () => void store.saveFigFile(),
  'save-as': () => void store.saveFigFileAs(),
  duplicate: () => store.duplicateSelected(),
  delete: () => store.deleteSelected(),
  group: () => store.groupSelected(),
  ungroup: () => store.ungroupSelected(),
  'create-component': () => store.createComponentFromSelection(),
  'create-component-set': () => store.createComponentSetFromComponents(),
  'detach-instance': () => store.detachInstance(),
  'zoom-100': () => store.zoomTo100(),
  'zoom-fit': () => store.zoomToFit(),
  'zoom-selection': () => store.zoomToSelection(),
  export: () => {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
  }
}

export { importFileDialog, openFileDialog }
export { openFileFromPath } from '@/app/shell/menu/files'

export function useMenu() {
  if (!IS_TAURI) return

  let unlisten: (() => void) | undefined

  void import('@tauri-apps/api/event').then(({ listen }) => {
    void listen<string>('menu-event', (event) => {
      const action = MENU_ACTIONS[event.payload]
      if (action) action()
    }).then((fn) => {
      unlisten = fn
    })
  })

  tryOnScopeDispose(() => unlisten?.())
}
