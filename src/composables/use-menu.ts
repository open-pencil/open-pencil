import { useFileDialog } from '@vueuse/core'
import { onUnmounted } from 'vue'

import { IS_TAURI } from '@/constants'
import { useEditorStore } from '@/stores/editor'
import { openFileInNewTab, createTab, closeTab, activeTab } from '@/stores/tabs'

const fileDialog = useFileDialog({ accept: '.fig', multiple: false, reset: true })
fileDialog.onChange((files) => {
  const file = files?.[0]
  if (file) void openFileInNewTab(file)
})

export async function openFileDialog() {
  if (IS_TAURI) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({
      filters: [{ name: 'Figma file', extensions: ['fig'] }],
      multiple: false
    })
    if (!path) return
    const bytes = await readFile(path)
    const file = new File([bytes], path.split('/').pop() ?? 'file.fig')
    await openFileInNewTab(file, undefined, path)
    return
  }

  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Figma file',
            accept: { 'application/octet-stream': ['.fig'] }
          }
        ]
      })
      const file = await handle.getFile()
      await openFileInNewTab(file, handle)
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }

  fileDialog.open()
}

const store = useEditorStore()

const MENU_ACTIONS: Partial<Record<string, () => void>> = {
  new: () => createTab(),
  open: () => void openFileDialog(),
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
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'PNG')
  }
}

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

  onUnmounted(() => unlisten?.())
}
