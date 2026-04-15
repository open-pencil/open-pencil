import { useFileDialog } from '@vueuse/core'
import { onUnmounted } from 'vue'

import { IS_BROWSER, IS_TAURI } from '@/constants'
import { useEditorStore } from '@/stores/editor'
import { openFileInNewTab, createTab, closeTab, activeTab } from '@/stores/tabs'

const fileDialog = useFileDialog({ accept: '.fig,.pen', multiple: false, reset: true })
fileDialog.onChange((files) => {
  const file = files?.[0]
  if (file) void openFileInNewTab(file)
})

if (IS_BROWSER) {
  ;(
    window as Window & { __OPEN_PENCIL_OPEN_FILE__?: (path: string) => Promise<void> }
  ).__OPEN_PENCIL_OPEN_FILE__ = async (path: string) => {
    const response = await fetch(path)
    const blob = await response.blob()
    const name = path.split('/').pop() ?? 'file.fig'
    const file = new File([blob], name, { type: 'application/octet-stream' })
    await openFileInNewTab(file, undefined, path)
  }
}

/**
 * Open a file directly by absolute path, bypassing the picker.
 * Used by the CLI-arg auto-open path (`OpenPencil ~/proj/foo.fig`).
 * Tauri-only — silently no-ops in browser builds.
 */
export async function openFileFromPath(path: string) {
  if (!IS_TAURI) return
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(path)
  const file = new File([bytes], path.split('/').pop() ?? 'file.fig')
  await openFileInNewTab(file, undefined, path)
}

export async function openFileDialog() {
  if (IS_TAURI) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({
      filters: [{ name: 'Design file', extensions: ['fig', 'pen'] }],
      multiple: false
    })
    if (!path) return
    await openFileFromPath(path)
    return
  }

  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Design file',
            accept: {
              'application/octet-stream': ['.fig'],
              'application/json': ['.pen'],
              'text/plain': ['.pen']
            }
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

export async function importFileDialog() {
  await openFileDialog()
}

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
