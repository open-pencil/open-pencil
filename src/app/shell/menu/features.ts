import { invoke } from '@tauri-apps/api/core'
import { computed, watch } from 'vue'

import { isCloudBinding } from '@/app/cloud/integration'
import { useEditorStore } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'

import type { AppMenuFeature } from './schema'

const store = useEditorStore()

const available: Record<AppMenuFeature, () => boolean> = {
  // Cloud and storage documents always save; auto-save is a choice only for a file on disk.
  'local-file': () => store.hasWritableSource() && !store.getStorageBinding(),
  // Version history lives on the Cloud server that keeps the document.
  'cloud-document': () => isCloudBinding(store.getStorageBinding())
}

/** Whether a menu item that waits for a feature shows; items without one always do. */
export function menuFeatureAvailable(feature: AppMenuFeature | undefined): boolean {
  return feature === undefined || available[feature]()
}

const availableFeatures = computed(() =>
  (Object.keys(available) as AppMenuFeature[]).filter((feature) => available[feature]())
)

/** Keeps the desktop menu's feature items in step: it builds them only once told they're on. */
export function watchNativeMenuFeatures(): () => void {
  return watch(
    availableFeatures,
    (features) => {
      if (!isTauri()) return
      invoke('set_native_menu_features', { features }).catch((error: unknown) => {
        console.warn('[Menu] Failed to update the native menu', error)
      })
    },
    { immediate: true }
  )
}
