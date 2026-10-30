import { Chat } from '@ai-sdk/vue'
import type { ChatTransport, FinishReason, UIMessage } from 'ai'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'

import { ACP_AGENTS, AI_PROVIDERS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { AgentSetupError, assertAgentReady } from '@/app/ai/agents/setup/readiness'
import { classifyAIChatError, type AIChatFailure } from '@/app/ai/chat/failure'
import { hasSteeringMessage } from '@/app/ai/chat/queue'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { chatThinkingLevel } from '@/app/ai/chat/thinking'
import { createAIModelRuntime, resolveModelConnectionAPIKey } from '@/app/ai/models'
import { resolveLanguageModelID } from '@/app/ai/models/language-model'
import { cloudCreditRefusal } from '@/app/ai/providers/openpencil/failure'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import { settleMessage } from '@/app/ai/reply/settle'
import { currentRun } from '@/app/ai/tools'
import type { AgentTurnUsage } from '@/app/ai/transports/acp'
import { createToolLoopTransport } from '@/app/ai/transports/tool-loop'
import { restAgents } from '@/app/automation/agents'
import { diagnosticErrorDetails } from '@/app/diagnostics'
import {
  recordChatCompleted,
  recordChatFailed,
  recordChatStopped,
  recordModelStepCompleted
} from '@/app/diagnostics/events'
import type { AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import type { getActiveEditorStore } from '@/app/editor/active-store'
import { trackUsage } from '@/app/telemetry'

import { createTraceStore } from './history/idb'
import { updateMessage } from './metadata'
import { createRunRecorder } from './trace/recorder'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isACPProvider: ComputedRef<boolean>
  isHarnessProvider: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  credentialsReady: Promise<void>
  getActiveEditorStore: () => EditorStore
}

export async function createACPTransport(
  providerID: AIProviderID,
  store?: EditorStore,
  onUsage?: (usage: AgentTurnUsage) => void
) {
  const agentId = providerID.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/app/ai/transports/acp')
  const { agentWorkspace } = await import('@/app/ai/agents/setup/native')
  // A folder of its own, not the home folder, whose project settings the agent would read.
  return new ACPChatTransport({ agentDef, cwd: await agentWorkspace(), store, onUsage })
}

/**
 * A reply that ended unfinished is settled once its last edit landed, so it no longer reads as
 * running and the model learns which of its calls changed the document.
 */
async function settleEndedReply(
  chat: Chat<UIMessage>,
  store: EditorStore,
  messageId: string,
  stopped: boolean
): Promise<void> {
  const run = currentRun(store)
  await run.settled()
  updateMessage(chat, messageId, (message) =>
    settleMessage(message, { stopped, changed: (toolCallId) => run.changedCalls.has(toolCallId) })
  )
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
  const runRecorder = createRunRecorder(createTraceStore())

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
    if (isAbort) recordChatStopped(context)
    else if (!isDisconnect && !isError) {
      recordChatCompleted({ finishReason: finishReason ?? null }, context)
      trackUsage({ name: 'ai_reply_finished', provider: providerID.value })
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

  async function createActiveACPTransport(store: EditorStore, context: AIDiagnosticContext) {
    await destroyAgentTransports()
    await assertAgentReady('acp')
    const provider = providerID.value
    // An agent's turn counts as one step of the model it names, or of the agent itself.
    const transport = await createACPTransport(provider, store, ({ model, ...tokens }) =>
      recordModelStepCompleted({ provider, model: model ?? provider, ...tokens }, context)
    )
    acpTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createActiveHarnessTransport(sessionId: string, context: AIDiagnosticContext) {
    await destroyAgentTransports()
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'harness') throw new Error('The Design agent is not configured for Pi')
    await assertAgentReady('pi')
    const [{ HarnessChatTransport }, { buildPiMCPServers }, { readPiAccount }, { harnessSkills }] =
      await Promise.all([
        import('@/app/ai/transports/pi'),
        import('@/app/integrations/mcp'),
        import('@/app/ai/agents/pi/settings'),
        import('@/app/ai/skills/harness')
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
        mcpServers: await buildPiMCPServers(),
        skills: await harnessSkills()
      },
      apiKey
        ? { OPENPENCIL_HARNESS_API_KEY: apiKey }
        : { OPENPENCIL_HARNESS_AGENT_DIR: account?.agentDir ?? '' },
      undefined,
      (usage) => recordModelStepCompleted({ provider: providerID.value, model, ...usage }, context)
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
      minReasoningEffort: runtime.minReasoningEffort,
      maxOutputTokens: runtime.role.profile.maxOutputTokens,
      thinkingLevel: () => chatThinkingLevel.value,
      onError: captureProviderError,
      diagnosticContext,
      recorder: runRecorder,
      yieldWhen: hasSteeringMessage
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
      // Failures belong to the provider this chat was created for, even if the profile changes.
      const chatProviderID = providerID.value
      let transport: ChatTransport<UIMessage>
      // An ACP or Pi chat's tool calls show as an agent of that kind (`src/app/automation/agents.ts`).
      let agentKind: 'acp' | 'harness' | null = null
      if (isACPProvider.value) {
        agentKind = 'acp'
        transport = await createActiveACPTransport(store, diagnosticContext)
      } else if (isHarnessProvider.value) {
        agentKind = 'harness'
        transport = await createActiveHarnessTransport(sessionId, diagnosticContext)
      } else {
        transport = await createTransport(store, diagnosticContext)
      }
      const created: Chat<UIMessage> = new Chat<UIMessage>({
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
          const signInOnly = AI_PROVIDERS.some(
            (provider) => provider.id === chatProviderID && provider.signInOnly
          )
          const classified = classifyAIChatError(reportedError, { signInOnly })
          const refusal =
            chatProviderID === OPENPENCIL_AI_PROVIDER ? cloudCreditRefusal(reportedError) : null
          failure.value = refusal
            ? {
                ...classified,
                reason: 'cloud-credits-exhausted',
                resetsAt: refusal.resetsAt ?? undefined
              }
            : classified
          const { errorName, errorCode, message, stack } = diagnosticErrorDetails(reportedError)
          recordChatFailed({ errorName, errorCode, message, stack }, diagnosticContext)
        },
        onFinish: (event) => {
          handleChatFinish(diagnosticContext, event)
          // The reply is over, however it ended; its agent rests instead of waiting it out.
          if (agentKind) restAgents(agentKind)
          if (event.isAbort || event.isDisconnect || event.isError) {
            void settleEndedReply(created, store, event.message.id, event.isAbort)
          }
        }
      })
      chat = created
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
