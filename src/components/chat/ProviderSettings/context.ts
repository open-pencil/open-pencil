import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import { useAIChat } from '@/app/ai/chat/use'

function createProviderSettingsContext() {
  const {
    providerID,
    providerDef,
    apiKey,
    setAPIKey,
    customBaseURL,
    customModelID,
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

  watch(providerID, () => {
    keyInput.value = ''
    hasExistingKey.value = !!apiKey.value
    baseURLInput.value = customBaseURL.value
    customModelInput.value = customModelID.value
  })

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
    if (recraftKeyInput.value.trim()) {
      recraftApiKey.value = recraftKeyInput.value.trim()
      hasExistingRecraftKey.value = true
      recraftKeyInput.value = ''
    }
    if (falKeyInput.value.trim()) {
      falApiKey.value = falKeyInput.value.trim()
      hasExistingFalKey.value = true
      falKeyInput.value = ''
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

  return {
    providerID,
    providerDef,
    apiKey,
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
    save,
    clearKey,
    clearPexelsKey,
    clearUnsplashKey,
    clearRecraftKey,
    clearFalKey,
    setCustomAPIType
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
