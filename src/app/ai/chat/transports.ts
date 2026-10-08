import { Chat } from '@ai-sdk/vue'
import { useEventListener } from '@vueuse/core'
import { createUIMessageStream, DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type {
  ChatTransport,
  FinishReason,
  LanguageModel,
  ToolExecutionOptions,
  UIMessage
} from 'ai'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { AgentSetupError, assertAgentReady } from '@/app/ai/agents/readiness'
import { classifyAIChatError, type AIChatFailure } from '@/app/ai/chat/failure'
import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { reasoningCallSettings, type AIProviderOptions } from '@/app/ai/chat/reasoning'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { chatThinkingLevel } from '@/app/ai/chat/thinking'
import { createAIModelRuntime, resolveModelConnectionAPIKey } from '@/app/ai/models'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { createCanvasJSXPreview } from '@/app/ai/preview/canvas'
import {
  createAITools,
  endRun,
  markRunPreview,
  recordStep,
  runPageId,
  startRun
} from '@/app/ai/tools'
import { enabledAIToolDefinitions } from '@/app/ai/tools/catalog'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { diagnosticErrorDetails } from '@/app/diagnostics'
import {
  recordChatCompleted,
  recordChatFailed,
  recordModelStepCompleted
} from '@/app/diagnostics/events'
import type { AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import type { getActiveEditorStore } from '@/app/editor/active-store'

import { resumableTransport } from './history/continuation'
import { maxAgentSteps } from './preferences'

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
  /** Read per request, so the composer's level applies to the next message. */
  thinkingLevel: () => ThinkingLevel
  onError?: (error: unknown) => void
  diagnosticContext?: AIDiagnosticContext
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

function callSettings(
  providerID: AIProviderID,
  cacheOptions: typeof ANTHROPIC_CACHE_CONTROL | undefined,
  thinkingLevel: ThinkingLevel
) {
  const { reasoning, providerOptions } = reasoningCallSettings(providerID, thinkingLevel)
  return { reasoning, providerOptions: mergeProviderOptions(cacheOptions, providerOptions) }
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
  thinkingLevel,
  onError,
  diagnosticContext = {}
}: ToolLoopTransportOptions) {
  const tools = createAITools(store, diagnosticContext)
  // While JSX streams, the chat's agent moves through the elements as they appear.
  const preview = createCanvasJSXPreview(
    store,
    () => runPageId(store),
    (focus) => markRunPreview(store, focus)
  )
  const renderTool = tools.render
  renderTool.onInputStart = ({ toolCallId, abortSignal }) => preview.start(toolCallId, abortSignal)
  renderTool.onInputDelta = ({ toolCallId, inputTextDelta }) =>
    preview.delta(toolCallId, inputTextDelta)
  renderTool.onInputAvailable = ({ toolCallId }: ToolExecutionOptions<unknown>) =>
    preview.finish(toolCallId)
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined
  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    maxOutputTokens,
    prepareCall: (options) => {
      const stepLimit = maxAgentSteps.value
      const enabledNames = new Set(
        enabledAIToolDefinitions(aiToolOverrides.value).map((tool) => tool.name)
      )
      preview.clear()
      startRun(store, stepLimit, effectiveModelID)
      return {
        ...options,
        stopWhen: stepCountIs(stepLimit),
        // Keep the full catalog for validating history; offer only enabled tools to this request.
        tools: Object.fromEntries(Object.entries(tools).filter(([name]) => enabledNames.has(name))),
        maxOutputTokens,
        ...callSettings(providerID, cacheProviderOptions, thinkingLevel())
      }
    },
    onFinish: () => {
      preview.clear()
      endRun(store)
    },
    onStepFinish: ({ usage }) => {
      preview.clear()
      recordStep(store)
      recordModelStepCompleted(
        {
          provider: providerID,
          model: effectiveModelID,
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
          cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
          cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? null
        },
        diagnosticContext
      )
    }
  })

  function handleError(error: unknown): string {
    preview.clear()
    endRun(store)
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
      // Stopping a reply ends the run without onFinish.
      if (options.abortSignal) useEventListener(options.abortSignal, 'abort', () => endRun(store))
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

  function handleChatFinish(
    context: AIDiagnosticContext,
    {
      finishReason,
      isAbort,
      isDisconnect,
      isError
    }: {
      finishReason?: FinishReason
      isAbort: boolean
      isDisconnect: boolean
      isError: boolean
    }
  ): void {
    if (!isAbort && !isDisconnect && !isError) {
      recordChatCompleted({ finishReason: finishReason ?? null }, context)
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
    await assertAgentReady('acp')
    const transport = await createACPTransport(providerID.value)
    acpTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createActiveHarnessTransport(sessionId: string) {
    await destroyAgentTransports()
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'harness') throw new Error('The Design agent is not configured for Pi')
    await assertAgentReady('pi')
    const [{ HarnessChatTransport }, { buildPiMCPServers }, { readPiAccount }] = await Promise.all([
      import('@/app/ai/harness/transport'),
      import('@/app/integrations/mcp'),
      import('@/app/ai/harness/pi-settings')
    ])
    // A saved key is an AI Gateway key; without one, Pi uses the CLI's own sign-in.
    const apiKey = await resolveModelConnectionAPIKey(runtime.role.connection.id)
    const account = apiKey ? null : await readPiAccount()
    const model =
      runtime.role.profile.customModelID ||
      runtime.role.profile.modelID ||
      account?.defaultModel ||
      ''
    if (!apiKey && !account?.signedIn) throw new AgentSetupError('pi-sign-in')
    if (!model) throw new AgentSetupError('pi-model')
    const transport = new HarnessChatTransport(
      sessionId,
      {
        adapter: 'pi',
        sandbox: 'just-bash',
        model,
        settings: {
          ...(runtime.role.profile.thinkingLevel !== 'default' && {
            thinkingLevel: runtime.role.profile.thinkingLevel
          }),
          permissionMode: runtime.role.profile.harnessPermissionMode ?? 'allow-edits'
        },
        instructions: SYSTEM_PROMPT,
        mcpServers: await buildPiMCPServers()
      },
      apiKey
        ? { OPENPENCIL_HARNESS_API_KEY: apiKey }
        : { OPENPENCIL_HARNESS_AGENT_DIR: account?.agentDir ?? '' }
    )
    harnessTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createTransport(store: EditorStore, diagnosticContext: AIDiagnosticContext) {
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
      thinkingLevel: () => chatThinkingLevel.value,
      onError: captureProviderError,
      diagnosticContext
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
      const diagnosticContext: AIDiagnosticContext = { sessionId, runId: crypto.randomUUID() }
      let transport: ChatTransport<UIMessage>
      if (isACPProvider.value) transport = await createActiveACPTransport()
      else if (isHarnessProvider.value) transport = await createActiveHarnessTransport(sessionId)
      else transport = await createTransport(store, diagnosticContext)
      chat = new Chat<UIMessage>({
        transport: {
          sendMessages: (options) => {
            diagnosticContext.runId = crypto.randomUUID()
            return transport.sendMessages(options)
          },
          reconnectToStream: (options) => transport.reconnectToStream(options)
        },
        messages,
        onError: (error) => {
          const reportedError = activeProviderError ?? error
          activeProviderError = null
          failure.value = classifyAIChatError(reportedError)
          const { errorName, errorCode, message, stack } = diagnosticErrorDetails(reportedError)
          recordChatFailed({ errorName, errorCode, message, stack }, diagnosticContext)
        },
        onFinish: (event) => handleChatFinish(diagnosticContext, event)
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
