import { useStorage } from '@vueuse/core'

import type { CloudLocale } from './locale'

export const CLOUD_LOCALE_STORAGE_KEY = 'open-pencil-cloud-locale'

export function useStoredCloudLocale() {
  return useStorage<CloudLocale | undefined>(CLOUD_LOCALE_STORAGE_KEY, undefined)
}
