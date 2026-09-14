import { Chat } from '@ai-sdk/vue'
import { createUIMessageStream, DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type {
  ChatTransport,
  FinishReason,
  LanguageModel,
  UIMessage,
  ToolExecutionOptions
} from 'ai'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { classifyAIChatError, type AIChatFailure } from '@/app/ai/chat/failure'
import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { buildReasoningProviderOptions, type AIProviderOptions } from '@/app/ai/chat/reasoning'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { createAIModelRuntime, resolveModelConnectionAPIKey } from '@/app/ai/models'
import { createCanvasJSXPreview } from '@/app/ai/preview/canvas'
import { MAX_AGENT_STEPS, createAITools, recordStep, resetRunSteps } from '@/app/ai/tools'
import {
  recordChatCompleted,
  recordChatFailed,
  recordModelStepCompleted
} from '@/app/diagnostics/events'
import type { getActiveEditorStore } from '@/app/editor/active-store'

import { resumableTransport } from './history/continuation'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isACPProvider: ComputedRef<boolean>
  isHarnessProvider: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  credentialsReady: Promise<void>
  getActiveEditorStore: () => EditorStore
}

export type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  model: LanguageModel
  effectiveModelID: string
  maxOutputTokens: number
  reasoningEffort: string
  onError?: (error: unknown) => void
}

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

function supportsAnthropicCaching(providerID: AIProviderID, modelID: string): boolean {
  return (
    providerID === 'anthropic' ||
    providerID === 'anthropic-compatible' ||
    (providerID === 'openrouter' && modelID.startsWith('anthropic/'))
  )
}

function mergeProviderOptions(
  cacheOptions: typeof ANTHROPIC_CACHE_CONTROL | undefined,
  reasoningOptions: AIProviderOptions | undefined
): AIProviderOptions | undefined {
  if (!cacheOptions && !reasoningOptions) return undefined
  return { ...cacheOptions, ...reasoningOptions }
}

export async function createACPTransport(providerID: AIProviderID) {
  const agentId = providerID.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/app/ai/acp/transport')
  const { homeDir } = await import('@tauri-apps/api/path')
  return new ACPChatTransport({ agentDef, cwd: await homeDir() })
}

export function createToolLoopTransport({
  store,
  providerID,
  model,
  effectiveModelID,
  maxOutputTokens,
  reasoningEffort,
  onError
}: ToolLoopTransportOptions) {
  const tools = createAITools(store)
  const preview = createCanvasJSXPreview(store)
  const renderTool = tools.render
  renderTool.onInputStart = ({ toolCallId, abortSignal }) => preview.start(toolCallId, abortSignal)
  renderTool.onInputDelta = ({ toolCallId, inputTextDelta }) =>
    preview.delta(toolCallId, inputTextDelta)
  renderTool.onInputAvailable = ({ toolCallId }: ToolExecutionOptions<unknown>) =>
    preview.finish(toolCallId)
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined
  const providerOptions = mergeProviderOptions(
    cacheProviderOptions,
    buildReasoningProviderOptions(providerID, reasoningEffort)
  )

  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens,
    providerOptions,
    prepareCall: (options) => {
      preview.clear()
      resetRunSteps(store)
      return {
        ...options,
        maxOutputTokens,
        providerOptions
      }
    },
    onFinish: () => preview.clear(),
    onStepFinish: ({ usage }) => {
      preview.clear()
      recordStep(store)
      recordModelStepCompleted({
        provider: providerID,
        model: effectiveModelID,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
        cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? null
      })
    }
  })

  function handleError(error: unknown): string {
    preview.clear()
    onError?.(error)
    return 'The provider rejected the request.'
  }
  const transport = new DirectChatTransport({
    agent,
    onError: handleError
  }) as ChatTransport<UIMessage>
  return resumableTransport({
    reconnectToStream: (options) => transport.reconnectToStream(options),
    async sendMessages(options) {
      // DirectChatTransport handles error chunks, but not a rejected underlying stream.
      return createUIMessageStream<UIMessage>({
        execute: async ({ writer }) => {
          writer.merge(await transport.sendMessages(options))
        },
        onError: handleError
      })
    }
  })
}

export function createChatSessionManager({
  isConfigured,
  isACPProvider,
  isHarnessProvider,
  providerID,
  credentialsReady,
  getActiveEditorStore
}: ChatSessionOptions) {
  const failure = ref<AIChatFailure | null>(null)
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  const currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let acpTransportInstance: { destroy(): Promise<void> } | null = null
  let harnessTransportInstance: { stop(): Promise<void> } | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null
  let activeProviderError: unknown = null

  function captureProviderError(error: unknown): void {
    activeProviderError ??= error
  }

  function handleChatFinish({
    finishReason,
    isAbort,
    isDisconnect,
    isError
  }: {
    finishReason?: FinishReason
    isAbort: boolean
    isDisconnect: boolean
    isError: boolean
  }): void {
    if (!isAbort && !isDisconnect && !isError) {
      recordChatCompleted({ finishReason: finishReason ?? null })
    }
  }

  function clearFailure(): void {
    activeProviderError = null
    failure.value = null
  }

  function markTransportDirty() {
    transportDirty = true
  }

  async function destroyAgentTransports(): Promise<void> {
    const acp = acpTransportInstance
    const harness = harnessTransportInstance
    acpTransportInstance = null
    harnessTransportInstance = null
    const results = await Promise.allSettled([acp?.destroy(), harness?.stop()])
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length) throw new AggregateError(errors, 'Agent transport teardown failed')
  }

  async function createActiveACPTransport() {
    await destroyAgentTransports()
    const transport = await createACPTransport(providerID.value)
    acpTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createActiveHarnessTransport(sessionId: string) {
    await destroyAgentTransports()
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'harness') throw new Error('The Design agent is not configured for Pi')
    const [{ HarnessChatTransport }, { buildPiMCPServers }] = await Promise.all([
      import('@/app/ai/harness/transport'),
      import('@/app/integrations/mcp')
    ])
    const apiKey = await resolveModelConnectionAPIKey(runtime.role.connection.id)
    if (!apiKey) throw new Error('Credential is unavailable for the Pi agent')
    const model = runtime.role.profile.customModelID || runtime.role.profile.modelID
    const transport = new HarnessChatTransport(
      sessionId,
      {
        adapter: 'pi',
        sandbox: 'just-bash',
        model,
        settings: {
          thinkingLevel: runtime.role.profile.harnessThinkingLevel ?? 'medium',
          permissionMode: runtime.role.profile.harnessPermissionMode ?? 'allow-edits'
        },
        instructions: SYSTEM_PROMPT,
        mcpServers: await buildPiMCPServers()
      },
      { OPENPENCIL_HARNESS_API_KEY: apiKey }
    )
    harnessTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createTransport(store: EditorStore) {
    if (overrideTransport) return overrideTransport()

    await destroyAgentTransports()

    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'direct') {
      throw new Error('The Design model is not configured for direct API access')
    }
    return createToolLoopTransport({
      store,
      providerID: runtime.role.connection.providerID,
      model: runtime.model,
      effectiveModelID: resolveLanguageModelID({
        providerID: runtime.role.connection.providerID,
        modelID: runtime.role.profile.modelID,
        customModelID: runtime.role.profile.customModelID
      }),
      maxOutputTokens: runtime.role.profile.maxOutputTokens,
      reasoningEffort: runtime.role.profile.reasoningEffort ?? '',
      onError: captureProviderError
    })
  }

  async function ensureChat(
    initialMessages?: UIMessage[],
    sessionId = crypto.randomUUID()
  ): Promise<Chat<UIMessage> | null> {
    await credentialsReady
    if (!isConfigured.value) return null

    const store = getActiveEditorStore()
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, chat.messages)
    }

    if (!chat || transportDirty || currentChatStore !== store) {
      const messages = initialMessages ?? currentChatMessages.get(store)
      let transport: ChatTransport<UIMessage>
      if (isACPProvider.value) transport = await createActiveACPTransport()
      else if (isHarnessProvider.value) transport = await createActiveHarnessTransport(sessionId)
      else transport = await createTransport(store)
      chat = new Chat<UIMessage>({
        transport,
        messages,
        onError: (error) => {
          const reportedError = activeProviderError ?? error
          activeProviderError = null
          failure.value = classifyAIChatError(reportedError)
          recordChatFailed({
            errorName: reportedError instanceof Error ? reportedError.name : 'unknown'
          })
        },
        onFinish: handleChatFinish
      })
      currentChatStore = store
      transportDirty = false
    }
    return chat
  }

  async function resetChat() {
    if (currentChatStore) currentChatMessages.delete(currentChatStore)
    await destroyAgentTransports()
    failure.value = null
    chat = null
    currentChatStore = null
    transportDirty = false
  }

  function setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
    overrideTransport = factory
    markTransportDirty()
  }

  return { ensureChat, resetChat, markTransportDirty, setOverrideTransport, failure, clearFailure }
}
