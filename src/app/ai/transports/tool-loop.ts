import { useEventListener } from '@vueuse/core'
import { createUIMessageStream, DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type { ChatTransport, LanguageModel, ToolExecutionOptions, UIMessage } from 'ai'
import { toMerged } from 'es-toolkit'

import type { AIProviderID, ReasoningEffort } from '@open-pencil/core/constants'

import { resumableTransport } from '@/app/ai/chat/history/continuation'
import { maxAgentSteps } from '@/app/ai/chat/preferences'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import type { RunRecorder, RunRecording } from '@/app/ai/chat/trace/recorder'
import { promptCachingOptions } from '@/app/ai/models/caching'
import { reasoningCallSettings, type AIProviderOptions } from '@/app/ai/models/reasoning/settings'
import type { ThinkingLevel } from '@/app/ai/models/types'
import { createRunPreview } from '@/app/ai/preview/run'
import { createAITools, currentRun, endRun, recordStep, startRun } from '@/app/ai/tools'
import { enabledAIToolDefinitions } from '@/app/ai/tools/catalog'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { recordModelStepCompleted } from '@/app/diagnostics/events'
import type { AIDiagnosticContext } from '@/app/diagnostics/events/ai'
import type { getActiveEditorStore } from '@/app/editor/active-store'

type EditorStore = ReturnType<typeof getActiveEditorStore>

export type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  model: LanguageModel
  effectiveModelID: string
  minReasoningEffort?: ReasoningEffort
  maxOutputTokens: number
  /** Read per request, so the composer's level applies to the next message. */
  thinkingLevel: () => ThinkingLevel
  onError?: (error: unknown) => void
  diagnosticContext?: AIDiagnosticContext
  /** Records each run so a saved trace can rebuild its requests. */
  recorder?: RunRecorder
}

function callSettings(
  providerID: AIProviderID,
  cacheOptions: AIProviderOptions | undefined,
  thinkingLevel: ThinkingLevel,
  minReasoningEffort: ReasoningEffort | undefined
) {
  const { reasoning, providerOptions } = reasoningCallSettings(
    providerID,
    thinkingLevel,
    minReasoningEffort
  )
  // OpenRouter reads caching and reasoning from the same namespace, so merge them per key.
  const merged =
    cacheOptions || providerOptions
      ? toMerged(cacheOptions ?? {}, providerOptions ?? {})
      : undefined
  return { reasoning, providerOptions: merged }
}

export function createToolLoopTransport({
  store,
  providerID,
  model,
  effectiveModelID,
  minReasoningEffort,
  maxOutputTokens,
  thinkingLevel,
  onError,
  diagnosticContext = {},
  recorder
}: ToolLoopTransportOptions) {
  const tools = createAITools(store, diagnosticContext)
  // The reply in progress; a transport sends one message at a time.
  let run = currentRun(store)
  // While JSX streams, the chat's agent moves through the elements as they appear, here and
  // on the screens of everyone else in the room.
  const preview = createRunPreview(store)
  const renderTool = tools.render
  renderTool.onInputStart = ({ toolCallId, abortSignal }) => preview.start(toolCallId, abortSignal)
  renderTool.onInputDelta = ({ toolCallId, inputTextDelta }) =>
    preview.delta(toolCallId, inputTextDelta)
  renderTool.onInputAvailable = ({ toolCallId }: ToolExecutionOptions<unknown>) =>
    preview.finish(toolCallId)
  const cacheProviderOptions = promptCachingOptions(providerID, effectiveModelID)
  let recording: RunRecording | undefined
  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    maxOutputTokens,
    // Kept only to fingerprint each step's request for its trace.
    include: { requestMessages: recorder !== undefined },
    prepareCall: (options) => {
      const enabledNames = new Set(
        enabledAIToolDefinitions(aiToolOverrides.value).map((tool) => tool.name)
      )
      preview.clear()
      // Keep the full catalog for validating history; offer only enabled tools to this request.
      const offered = Object.fromEntries(
        Object.entries(tools).filter(([name]) => enabledNames.has(name))
      )
      recording?.offer(offered)
      return {
        ...options,
        stopWhen: stepCountIs(currentRun(store).maxSteps),
        tools: offered,
        maxOutputTokens,
        ...callSettings(providerID, cacheProviderOptions, thinkingLevel(), minReasoningEffort)
      }
    },
    onFinish: () => {
      preview.clear()
      endRun(store, run)
      recording?.end('completed')
    },
    onStepFinish: (step) => {
      const { usage } = step
      preview.clear()
      recordStep(store)
      recording?.step(step)
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
    endRun(store, run)
    recording?.fail(error)
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
      // The run starts as the message is sent, so a Stop before the model is reached ends it.
      const started = startRun(store, maxAgentSteps.value, effectiveModelID)
      run = started
      const { sessionId, runId } = diagnosticContext
      const startedRecording =
        sessionId && runId
          ? recorder?.start({
              conversationId: sessionId,
              runId,
              model: { provider: providerID, id: effectiveModelID },
              settings: {
                maxOutputTokens,
                maxSteps: started.maxSteps,
                thinking: thinkingLevel(),
                cache: cacheProviderOptions !== undefined
              },
              instructions: SYSTEM_PROMPT,
              messages: options.messages
            })
          : undefined
      recording = startedRecording
      // Stopping a reply ends the run without onFinish.
      const stop = () => {
        endRun(store, started)
        startedRecording?.end('stopped')
      }
      const { abortSignal } = options
      if (abortSignal?.aborted) stop()
      else if (abortSignal) useEventListener(abortSignal, 'abort', stop)
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
