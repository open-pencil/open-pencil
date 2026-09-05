import { computed, onMounted, ref, watch, type Ref } from 'vue'

import {
  setVectorizeCredential,
  vectorizeCredentialStatus,
  vectorizeProviderID,
  VECTORIZE_PROVIDER_DEFINITIONS
} from '@/app/editor/vectorize'
export function useVectorizeSettings(keyDraft: Ref<string>) {
  const keyStatus = ref<'configured' | 'missing' | 'unavailable' | 'locked'>('missing')
  const provider = computed(() =>
    VECTORIZE_PROVIDER_DEFINITIONS.find((definition) => definition.id === vectorizeProviderID.value)
  )
  const providerOptions = VECTORIZE_PROVIDER_DEFINITIONS.map((definition) => ({
    value: definition.id,
    label: definition.name
  }))
  async function refreshStatus(): Promise<void> {
    const providerID = vectorizeProviderID.value
    const status = await vectorizeCredentialStatus(providerID)
    if (vectorizeProviderID.value === providerID) keyStatus.value = status
  }
  async function saveCredential(): Promise<void> {
    if (!keyDraft.value.trim()) return
    await setVectorizeCredential(vectorizeProviderID.value, keyDraft.value)
    keyDraft.value = ''
    await refreshStatus()
  }
  async function clearCredential(): Promise<void> {
    await setVectorizeCredential(vectorizeProviderID.value, '')
    keyDraft.value = ''
    await refreshStatus()
  }
  watch(vectorizeProviderID, () => {
    keyDraft.value = ''
    void refreshStatus()
  })
  onMounted(() => void refreshStatus())

  return { keyStatus, provider, providerOptions, saveCredential, clearCredential }
}
