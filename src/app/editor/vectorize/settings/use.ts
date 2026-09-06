import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch, type Ref } from 'vue'

import {
  setVectorizeCredential,
  vectorizeCredentialStatus,
  vectorizeProviderID,
  VECTORIZE_PROVIDER_DEFINITIONS
} from '@/app/editor/vectorize'
import type { CredentialStatus } from '@/app/settings/credentials/types'

const vectorizeServices = { status: vectorizeCredentialStatus, set: setVectorizeCredential }

export function useVectorizeSettings(keyDraft: Ref<string>, services = vectorizeServices) {
  const keyStatus = ref<CredentialStatus>('missing')
  const error = ref('')

  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
    version++
  })

  const provider = computed(() =>
    VECTORIZE_PROVIDER_DEFINITIONS.find((definition) => definition.id === vectorizeProviderID.value)
  )
  const providerOptions = VECTORIZE_PROVIDER_DEFINITIONS.map((definition) => ({
    value: definition.id,
    label: definition.name
  }))

  async function refreshStatus(): Promise<void> {
    const request = ++version
    const id = vectorizeProviderID.value

    try {
      const status = await services.status(id)
      if (!disposed && version === request) keyStatus.value = status
    } catch (cause) {
      if (!disposed && version === request)
        error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  async function updateCredential(clear: boolean): Promise<void> {
    const value = keyDraft.value
    if (!clear && !value.trim()) return

    const request = ++version
    const id = vectorizeProviderID.value
    error.value = ''

    try {
      await services.set(id, clear ? '' : value)
      if (disposed || version !== request) return
      if (keyDraft.value === value) keyDraft.value = ''
      await refreshStatus()
    } catch (cause) {
      if (!disposed && version === request)
        error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  watch(
    vectorizeProviderID,
    () => {
      keyDraft.value = ''
      keyStatus.value = 'missing'
      error.value = ''
      void refreshStatus()
    },
    { immediate: true, flush: 'sync' }
  )

  return {
    keyStatus,
    error,
    provider,
    providerOptions,
    saveCredential: () => updateCredential(false),
    clearCredential: () => updateCredential(true)
  }
}
