import { useLocalStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  IS_BROWSER,
  IS_TAURI,
} from '@open-pencil/core/constants'
import { setPexelsApiKey, setUnsplashAccessKey } from '@open-pencil/core/tools'

import type { AIProviderID } from '@open-pencil/core/constants'

const STORAGE_PREFIX = 'open-pencil:'
const LEGACY_KEY_STORAGE = `${STORAGE_PREFIX}openrouter-api-key`

export function keyStorageKey(id: string) {
  return `${STORAGE_PREFIX}ai-key:${id}`
}

function migrateLegacyStorage() {
  const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE)
  if (legacyKey) {
    localStorage.setItem(keyStorageKey('openrouter'), legacyKey)
    localStorage.removeItem(LEGACY_KEY_STORAGE)
    if (!localStorage.getItem(`${STORAGE_PREFIX}ai-provider`)) {
      localStorage.setItem(`${STORAGE_PREFIX}ai-provider`, 'openrouter')
    }
  }
}

if (IS_BROWSER) migrateLegacyStorage()

export const providerID = useLocalStorage<AIProviderID>(
  `${STORAGE_PREFIX}ai-provider`,
  DEFAULT_AI_PROVIDER
)
const apiKeyStorageKey = computed(() => keyStorageKey(providerID.value))
export const apiKey = useLocalStorage(apiKeyStorageKey, '')
export const modelID = useLocalStorage(`${STORAGE_PREFIX}ai-model`, DEFAULT_AI_MODEL)
export const customBaseURL = useLocalStorage(`${STORAGE_PREFIX}ai-base-url`, '')
export const customModelID = useLocalStorage(`${STORAGE_PREFIX}ai-custom-model`, '')
export const customAPIType = useLocalStorage<'completions' | 'responses'>(
  `${STORAGE_PREFIX}ai-api-type`,
  'completions'
)
export const maxOutputTokens = useLocalStorage(`${STORAGE_PREFIX}ai-max-output-tokens`, 16384)
export const pexelsApiKey = useLocalStorage(`${STORAGE_PREFIX}pexels-api-key`, '')
export const unsplashAccessKey = useLocalStorage(`${STORAGE_PREFIX}unsplash-access-key`, '')

export const providerDef = computed(
  () => AI_PROVIDERS.find((p) => p.id === providerID.value) ?? AI_PROVIDERS[0]
)

export const isACPProvider = computed(() => providerID.value.startsWith('acp:'))

export const isConfigured = computed(() => {
  if (isACPProvider.value) return IS_TAURI
  if (!apiKey.value) return false
  const needsBaseURL =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  if (needsBaseURL && !customBaseURL.value) return false
  return true
})

export function setAPIKey(key: string) {
  apiKey.value = key
}

export function registerAIChatEffects(markTransportDirty: () => void) {
  watch(
    pexelsApiKey,
    (key) => {
      setPexelsApiKey(key || null)
    },
    { immediate: true }
  )

  watch(
    unsplashAccessKey,
    (key) => {
      setUnsplashAccessKey(key || null)
    },
    { immediate: true }
  )

  watch(providerID, (id) => {
    const def = AI_PROVIDERS.find((p) => p.id === id)
    if (def?.defaultModel) {
      modelID.value = def.defaultModel
    }
    markTransportDirty()
  })

  watch(modelID, markTransportDirty)
  watch(customModelID, markTransportDirty)
  watch(customAPIType, markTransportDirty)
  watch(apiKey, markTransportDirty)
  watch(customBaseURL, markTransportDirty)
}
