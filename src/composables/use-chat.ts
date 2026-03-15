import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { useLocalStorage } from '@vueuse/core'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import { computed, ref, watch } from 'vue'

import SYSTEM_PROMPT from '@/ai/system-prompt.md?raw'
import { MAX_AGENT_STEPS, createAITools, recordStepUsage, resetRunSteps } from '@/ai/tools'
import { useEditorStore } from '@/stores/editor'
import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  setPexelsApiKey,
  setUnsplashAccessKey
} from '@open-pencil/core'

import type { AIProviderID } from '@open-pencil/core'
import type { LanguageModel, UIMessage } from 'ai'

const STORAGE_PREFIX = 'open-pencil:'
const LEGACY_KEY_STORAGE = `${STORAGE_PREFIX}openrouter-api-key`

function keyStorageKey(id: string) {
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

if (typeof window !== 'undefined') migrateLegacyStorage()

const providerID = useLocalStorage<AIProviderID>(
  `${STORAGE_PREFIX}ai-provider`,
  DEFAULT_AI_PROVIDER
)
const apiKeyStorageKey = computed(() => keyStorageKey(providerID.value))
const apiKey = useLocalStorage(apiKeyStorageKey, '')
const modelID = useLocalStorage(`${STORAGE_PREFIX}ai-model`, DEFAULT_AI_MODEL)
const customBaseURL = useLocalStorage(`${STORAGE_PREFIX}ai-base-url`, '')
const customModelID = useLocalStorage(`${STORAGE_PREFIX}ai-custom-model`, '')
const customAPIType = useLocalStorage<'completions' | 'responses'>(
  `${STORAGE_PREFIX}ai-api-type`,
  'completions'
)
const maxOutputTokens = useLocalStorage(`${STORAGE_PREFIX}ai-max-output-tokens`, 16384)
const pexelsApiKey = useLocalStorage(`${STORAGE_PREFIX}pexels-api-key`, '')
const unsplashAccessKey = useLocalStorage(`${STORAGE_PREFIX}unsplash-access-key`, '')
const activeTab = ref<'design' | 'ai'>('design')

const providerDef = computed(
  () => AI_PROVIDERS.find((p) => p.id === providerID.value) ?? AI_PROVIDERS[0]
)

const isConfigured = computed(() => {
  if (!apiKey.value) return false
  const needsBaseURL =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  if (needsBaseURL && !customBaseURL.value) return false
  return true
})

let transportDirty = false

function markTransportDirty() {
  transportDirty = true
}

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

function setAPIKey(key: string) {
  apiKey.value = key
}

function createModel(): LanguageModel {
  const key = apiKey.value
  const needsCustomModel =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  const effectiveModelID = needsCustomModel ? customModelID.value : modelID.value

  switch (providerID.value) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: key,
        headers: {
          'X-OpenRouter-Title': 'OpenPencil',
          'HTTP-Referer': 'https://github.com/open-pencil/open-pencil'
        }
      })
      return openrouter(effectiveModelID)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: key })
      return anthropic(effectiveModelID)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: key })
      return openai(effectiveModelID)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: key })
      return google(effectiveModelID)
    }
    case 'zai': {
      const zai = createOpenAI({
        apiKey: key,
        baseURL: 'https://api.z.ai/api/paas/v4'
      })
      return zai.chat(effectiveModelID)
    }
    case 'minimax': {
      const minimax = createOpenAI({
        apiKey: key,
        baseURL: 'https://api.minimax.io/v1'
      })
      return minimax.chat(effectiveModelID)
    }
    case 'openai-compatible': {
      const custom = createOpenAI({
        apiKey: key,
        baseURL: customBaseURL.value
      })
      return customAPIType.value === 'responses'
        ? custom.responses(effectiveModelID)
        : custom.chat(effectiveModelID)
    }
    case 'anthropic-compatible': {
      const custom = createAnthropic({
        apiKey: key,
        baseURL: customBaseURL.value
      })
      return custom(effectiveModelID)
    }
    default: {
      const _exhaustive: never = providerID.value
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only mock transports don't implement full generics
let overrideTransport: (() => any) | null = null

let chat: Chat<UIMessage> | null = null

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

function supportsAnthropicCaching(): boolean {
  return (
    providerID.value === 'anthropic' ||
    providerID.value === 'anthropic-compatible' ||
    (providerID.value === 'openrouter' && modelID.value.startsWith('anthropic/'))
  )
}

function createTransport() {
  if (overrideTransport) return overrideTransport()

  const tools = createAITools(useEditorStore())
  const cacheProviderOptions = supportsAnthropicCaching() ? ANTHROPIC_CACHE_CONTROL : undefined

  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens: maxOutputTokens.value,
    providerOptions: cacheProviderOptions,
    prepareCall: (options) => {
      resetRunSteps()
      return {
        ...options,
        maxOutputTokens: maxOutputTokens.value,
        providerOptions: cacheProviderOptions
      }
    },
    onStepFinish: ({ usage }) => {
      recordStepUsage({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
        timestamp: Date.now()
      })
    }
  })

  return new DirectChatTransport({ agent })
}

function ensureChat(): Chat<UIMessage> | null {
  if (!isConfigured.value) return null
  if (!chat) {
    chat = new Chat<UIMessage>({ transport: createTransport() })
    transportDirty = false
  } else if (transportDirty) {
    const messages = chat.messages
    chat = new Chat<UIMessage>({ transport: createTransport(), messages })
    transportDirty = false
  }
  return chat
}

function resetChat() {
  chat = null
  transportDirty = false
}

if (typeof window !== 'undefined') {
  window.__OPEN_PENCIL_SET_TRANSPORT__ = (factory) => {
    overrideTransport = factory
  }
}

export function useAIChat() {
  return {
    providerID,
    providerDef,
    apiKey,
    setAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    customAPIType,
    maxOutputTokens,
    pexelsApiKey,
    unsplashAccessKey,
    activeTab,
    isConfigured,
    ensureChat,
    resetChat
  }
}
