import { watchDebounced } from '@vueuse/core'
import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import { dialogMessages } from '@open-pencil/vue'

import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import { vectorizeProviderLabel, type VectorizeProviderId } from '@/app/ai/chat/storage'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'

function createProviderSettingsContext() {
  const {
    providerID,
    providerDef,
    apiKey,
    setAPIKey,
    customBaseURL,
    customModelID,
    modelID,
    customAPIType,
    maxOutputTokens,
    pexelsApiKey,
    unsplashAccessKey,
    vectorizeProvider,
    recraftApiKey,
    falApiKey
  } = useAIChat()

  const isACP = computed(() => providerID.value.startsWith('acp:'))
  const keyInput = ref('')
  const pexelsKeyInput = ref('')
  const unsplashKeyInput = ref('')
  const recraftKeyInput = ref('')
  const falKeyInput = ref('')
  const baseURLInput = ref(customBaseURL.value)
  const customModelInput = ref(customModelID.value)
  const hasExistingKey = ref(!!apiKey.value)
  const hasExistingPexelsKey = ref(!!pexelsApiKey.value)
  const hasExistingUnsplashKey = ref(!!unsplashAccessKey.value)
  const hasExistingRecraftKey = ref(!!recraftApiKey.value)
  const hasExistingFalKey = ref(!!falApiKey.value)
  const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
  const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

  const effectiveAPIKey = computed(() => keyInput.value.trim() || apiKey.value)
  const canTestConnection = computed(() => {
    if (isACP.value) return false
    if (!effectiveAPIKey.value.trim()) return false
    if (providerDef.value.supportsCustomBaseURL && !baseURLInput.value.trim()) return false
    if (providerDef.value.supportsCustomModel && !customModelInput.value.trim()) return false
    return true
  })

  function resetConnectionTest() {
    connectionTestStatus.value = 'idle'
    connectionTestReason.value = null
  }

  watch(providerID, () => {
    keyInput.value = ''
    hasExistingKey.value = !!apiKey.value
    baseURLInput.value = customBaseURL.value
    customModelInput.value = customModelID.value
    resetConnectionTest()
  })

  watch([keyInput, baseURLInput, customModelInput, customAPIType], resetConnectionTest)

  watch(recraftApiKey, (value) => {
    hasExistingRecraftKey.value = !!value
  })

  watch(falApiKey, (value) => {
    hasExistingFalKey.value = !!value
  })

  function notifyVectorizeKeySaved(provider: VectorizeProviderId) {
    const dialogs = dialogMessages.get()
    toast.info(dialogs.vectorizeKeySaved({ provider: vectorizeProviderLabel(provider) }))
  }

  function persistRecraftKey(notify: boolean): boolean {
    const trimmed = recraftKeyInput.value.trim()
    if (!trimmed) return false
    const changed = trimmed !== recraftApiKey.value
    recraftApiKey.value = trimmed
    hasExistingRecraftKey.value = true
    if (notify && changed) notifyVectorizeKeySaved('recraft')
    return changed
  }

  function persistFalKey(notify: boolean): boolean {
    const trimmed = falKeyInput.value.trim()
    if (!trimmed) return false
    const changed = trimmed !== falApiKey.value
    falApiKey.value = trimmed
    hasExistingFalKey.value = true
    if (notify && changed) notifyVectorizeKeySaved('fal')
    return changed
  }

  watchDebounced(recraftKeyInput, () => persistRecraftKey(true), { debounce: 800 })
  watchDebounced(falKeyInput, () => persistFalKey(true), { debounce: 800 })

  function save() {
    if (keyInput.value.trim()) {
      setAPIKey(keyInput.value.trim())
      hasExistingKey.value = true
      keyInput.value = ''
    }
    if (pexelsKeyInput.value.trim()) {
      pexelsApiKey.value = pexelsKeyInput.value.trim()
      hasExistingPexelsKey.value = true
      pexelsKeyInput.value = ''
    }
    if (unsplashKeyInput.value.trim()) {
      unsplashAccessKey.value = unsplashKeyInput.value.trim()
      hasExistingUnsplashKey.value = true
      unsplashKeyInput.value = ''
    }
    if (persistRecraftKey(true)) recraftKeyInput.value = ''
    if (persistFalKey(true)) falKeyInput.value = ''
    if (providerDef.value.supportsCustomBaseURL) {
      customBaseURL.value = baseURLInput.value.trim()
    }
    if (providerDef.value.supportsCustomModel) {
      customModelID.value = customModelInput.value.trim()
    }
  }

  function clearKey() {
    setAPIKey('')
    keyInput.value = ''
    hasExistingKey.value = false
  }

  function clearPexelsKey() {
    pexelsApiKey.value = ''
    pexelsKeyInput.value = ''
    hasExistingPexelsKey.value = false
  }

  function clearUnsplashKey() {
    unsplashAccessKey.value = ''
    unsplashKeyInput.value = ''
    hasExistingUnsplashKey.value = false
  }

  function clearRecraftKey() {
    recraftApiKey.value = ''
    recraftKeyInput.value = ''
    hasExistingRecraftKey.value = false
  }

  function clearFalKey() {
    falApiKey.value = ''
    falKeyInput.value = ''
    hasExistingFalKey.value = false
  }

  function setCustomAPIType(value: string) {
    customAPIType.value = value as 'completions' | 'responses'
    save()
  }

  async function testConnection() {
    if (connectionTestStatus.value === 'testing') return
    connectionTestStatus.value = 'testing'
    connectionTestReason.value = null

    const result = await testProviderConnection({
      providerID: providerID.value,
      apiKey: effectiveAPIKey.value,
      modelID: modelID.value,
      customModelID: providerDef.value.supportsCustomModel
        ? customModelInput.value.trim()
        : customModelID.value,
      customBaseURL: providerDef.value.supportsCustomBaseURL
        ? baseURLInput.value.trim()
        : customBaseURL.value,
      customAPIType: customAPIType.value
    })

    if (result.ok) {
      connectionTestStatus.value = 'success'
      connectionTestReason.value = null
      return
    }

    connectionTestStatus.value = 'error'
    connectionTestReason.value = result.reason
  }

  return {
    providerID,
    providerDef,
    apiKey,
    modelID,
    customAPIType,
    customBaseURL,
    customModelID,
    maxOutputTokens,
    pexelsApiKey,
    unsplashAccessKey,
    vectorizeProvider,
    recraftApiKey,
    falApiKey,
    isACP,
    keyInput,
    pexelsKeyInput,
    unsplashKeyInput,
    recraftKeyInput,
    falKeyInput,
    baseURLInput,
    customModelInput,
    hasExistingKey,
    hasExistingPexelsKey,
    hasExistingUnsplashKey,
    hasExistingRecraftKey,
    hasExistingFalKey,
    connectionTestStatus,
    connectionTestReason,
    canTestConnection,
    save,
    clearKey,
    clearPexelsKey,
    clearUnsplashKey,
    clearRecraftKey,
    clearFalKey,
    setCustomAPIType,
    testConnection,
    saveVectorizeKeys: () => {
      persistRecraftKey(true)
      persistFalKey(true)
    }
  }
}

export type ProviderSettingsContext = ShallowUnwrapRef<
  ReturnType<typeof createProviderSettingsContext>
>

const PROVIDER_SETTINGS_KEY: InjectionKey<ProviderSettingsContext> =
  Symbol('ProviderSettingsContext')

export function provideProviderSettings() {
  const ctx = proxyRefs(createProviderSettingsContext())
  provide(PROVIDER_SETTINGS_KEY, ctx)
  return ctx
}

export function useProviderSettingsContext(): ProviderSettingsContext {
  const ctx = inject(PROVIDER_SETTINGS_KEY)
  if (!ctx) throw new Error('Provider settings controls must be used within ProviderSettings')
  return ctx
}
