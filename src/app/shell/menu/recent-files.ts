import { watch } from 'vue'

import { recentLocalFilePaths } from '@/app/recent-files'
import { isTauri } from '@/app/tauri/env'

export const OPEN_RECENT_EVENT_PREFIX = 'open-recent:'

export async function syncRecentFilesMenu(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_recent_files', { paths: recentLocalFilePaths.value })
}

export function watchRecentFilesMenu(): () => void {
  return watch(
    recentLocalFilePaths,
    () => {
      void syncRecentFilesMenu().catch((error) => {
        console.warn('[Recent files] Failed to update the native menu', error)
      })
    },
    { immediate: true }
  )
}
