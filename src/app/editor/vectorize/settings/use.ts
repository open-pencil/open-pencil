import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch, type Ref } from 'vue'

import {
  setVectorizeCredential,
  vectorizeCredentialStatus,
  vectorizeProviderID,
  VECTORIZE_PROVIDER_DEFINITIONS,
  type VectorizeProviderID
} from '@/app/editor/vectorize'
import { settingsErrorMessage } from '@/app/settings/credentials/errors'
import type { CredentialStatus } from '@/app/settings/credentials/types'

const vectorizeServices = { status: vectorizeCredentialStatus, set: setVectorizeCredential }

export function useVectorizeSettings(
  keyDraft: Ref<string>,
  selectedProvider: Readonly<Ref<VectorizeProviderID>> = vectorizeProviderID,
  services = vectorizeServices
) {
  const keyStatus = ref<CredentialStatus>('missing')
  const error = ref('')

  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
    version++
    keyDraft.value = ''
  })

  const provider = computed(() =>
    VECTORIZE_PROVIDER_DEFINITIONS.find((definition) => definition.id === selectedProvider.value)
  )
  const providerOptions = VECTORIZE_PROVIDER_DEFINITIONS.map((definition) => ({
    value: definition.id,
    label: definition.name
  }))

  async function refreshStatus(): Promise<void> {
    const request = ++version
    const id = selectedProvider.value

    try {
      const status = await services.status(id)
      if (!isDisposed() && version === request) keyStatus.value = status
    } catch (cause) {
      if (!isDisposed() && version === request) error.value = settingsErrorMessage(cause)
    }
  }

  function isDisposed() {
    return disposed
  }

  async function updateCredential(clear: boolean): Promise<boolean> {
    const value = keyDraft.value
    if (isDisposed()) return false
    if (!clear && !value.trim()) return true

    const request = ++version
    const id = selectedProvider.value
    error.value = ''

    try {
      await services.set(id, clear ? '' : value)
      if (isDisposed() || version !== request) return false
      if (keyDraft.value === value) keyDraft.value = ''
      await refreshStatus()
      return !isDisposed()
    } catch (cause) {
      if (!isDisposed() && version === request) error.value = settingsErrorMessage(cause)
      return false
    }
  }

  watch(
    selectedProvider,
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
