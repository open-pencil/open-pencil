import { useFileDialog } from '@vueuse/core'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

import { setOpenPencilOpenFileHandler } from '@/app/browser-bridge'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import { notificationMessages } from '@/app/i18n/notifications'
import { rememberRecentFile } from '@/app/recent-files'
import { toast } from '@/app/shell/ui'
import { openFileInNewTab } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'
import { IS_BROWSER } from '@/constants'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const DOM_DOCUMENT_EXTENSIONS = ['html', 'htm', 'xhtml'] as const
const READABLE_DOCUMENT_EXTENSIONS = [
  ...new Set([
    ...io.listReadableFormats().flatMap((format) => format.extensions),
    ...DOM_DOCUMENT_EXTENSIONS
  ])
]
const DESIGN_FILE_ACCEPT = READABLE_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(
  ','
)

const fileDialog = useFileDialog({
  accept: DESIGN_FILE_ACCEPT,
  multiple: true,
  reset: true
})

fileDialog.onChange((files) => {
  if (!files) return
  void openDesignFileBatch(
    files,
    (file) => file.name,
    (file) => {
      assertSupportedDesignFile(file.name)
      return openFileInNewTab(file)
    }
  )
})

if (IS_BROWSER && 'window' in globalThis) {
  setOpenPencilOpenFileHandler(async (path: string) => {
    const resourceURL = resolveBrowserFileURL(path)
    const response = await fetch(resourceURL)
    const blob = await response.blob()
    const name = resourceURL.pathname.split('/').pop() ?? 'file.fig'
    assertSupportedDesignFile(name)
    const file = new File([blob], name, { type: 'application/octet-stream' })
    await openFileInNewTab(file, undefined, resourceURL.href)
  })
}

function isSupportedDesignFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()
  return (
    io.findReader(fileName) !== null ||
    DOM_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(`.${extension}`))
  )
}

function assertSupportedDesignFile(fileName: string): void {
  if (!isSupportedDesignFile(fileName)) {
    throw new Error(`Unsupported document format: ${fileName}`)
  }
}

export async function openDesignFileBatch<T>(
  items: Iterable<T>,
  displayName: (item: T) => string,
  openItem: (item: T) => Promise<void>
): Promise<void> {
  for (const item of items) {
    try {
      await openItem(item)
    } catch (error) {
      const name = displayName(item)
      const detail = error instanceof Error ? error.message : String(error)
      console.error(`Failed to open ${name}:`, error)
      toast.error(notificationMessages.get().openFileFailed({ name, error: detail }))
    }
  }
}

export async function readTauriDesignFile(path: string): Promise<File> {
  assertSupportedDesignFile(path)
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(path)
  return new File([bytes], path.split('/').pop() ?? 'file.fig')
}

export async function chooseTauriOpenPaths(): Promise<string[]> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const paths = await open({
    filters: [{ name: 'Design file', extensions: READABLE_DOCUMENT_EXTENSIONS }],
    multiple: true
  })
  if (!paths) return []
  return typeof paths === 'string' ? [paths] : paths
}

export async function openFileFromPath(path: string) {
  if (!isTauri()) return
  const file = await readTauriDesignFile(path)
  await openFileInNewTab(file, undefined, path)
  rememberRecentFile(path)
}

export async function openFileDialog() {
  if (isTauri()) {
    const paths = await chooseTauriOpenPaths()
    await openDesignFileBatch(paths, (path) => path.split(/[/\\]/).pop() ?? path, openFileFromPath)
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
      await openDesignFileBatch(
        handles,
        (handle) => handle.name,
        async (handle) => {
          const file = await handle.getFile()
          assertSupportedDesignFile(file.name)
          await openFileInNewTab(file, handle)
        }
      )
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
