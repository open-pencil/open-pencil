import { onUnmounted } from 'vue'

import { IS_TAURI } from '@/constants'
import { useEditorStore } from '@/stores/editor'
import { openFileInNewTab, createTab, closeTab, activeTab } from '@/stores/tabs'

export async function openFileDialog() {
  if (IS_TAURI) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({
      filters: [{ name: 'Figma file', extensions: ['fig'] }],
      multiple: false
    })
    if (!path) return
    const bytes = await readFile(path as string)
    const file = new File([bytes], (path as string).split('/').pop() ?? 'file.fig')
    await openFileInNewTab(file, undefined, path as string)
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

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.fig'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) openFileInNewTab(file)
  })
  input.click()
}

function getStore() {
  return useEditorStore()
}

const MENU_ACTIONS: Record<string, () => void> = {
  open: () => openFileDialog(),
  save: () => getStore().saveFigFile(),
  'save-as': () => getStore().saveFigFileAs(),
  duplicate: () => getStore().duplicateSelected(),
  delete: () => getStore().deleteSelected(),
  group: () => getStore().groupSelected(),
  ungroup: () => getStore().ungroupSelected(),
  'create-component': () => getStore().createComponentFromSelection(),
  'create-component-set': () => getStore().createComponentSetFromComponents(),
  'detach-instance': () => getStore().detachInstance(),
  'zoom-fit': () => getStore().zoomToFit(),
  export: () => {
    const s = getStore()
    if (s.state.selectedIds.size > 0) s.exportSelection(1, 'PNG')
  },
  'new-tab': () => createTab(),
  'close-tab': () => {
    if (activeTab.value) closeTab(activeTab.value.id)
  }
}

export function useMenu() {
  if (!IS_TAURI) return

  let unlisten: (() => void) | undefined

  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<string>('menu-event', (event) => {
      const action = MENU_ACTIONS[event.payload]
      if (action) action()
    }).then((fn) => {
      unlisten = fn
    })
  })

  onUnmounted(() => unlisten?.())
}
