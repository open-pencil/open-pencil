import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { Chat } from '@ai-sdk/vue'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { useLocalStorage } from '@vueuse/core'
import { DirectChatTransport, ToolLoopAgent } from 'ai'
import dedent from 'dedent'
import { computed, ref, watch } from 'vue'

import { createAITools } from '@/ai/tools'
import { useEditorStore } from '@/stores/editor'
import { AI_PROVIDERS, DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER } from '@open-pencil/core'

import type { AIProviderID } from '@open-pencil/core'
import type { LanguageModel, UIMessage } from 'ai'

export { AI_PROVIDERS } from '@open-pencil/core'
export type { AIProviderDef, AIProviderID, ModelOption } from '@open-pencil/core'

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

const SYSTEM_PROMPT = dedent`
  You are a design assistant inside OpenPencil, a Figma-like design editor.
  Be concise and direct. Use specific design terminology.
  Always use tools to make changes. Briefly describe what you did after.

  # Creating designs

  Use the \`render\` tool with JSX. Full JavaScript expressions work (map, ternaries, Array.from).

  ## Available tags
  Frame, Text, Rectangle, Ellipse, Line, Star, Polygon, Group, Section, Component

  ## Supported props (ONLY these — no \`style\`, no \`className\`, no CSS properties)

  **Identity:** name
  **Size:** w, h (number in px; or "hug"/"fill" — "hug"/"fill" only work inside flex containers)
  **Position:** x, y (number in px — only for absolute positioning, ignored inside auto-layout)
  **Fill:** bg="#hex" (6 or 8 digit hex, e.g. "#FF0000", "#FF000080" for 50% opacity)
  **Stroke:** stroke="#hex", strokeWidth={number}
  **Corners:** rounded={number}, roundedTL/TR/BL/BR={number}, cornerSmoothing={number}
  **Opacity:** opacity={0-1}
  **Rotation:** rotate={degrees}
  **Blend:** blendMode="multiply" etc.
  **Clipping:** overflow="hidden"

  **Layout (flex):** flex="row"|"col", gap={number}, wrap (boolean)
  **Alignment:** justify="start"|"end"|"center"|"between", items="start"|"end"|"center"|"stretch"
  **Padding:** p, px, py, pt, pr, pb, pl (all numbers)
  **Child sizing:** grow={number} (like flex-grow, only inside flex parent)

  **Text-only props:** size={number}, weight={number|"bold"|"medium"}, color="#hex", font="Family", textAlign="left"|"center"|"right"|"justified"
  Default text size is 14, default weight is 400, default color is black.

  **Star:** points={number}, innerRadius={number}
  **Polygon:** points={number}

  **Effects:** shadow="x y blur #color", blur={number}

  ## Critical rules
  - There is NO \`style\` prop. Never use style={{...}}. All styling is via direct props above.
  - There is NO CSS position, minWidth, maxWidth, lineHeight, letterSpacing, zIndex.
  - \`key\` prop is accepted but ignored (no reconciliation).
  - For layout, always add flex="row"|"col" on container Frames. Without flex, children stack by x/y.
  - Colors must be hex strings: "#FF0000", not "red", not "rgb(...)".
  - justify="between" NOT "space-between" or "SPACE_BETWEEN".
  - Use create_shape + set_layout only for simple single nodes; prefer render for multi-node layouts.
  - Use get_jsx to read existing node structure before modifying.
  - Use describe to understand node semantics and catch design issues.

  # Reading designs

  - \`get_jsx\`: returns the JSX representation (same format as render) — for structural inspection
  - \`describe\`: returns semantic description (role, visual style, layout, issues) — for understanding intent
  - \`diff_jsx\`: unified diff between two nodes in JSX format
  - \`get_selection\`, \`find_nodes\`, \`get_node\`: for querying the canvas
`

const providerID = useLocalStorage<AIProviderID>(
  `${STORAGE_PREFIX}ai-provider`,
  DEFAULT_AI_PROVIDER
)
const apiKeyStorageKey = computed(() => keyStorageKey(providerID.value))
const apiKey = useLocalStorage(apiKeyStorageKey, '')
const modelID = useLocalStorage(`${STORAGE_PREFIX}ai-model`, DEFAULT_AI_MODEL)
const customBaseURL = useLocalStorage(`${STORAGE_PREFIX}ai-base-url`, '')
const customModelID = useLocalStorage(`${STORAGE_PREFIX}ai-custom-model`, '')
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

watch(providerID, (id) => {
  const def = AI_PROVIDERS.find((p) => p.id === id)
  if (def?.defaultModel) {
    modelID.value = def.defaultModel
  }
  resetChat()
})

watch(modelID, () => resetChat())
watch(customModelID, () => resetChat())

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
    case 'openai-compatible': {
      const custom = createOpenAI({
        apiKey: key,
        baseURL: customBaseURL.value
      })
      return custom.chat(effectiveModelID)
    }
    case 'anthropic-compatible': {
      const custom = createAnthropic({
        apiKey: key,
        baseURL: customBaseURL.value
      })
      return custom(effectiveModelID)
    }
    // exhaustiveness guard — TypeScript ensures we handle every AIProviderID
    default:
      throw new Error(`Unknown provider: ${providerID.value satisfies never}`)
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
    providerID,
    providerDef,
    apiKey,
    setAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    activeTab,
    isConfigured,
    ensureChat,
    resetChat
  }
}
