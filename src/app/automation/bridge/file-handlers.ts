import { openFileFromPath } from '@/app/shell/menu/use'
import { createTab, openFileInNewTab } from '@/app/tabs'
import { IS_TAURI } from '@open-pencil/core/constants'

import type { EditorStore } from '@/app/editor/active-store'

export async function handleSaveFile(store: EditorStore): Promise<unknown> {
  await store.saveFigFile()
  return { ok: true }
}

export async function handleNewDocument(_store: EditorStore, args: unknown): Promise<unknown> {
  const path = (args as { path?: string }).path
  const tab = createTab()
  if (path) {
    tab.store.setPlannedFilePath(path)
    if (IS_TAURI) {
      const { mkdir } = await import('@tauri-apps/plugin-fs')
      const dir = path.replace(/[\\/][^\\/]+$/, '')
      await mkdir(dir, { recursive: true })
    }
    await tab.store.saveFigFile()
    tab.store.startWatchingCurrentFile()
  }
  return { ok: true }
}

export async function handleOpenFile(_store: EditorStore, args: unknown): Promise<unknown> {
  const path = (args as { path?: string }).path
  if (!path) throw new Error('Missing "path" in args')
  if (IS_TAURI) {
    await openFileFromPath(path)
  } else {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`)
    const name = path.split(/[\\/]/).pop() ?? 'file.fig'
    const file = new File([await response.blob()], name)
    await openFileInNewTab(file, undefined, path)
  }
  return { ok: true }
}
