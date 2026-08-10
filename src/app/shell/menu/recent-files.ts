import { useLocalStorage } from '@vueuse/core'

import { isTauri } from '@/app/tauri/env'

const MAX_RECENT_FILES = 10
const RECENT_FILES_STORAGE_KEY = 'open-pencil:recent-files'

export const OPEN_RECENT_EVENT_PREFIX = 'open-recent:'
export const recentFilePaths = useLocalStorage<string[]>(RECENT_FILES_STORAGE_KEY, [])

function normalizedRecentFiles(): string[] {
  return recentFilePaths.value
    .filter((path): path is string => typeof path === 'string' && path.length > 0)
    .slice(0, MAX_RECENT_FILES)
}

export async function syncRecentFilesMenu(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_recent_files', { paths: normalizedRecentFiles() })
}

function updateRecentFiles(paths: string[]): void {
  recentFilePaths.value = paths.slice(0, MAX_RECENT_FILES)
  void syncRecentFilesMenu().catch((error) => {
    console.warn('[Recent files] Failed to update the native menu', error)
  })
}

export function rememberRecentFile(path: string): void {
  updateRecentFiles([path, ...normalizedRecentFiles().filter((recent) => recent !== path)])
}

export function forgetRecentFile(path: string): void {
  updateRecentFiles(normalizedRecentFiles().filter((recent) => recent !== path))
}

export function clearRecentFiles(): void {
  updateRecentFiles([])
}

export function recentFileAt(index: number): string | null {
  return normalizedRecentFiles()[index] ?? null
}
