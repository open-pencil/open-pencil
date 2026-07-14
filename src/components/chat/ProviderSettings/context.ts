import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import { providerRequiresCustomModelID } from '@/app/ai/chat/model'
import { useAIChat } from '@/app/ai/chat/use'

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
    unsplashAccessKey
  } = useAIChat()

  const isACP = computed(() => providerID.value.startsWith('acp:'))
  const keyInput = ref('')
  const pexelsKeyInput = ref('')
  const unsplashKeyInput = ref('')
  const baseURLInput = ref(customBaseURL.value)
  const customModelInput = ref(customModelID.value)
  const hasExistingKey = ref(!!apiKey.value)
  const hasExistingPexelsKey = ref(!!pexelsApiKey.value)
  const hasExistingUnsplashKey = ref(!!unsplashAccessKey.value)
  const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
  const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

  const effectiveAPIKey = computed(() => keyInput.value.trim() || apiKey.value)
  const canTestConnection = computed(() => {
    if (isACP.value) return false
    if (!effectiveAPIKey.value.trim()) return false
    if (providerDef.value.supportsCustomBaseURL && !baseURLInput.value.trim()) return false
    if (
      providerRequiresCustomModelID(providerID.value, providerDef.value) &&
      !customModelInput.value.trim()
    ) {
      return false
    }
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
    isACP,
    keyInput,
    pexelsKeyInput,
    unsplashKeyInput,
    baseURLInput,
    customModelInput,
    hasExistingKey,
    hasExistingPexelsKey,
    hasExistingUnsplashKey,
    connectionTestStatus,
    connectionTestReason,
    canTestConnection,
    save,
    clearKey,
    clearPexelsKey,
    clearUnsplashKey,
    setCustomAPIType,
    testConnection
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
