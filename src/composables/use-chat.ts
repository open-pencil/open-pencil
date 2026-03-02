import { Chat } from '@ai-sdk/vue'
import { AI_MODELS, DEFAULT_AI_MODEL } from '@open-pencil/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import dedent from 'dedent'
import { computed, ref, watch } from 'vue'

import { createAITools } from '@/ai/tools'

import type { EditorStore } from '@/stores/editor'
import type { UIMessage } from 'ai'

export { AI_MODELS as MODELS } from '@open-pencil/core'
export type { ModelOption } from '@open-pencil/core'

const API_KEY_STORAGE = 'open-pencil:openrouter-api-key'
const MODEL_STORAGE = 'open-pencil:model'
const THINKING_STORAGE = 'open-pencil:thinking'

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

const apiKey = ref(localStorage.getItem(API_KEY_STORAGE) ?? '')
const modelId = ref(localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_AI_MODEL)
const thinkingEnabled = ref(localStorage.getItem(THINKING_STORAGE) === 'true')
const activeTab = ref<'design' | 'ai'>('design')

let editorStore: EditorStore | null = null

watch(apiKey, (key) => {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key)
  } else {
    localStorage.removeItem(API_KEY_STORAGE)
  }
})

watch(modelId, (id) => {
  localStorage.setItem(MODEL_STORAGE, id)
})

watch(thinkingEnabled, (v) => {
  localStorage.setItem(THINKING_STORAGE, String(v))
})

const isConfigured = computed(() => apiKey.value.length > 0)

const currentModel = computed(() => AI_MODELS.find((m) => m.id === modelId.value))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only mock transports don't implement full generics
let overrideTransport: (() => any) | null = null

let chat: Chat<UIMessage> | null = null

function createTransport() {
  if (overrideTransport) return overrideTransport()

  const openrouter = createOpenRouter({
    apiKey: apiKey.value,
    headers: {
      'X-OpenRouter-Title': 'OpenPencil',
      'HTTP-Referer': 'https://github.com/open-pencil/open-pencil'
    }
  })

  const model =
    thinkingEnabled.value && currentModel.value?.supportsThinking
      ? openrouter(modelId.value, {
          // Extended thinking via OpenRouter — Claude-specific extra body
          extraBody: { thinking: { type: 'enabled', budget_tokens: 8000 } }
        })
      : openrouter(modelId.value)

  const tools = editorStore ? createAITools(editorStore) : {}

  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools
  })

  return new DirectChatTransport({ agent })
}

function ensureChat(): Chat<UIMessage> | null {
  if (!apiKey.value) return null
  if (!chat) {
    chat = new Chat<UIMessage>({
      transport: createTransport()
    })
  }
  return chat
}

/** Fully recreate the chat (new transport). Call when model or thinking changes. */
function resetChat() {
  chat = null
}

if (typeof window !== 'undefined') {
  window.__OPEN_PENCIL_SET_TRANSPORT__ = (factory) => {
    overrideTransport = factory
  }
}

export function useAIChat(store?: EditorStore) {
  if (store) {
    editorStore = store
  }
  return {
    apiKey,
    modelId,
    thinkingEnabled,
    currentModel,
    activeTab,
    isConfigured,
    ensureChat,
    resetChat
  }
}
