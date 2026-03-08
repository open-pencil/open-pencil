import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import dedent from 'dedent'
import { computed, ref, watch } from 'vue'

import { createAITools } from '@/ai/tools'
import { useEditorStore } from '@/stores/editor'
import { AI_PROVIDERS, DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER } from '@open-pencil/core'

import type { AIProviderId } from '@open-pencil/core'
import type { LanguageModel, UIMessage } from 'ai'

export { AI_PROVIDERS } from '@open-pencil/core'
export type { AIProviderDef, AIProviderId, ModelOption } from '@open-pencil/core'

const STORAGE_PREFIX = 'open-pencil:'
const PROVIDER_STORAGE = `${STORAGE_PREFIX}ai-provider`
const MODEL_STORAGE = `${STORAGE_PREFIX}ai-model`
const BASE_URL_STORAGE = `${STORAGE_PREFIX}ai-base-url`
const CUSTOM_MODEL_STORAGE = `${STORAGE_PREFIX}ai-custom-model`
const LEGACY_KEY_STORAGE = `${STORAGE_PREFIX}openrouter-api-key`

function keyStorageKey(providerId: AIProviderId) {
  return `${STORAGE_PREFIX}ai-key:${providerId}`
}

function migrateLegacyStorage() {
  const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE)
  if (legacyKey) {
    localStorage.setItem(keyStorageKey('openrouter'), legacyKey)
    localStorage.removeItem(LEGACY_KEY_STORAGE)
    if (!localStorage.getItem(PROVIDER_STORAGE)) {
      localStorage.setItem(PROVIDER_STORAGE, 'openrouter')
    }
  }
}

if (typeof window !== 'undefined') migrateLegacyStorage()

const SYSTEM_PROMPT = dedent`
  You are a design assistant inside OpenPencil, a Figma-like design editor.
  Help users create and modify designs. Be concise and direct.
  When describing changes, use specific design terminology.

  Available node types: FRAME (containers/cards), RECTANGLE, ELLIPSE, TEXT, LINE, STAR, POLYGON, SECTION.
  Colors can be hex strings (#ff0000) or RGBA objects with values 0–1.
  Coordinates use canvas space — (0, 0) is the top-left of the page.

  Always use tools to make changes. After creating nodes, briefly describe what you did.
  When the user asks to create a layout, use create_shape with FRAME, then set_layout for auto-layout.
`

const providerId = ref<AIProviderId>(
  (localStorage.getItem(PROVIDER_STORAGE) as AIProviderId) || DEFAULT_AI_PROVIDER
)
const apiKey = ref(localStorage.getItem(keyStorageKey(providerId.value)) ?? '')
const modelId = ref(localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_AI_MODEL)
const customBaseUrl = ref(localStorage.getItem(BASE_URL_STORAGE) ?? '')
const customModelId = ref(localStorage.getItem(CUSTOM_MODEL_STORAGE) ?? '')
const activeTab = ref<'design' | 'ai'>('design')

const providerDef = computed(
  () => AI_PROVIDERS.find((p) => p.id === providerId.value) ?? AI_PROVIDERS[0]
)

const isConfigured = computed(() => {
  if (!apiKey.value) return false
  if (providerId.value === 'openai-compatible' && !customBaseUrl.value) return false
  return true
})

watch(providerId, (id) => {
  localStorage.setItem(PROVIDER_STORAGE, id)
  apiKey.value = localStorage.getItem(keyStorageKey(id)) ?? ''
  const def = AI_PROVIDERS.find((p) => p.id === id)
  if (def?.defaultModel) {
    modelId.value = def.defaultModel
  }
  resetChat()
})

watch(apiKey, (key) => {
  if (key) {
    localStorage.setItem(keyStorageKey(providerId.value), key)
  } else {
    localStorage.removeItem(keyStorageKey(providerId.value))
  }
})

watch(modelId, (id) => {
  localStorage.setItem(MODEL_STORAGE, id)
  resetChat()
})

watch(customBaseUrl, (url) => {
  if (url) localStorage.setItem(BASE_URL_STORAGE, url)
  else localStorage.removeItem(BASE_URL_STORAGE)
})

watch(customModelId, (id) => {
  if (id) localStorage.setItem(CUSTOM_MODEL_STORAGE, id)
  else localStorage.removeItem(CUSTOM_MODEL_STORAGE)
  resetChat()
})

function setApiKey(key: string) {
  apiKey.value = key
}

function createModel(): LanguageModel {
  const key = apiKey.value
  const effectiveModelId =
    providerId.value === 'openai-compatible' ? customModelId.value : modelId.value

  switch (providerId.value) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: key,
        headers: {
          'X-OpenRouter-Title': 'OpenPencil',
          'HTTP-Referer': 'https://github.com/open-pencil/open-pencil'
        }
      })
      return openrouter(effectiveModelId)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: key })
      return anthropic(effectiveModelId)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: key })
      return openai(effectiveModelId)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: key })
      return google(effectiveModelId)
    }
    case 'openai-compatible': {
      const custom = createOpenAI({
        apiKey: key,
        baseURL: customBaseUrl.value
      })
      return custom(effectiveModelId)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only mock transports don't implement full generics
let overrideTransport: (() => any) | null = null

let chat: Chat<UIMessage> | null = null

function createTransport() {
  if (overrideTransport) return overrideTransport()

  const tools = createAITools(useEditorStore())

  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions: SYSTEM_PROMPT,
    tools
  })

  return new DirectChatTransport({ agent })
}

function ensureChat(): Chat<UIMessage> | null {
  if (!isConfigured.value) return null
  if (!chat) {
    chat = new Chat<UIMessage>({
      transport: createTransport()
    })
  }
  return chat
}

function resetChat() {
  chat = null
}

if (typeof window !== 'undefined') {
  window.__OPEN_PENCIL_SET_TRANSPORT__ = (factory) => {
    overrideTransport = factory
  }
}

export function useAIChat() {
  return {
    providerId,
    providerDef,
    apiKey,
    setApiKey,
    modelId,
    customBaseUrl,
    customModelId,
    activeTab,
    isConfigured,
    ensureChat,
    resetChat
  }
}
