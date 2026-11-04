import { APICallError, asSchema } from 'ai'
import type { StepResult, ToolSet, UIMessage } from 'ai'

import { scrubDiagnosticText } from '@/app/diagnostics/scrub'

import { fingerprint } from './fingerprint'
import type { RunTrace, StepTrace, TraceAsset, TraceError, TraceStore } from './types'

const MAX_RESPONSE_BODY = 4000

type RunStart = Pick<RunTrace, 'conversationId' | 'runId' | 'model' | 'settings'> & {
  instructions: string
  /** The messages sent, after unfinished tool calls were left out. */
  messages: UIMessage[]
}

export interface RunRecording {
  /** The tools offered to this run. */
  offer(tools: ToolSet): void
  step(step: StepResult<ToolSet>): void
  fail(error: unknown): void
  end(outcome: 'completed' | 'stopped'): void
}

/**
 * A provider's error text can echo a key or an account, and traces leave the device in bug
 * reports, so it is scrubbed as diagnostics are.
 */
function traceError(error: unknown): TraceError {
  const name = error instanceof Error ? error.name : 'Error'
  const message = scrubDiagnosticText(error instanceof Error ? error.message : String(error))
  if (!APICallError.isInstance(error)) return { name, message }
  return {
    name,
    message,
    statusCode: error.statusCode,
    responseBody:
      error.responseBody === undefined
        ? undefined
        : scrubDiagnosticText(error.responseBody).slice(0, MAX_RESPONSE_BODY)
  }
}

async function toolsAsset(tools: ToolSet): Promise<TraceAsset> {
  const entries = Object.entries(tools).toSorted(([left], [right]) => left.localeCompare(right))
  return {
    kind: 'tools',
    tools: await Promise.all(
      entries.map(async ([name, tool]) => ({
        name,
        // Our tools describe themselves in text; a description computed per call is not stored.
        description: typeof tool.description === 'string' ? tool.description : undefined,
        inputSchema: await asSchema(tool.inputSchema).jsonSchema
      }))
    )
  }
}

/**
 * Records each run of a conversation as references into its history, so a saved trace can
 * rebuild every request the model received (`./rebuild`) without storing them again.
 */
export function createRunRecorder(store: TraceStore) {
  const stored = new Set<string>()
  // Writes land in order, and one failure does not stop the next.
  let pending = Promise.resolve()

  function write(operation: () => Promise<void>): void {
    pending = pending.then(operation).catch((error: unknown) => {
      console.warn('[Chat trace] Failed to record a run step', error)
    })
  }

  async function storeAsset(asset: TraceAsset): Promise<string> {
    const hash = await fingerprint(asset)
    if (!stored.has(hash)) {
      await store.putAsset(hash, asset)
      stored.add(hash)
    }
    return hash
  }

  function start({ instructions, messages, ...run }: RunStart): RunRecording {
    const trace: RunTrace = {
      ...run,
      startedAt: new Date().toISOString(),
      instructions: '',
      input: { through: messages.at(-1)?.id ?? null, messages: messages.length },
      steps: [],
      outcome: 'running'
    }
    let lastMark = performance.now()
    const save = () => store.putRun(structuredClone(trace))
    write(async () => {
      trace.instructions = await storeAsset({ kind: 'instructions', text: instructions })
      await save()
    })

    function finish(outcome: RunTrace['outcome'], error?: TraceError): void {
      write(async () => {
        if (trace.outcome !== 'running') return
        trace.outcome = outcome
        trace.endedAt = new Date().toISOString()
        if (error) trace.error = error
        await save()
      })
    }

    return {
      offer(tools) {
        write(async () => {
          trace.tools = await storeAsset(await toolsAsset(tools))
          await save()
        })
      },
      step(step) {
        const now = performance.now()
        const durationMs = Math.round(now - lastMark)
        lastMark = now
        const messages = step.request.messages ?? []
        write(async () => {
          const recorded: StepTrace = {
            index: step.stepNumber,
            finishedAt: new Date().toISOString(),
            durationMs,
            request: { hash: await fingerprint(messages), messages: messages.length },
            response: {
              id: step.response.id,
              modelId: step.response.modelId,
              finishReason: step.finishReason,
              rawFinishReason: step.rawFinishReason
            },
            usage: {
              inputTokens: step.usage.inputTokens ?? null,
              outputTokens: step.usage.outputTokens ?? null,
              reasoningTokens: step.usage.outputTokenDetails.reasoningTokens ?? null,
              cacheReadTokens: step.usage.inputTokenDetails.cacheReadTokens ?? null,
              cacheWriteTokens: step.usage.inputTokenDetails.cacheWriteTokens ?? null
            },
            warnings: step.warnings ?? []
          }
          trace.steps.push(recorded)
          await save()
        })
      },
      fail(error) {
        finish('failed', traceError(error))
      },
      end(outcome) {
        finish(outcome)
      }
    }
  }

  return {
    start,
    /** Resolves once every recorded write has landed. */
    flush: () => pending
  }
}

export type RunRecorder = ReturnType<typeof createRunRecorder>
