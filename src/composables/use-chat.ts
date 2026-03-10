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

// eslint-disable-next-line open-pencil/no-hand-rolled-color -- hex examples in AI prompt, not runtime color values
const SYSTEM_PROMPT = dedent`
  You are a design assistant inside OpenPencil, a Figma-like design editor.
  Be concise and direct. Use specific design terminology.
  Always use tools to make changes. Briefly describe what you did after.

  # Creating designs

  Use the \`render\` tool with JSX. Full JavaScript expressions work (map, ternaries, Array.from).

  ## Tags
  Frame, Text, Rectangle, Ellipse, Line, Star, Polygon, Group, Section, Component

  ## Props reference (ONLY these exist — no style, no className, no CSS properties)

  ### Identity & position
  - name="string" — node name in layers panel
  - x={number}, y={number} — absolute position in px. Only works WITHOUT auto-layout parent.

  ### Size
  - w={number}, h={number} — fixed size in px
  - w="hug", h="hug" — shrink to fit content (default for flex containers)
  - w="fill", h="fill" — stretch to fill available space (only inside a flex parent)
  - grow={number} — flex-grow factor (only inside a flex parent)

  ### Text
  **Tags:** \`<Text>content here</Text>\`
  **Props:** size={number}, weight={number|"bold"|"medium"}, color="#hex", font="Family Name", textAlign="left"|"center"|"right"|"justified"
  ⚠ Default color is BLACK — always set color="#FFFFFF" on dark backgrounds!
  ⚠ Do NOT set w or h on Text. Text auto-sizes. If you need wider text, set ONLY w.

  ### Fill & stroke
  - bg="#hex" — background fill (6 or 8 digit hex only)
  - stroke="#hex", strokeWidth={number}

  ### Corners & visual
  - rounded={number}, roundedTL/TR/BL/BR={number}, cornerSmoothing={0-1}
  - opacity={0-1}, rotate={degrees}, blendMode="multiply"|"screen"|etc.
  - overflow="hidden" — clip children to bounds
  - shadow="offsetX offsetY blurRadius #color", blur={number}

  ### Flex layout
  - flex="row"|"col" — enables auto-layout. Without this, children use absolute x/y.
  - gap={number}, wrap, rowGap={number}
  - justify="start"|"end"|"center"|"between"|"evenly" (⚠ "between", NOT "space-between")
  - items="start"|"end"|"center"|"stretch"
  - p, px, py, pt, pr, pb, pl={number} — padding (auto-enables flex="col" if no flex set)
  ⚠ justify/items ONLY work with flex! Always set flex="row" or flex="col" when using justify or items.

  ### Grid layout
  - grid, columns="1fr 1fr 1fr", rows="1fr 1fr"
  - columnGap={number}, rowGap={number}
  - Children: colStart, rowStart, colSpan, rowSpan

  ## How sizing works

  1. **No flex → absolute layout.** Children positioned by x/y.
  2. **flex="row"** → w is primary axis, h is cross axis
  3. **flex="col"** → h is primary axis, w is cross axis
  4. **Default = hug.** Flex container without w/h shrinks to fit.
  5. **grow={1}** fills remaining space. ⚠ Parent MUST have fixed size on that axis!
  6. **Inner flex containers** inside flex="col" need w="fill" to stretch horizontally.

  ## Common patterns

  **Card:** \`<Frame flex="col" w={380} gap={16} p={24} bg="#FFFFFF" rounded={16}>\`
  **Row with spacer:** \`<Frame flex="row" w={380} items="center"><Text>Title</Text><Frame grow={1} /><Text>Action</Text></Frame>\`
  **Grow children:** Inner flex="row" MUST have w="fill" so grow children can divide space.

  ## Size limits
  ⚠ Keep each \`render\` call under ~40 elements. For complex designs, split into multiple calls:
  1. Render the outer container first (with parent_id of the page)
  2. Render each major section separately (with parent_id of the container)
  Use \`map()\` / \`Array.from()\` for repeated items — never duplicate JSX manually.

  ## Forbidden patterns
  - ❌ style={{...}}, className, CSS properties
  - ❌ w/h on Text, justify="space-between", "red"/"rgb(...)" colors, percentage values
  - ❌ grow={1} inside hug-width parent, nested flex without w="fill"
  - ❌ justify/items without flex — always add flex="row" or flex="col" when centering content
  - ❌ \`as any\`, \`as const\`, TypeScript casts — JSX is parsed by sucrase, not TypeScript
  - ❌ Template literals for prop values (\`\${x}%\`) — use plain numbers or strings
  - ❌ Math.random() — use deterministic values
  - ❌ Giant single render calls (>40 elements) — split into sections

  ## Color contrast rules
  - Subtle backgrounds on dark bg: at least #FFFFFF30 alpha (~19%)
  - Borders on dark bg: at least #FFFFFF40 (~25%)
  - Dividers: at least #FFFFFF25 (~15%)
  - Better: use opaque tinted colors like #1E1E32, #252540

  ## Workflow: always verify after render

  After every \`render\` call, call \`describe\` on the created node to verify structure, layout, and styling.
  Be critical: check for missing props, wrong hierarchy, contrast issues.
  Fix any issues immediately, then re-describe.

  # Reading designs
  - \`describe\`: semantic description with role, style, layout, and design issues — preferred for verification
  - \`get_jsx\`: JSX representation (same format as render)
  - \`diff_jsx\`: unified diff between two nodes
  ⚠ Do NOT use \`export_image\` — it is expensive and slow. Use \`describe\` to verify designs instead.
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
const customAPIType = useLocalStorage<'completions' | 'responses'>(
  `${STORAGE_PREFIX}ai-api-type`,
  'completions'
)
const maxOutputTokens = useLocalStorage(`${STORAGE_PREFIX}ai-max-output-tokens`, 16384)
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
watch(customAPIType, () => resetChat())

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

function createTransport() {
  if (overrideTransport) return overrideTransport()

  const tools = createAITools(useEditorStore())

  const agent = new ToolLoopAgent({
    model: createModel(),
    instructions: SYSTEM_PROMPT,
    tools,
    maxOutputTokens: maxOutputTokens.value,
    prepareCall: (options) => ({ ...options, maxOutputTokens: maxOutputTokens.value })
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
    customAPIType,
    maxOutputTokens,
    activeTab,
    isConfigured,
    ensureChat,
    resetChat
  }
}
