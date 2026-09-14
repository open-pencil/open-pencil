import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4, mockValues } from 'ai/test'

import type { RenderPlacementInput } from '@open-pencil/core/design-jsx'

import { createStreamGate } from './gate'

type ModelStream = Awaited<ReturnType<MockLanguageModelV4['doStream']>>
type ModelChunk = ModelStream['stream'] extends ReadableStream<infer Chunk> ? Chunk : never

export interface RenderStreamScenario {
  jsx: string
  placement?: RenderPlacementInput
  outcome?: 'render' | 'provider-error'
  /** Markers in serialized input after which the provider pauses, in order. */
  pauseAfter: string[]
}

function argumentChunks(input: string, markers: string[]): string[] {
  let offset = 0
  const chunks: string[] = []
  for (const marker of markers) {
    const start = input.indexOf(marker, offset)
    if (!marker || start === -1) throw new Error(`Stream checkpoint not found: ${marker}`)
    const end = start + marker.length
    chunks.push(input.slice(offset, end))
    offset = end
  }
  if (offset === input.length) throw new Error('Leave a final input chunk for tool execution')
  chunks.push(input.slice(offset))
  return chunks
}

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 }
}

/** SDK-owned provider behavior with one test-owned pause gate around argument chunks. */
export function createRenderStreamModel(scenario: RenderStreamScenario) {
  const input = JSON.stringify({ ...scenario.placement, jsx: scenario.jsx })
  const gate = createStreamGate<ModelChunk>((chunk) => chunk.type === 'tool-input-delta')
  const completion: ModelChunk[] =
    scenario.outcome === 'provider-error'
      ? [{ type: 'error', error: new Error('Provider rejected the request') }]
      : [
          { type: 'tool-input-end', id: 'preview-call' },
          { type: 'tool-call', toolCallId: 'preview-call', toolName: 'render', input },
          { type: 'finish', usage, finishReason: { unified: 'tool-calls', raw: 'tool_calls' } }
        ]
  const chunks: ModelChunk[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-input-start', id: 'preview-call', toolName: 'render' },
    ...argumentChunks(input, scenario.pauseAfter).map((delta): ModelChunk => ({
      type: 'tool-input-delta',
      id: 'preview-call',
      delta
    })),
    ...completion
  ]
  const response: ModelChunk[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'done' },
    { type: 'text-delta', id: 'done', delta: 'Rendered.' },
    { type: 'text-end', id: 'done' },
    { type: 'finish', usage, finishReason: { unified: 'stop', raw: 'stop' } }
  ]
  const nextResponse = mockValues<ModelStream>(
    {
      stream: simulateReadableStream({
        chunks,
        initialDelayInMs: null,
        chunkDelayInMs: null
      }).pipeThrough(gate.transform)
    },
    {
      stream: simulateReadableStream({
        chunks: response,
        initialDelayInMs: null,
        chunkDelayInMs: null
      })
    }
  )
  const model = new MockLanguageModelV4({
    async doStream({ abortSignal }) {
      gate.follow(abortSignal)
      return nextResponse()
    }
  })
  return {
    model,
    ready: () => model.doStreamCalls.length > 0,
    requestCount: () => model.doStreamCalls.length,
    advance: gate.advance,
    complete: gate.open,
    fail: gate.fail,
    dispose: gate.close
  }
}
