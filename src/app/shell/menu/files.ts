import { useFileDialog } from '@vueuse/core'

import { setOpenPencilOpenFileHandler } from '@/app/browser-bridge'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import { rememberRecentFile } from '@/app/shell/menu/recent-files'
import { openFileInNewTab } from '@/app/tabs'
import { rememberDevOpenFilePath } from '@/app/tauri/dev-file-storage'
import { isTauri } from '@/app/tauri/env'
import { IS_BROWSER } from '@/constants'

const fileDialog = useFileDialog({
  accept: '.fig,.pen,.html,.htm,.xhtml',
  multiple: true,
  reset: true
})

fileDialog.onChange((files) => {
  if (!files) return
  void (async () => {
    for (const file of files) await openFileInNewTab(file)
  })()
})

if (IS_BROWSER && 'window' in globalThis) {
  setOpenPencilOpenFileHandler(async (path: string) => {
    const resourceURL = resolveBrowserFileURL(path)
    const response = await fetch(resourceURL)
    const blob = await response.blob()
    const name = resourceURL.pathname.split('/').pop() ?? 'file.fig'
    const file = new File([blob], name, { type: 'application/octet-stream' })
    await openFileInNewTab(file, undefined, resourceURL.href)
  })
}

export async function readTauriDesignFile(path: string): Promise<File> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(path)
  return new File([bytes], path.split('/').pop() ?? 'file.fig')
}

export async function chooseTauriOpenPaths(): Promise<string[]> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const paths = await open({
    filters: [{ name: 'Design file', extensions: ['fig', 'pen', 'html', 'htm', 'xhtml'] }],
    multiple: true
  })
  if (!paths) return []
  return typeof paths === 'string' ? [paths] : paths
}

export async function openFileFromPath(path: string) {
  if (!isTauri()) return
  const file = await readTauriDesignFile(path)
  await openFileInNewTab(file, undefined, path)
  rememberDevOpenFilePath(path)
  rememberRecentFile(path)
}

export async function openFileDialog() {
  if (isTauri()) {
    const paths = await chooseTauriOpenPaths()
    for (const path of paths) await openFileFromPath(path)
    return
  }

  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'Design file',
            accept: {
              'application/octet-stream': ['.fig'],
              'application/json': ['.pen'],
              'text/html': ['.html', '.htm'],
              'application/xhtml+xml': ['.xhtml'],
              'text/plain': ['.pen']
            }
          }
        ]
      })
      for (const handle of handles) {
        const file = await handle.getFile()
        await openFileInNewTab(file, handle)
      }
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
