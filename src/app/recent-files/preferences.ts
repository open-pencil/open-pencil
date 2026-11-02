import { computed } from 'vue'

import { appRuntimeConfig } from '@/app/runtime/config'
import { appPreferences } from '@/app/settings/preferences/store'
import { isTauri } from '@/app/tauri/env'

import { resolveRecentFilesLimit } from './limit'

export const recentFilesLimit = computed({
  get: () => resolveRecentFilesLimit(appPreferences.value.files.recentLimit),
  set: (value: number) => {
    appPreferences.value = {
      ...appPreferences.value,
      files: { ...appPreferences.value.files, recentLimit: resolveRecentFilesLimit(value) }
    }
  }
})

/** Whether the app shows recent files: always on desktop, in the browser only with `?recent-files`. */
export function recentFilesAvailable(): boolean {
  return isTauri() || appRuntimeConfig.recentFiles
}
