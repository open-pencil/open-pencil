import { ref } from 'vue'

import type { EditorStore } from '@/app/editor/session'

import { cloudShareTarget } from './document'

/** The open document's Cloud share dialog, opened from the Share button or its status. */
export const cloudShareOpen = ref(false)

/**
 * Opens the share dialog of the Cloud document in `store`, as the mobile Share button does;
 * false when there is nothing to share yet, such as while signed out of its server.
 */
export function openCloudShare(store: EditorStore): boolean {
  const binding = store.getStorageBinding()
  if (!binding || !cloudShareTarget(binding)) return false
  cloudShareOpen.value = true
  return true
}
