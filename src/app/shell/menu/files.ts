import { useFileDialog } from '@vueuse/core'

import { setOpenPencilOpenFileHandler } from '@/app/browser-bridge'
import { openFileInNewTab } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'
import { IS_BROWSER } from '@/constants'

const fileDialog = useFileDialog({ accept: '.fig,.pen', multiple: false, reset: true })

fileDialog.onChange((files) => {
  const file = files?.[0]
  if (file) void openFileInNewTab(file)
})

if (IS_BROWSER && 'window' in globalThis) {
  setOpenPencilOpenFileHandler(async (path: string) => {
    const response = await fetch(path)
    const blob = await response.blob()
    const name = path.split('/').pop() ?? 'file.fig'
    const file = new File([blob], name, { type: 'application/octet-stream' })
    await openFileInNewTab(file, undefined, path)
  })
}

export async function readTauriDesignFile(path: string): Promise<File> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(path)
  return new File([bytes], path.split('/').pop() ?? 'file.fig')
}

export async function chooseTauriOpenPath(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const path = await open({
    filters: [{ name: 'Design file', extensions: ['fig', 'pen'] }],
    multiple: false
  })
  return typeof path === 'string' ? path : null
}

export async function openFileFromPath(path: string) {
  if (!isTauri()) return
  const file = await readTauriDesignFile(path)
  await openFileInNewTab(file, undefined, path)
}

export async function openFileDialog() {
  if (isTauri()) {
    const path = await chooseTauriOpenPath()
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
