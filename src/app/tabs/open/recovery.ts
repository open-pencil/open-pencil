import { createGlobalState } from '@vueuse/core'
import { readonly, ref, shallowRef } from 'vue'

import type { StorageDocument, StorageDocumentBinding } from '@/app/integrations/storage/types'

export type StorageOpenTarget = { document: StorageDocument; binding: StorageDocumentBinding }

/** A failed open retains its owner independently of navigation or an invitation token. */
export function createStorageOpenRecovery() {
  const target = shallowRef<StorageOpenTarget | null>(null)
  const retrying = ref(false)
  function dismiss() {
    target.value = null
  }
  function failed(value: StorageOpenTarget) {
    target.value = { document: { ...value.document }, binding: { ...value.binding } }
  }
  function opened(binding: StorageDocumentBinding) {
    const previous = target.value?.binding
    if (
      previous?.providerId === binding.providerId &&
      previous.documentId === binding.documentId &&
      previous.connectionId === binding.connectionId
    )
      dismiss()
  }
  async function retry(open: (target: StorageOpenTarget) => Promise<void>) {
    if (!target.value || retrying.value) return { ok: false as const }
    const captured = target.value
    retrying.value = true
    try {
      await open(captured)
      if (target.value === captured) dismiss()
      return { ok: true as const }
    } catch {
      // Preserve a visible failure outcome instead of rejecting a UI event handler.
      return { ok: false as const }
    } finally {
      retrying.value = false
    }
  }
  return { target: readonly(target), retrying: readonly(retrying), failed, opened, dismiss, retry }
}
export const useStorageOpenRecovery = createGlobalState(createStorageOpenRecovery)
