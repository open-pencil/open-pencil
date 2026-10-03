import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

type ModelStream = Awaited<ReturnType<MockLanguageModelV4['doStream']>>
type ModelChunk = ModelStream['stream'] extends ReadableStream<infer Chunk> ? Chunk : never

export interface RecordedTurn {
  reasoning: string
  /** Input of the one `render` tool call, streamed as the model would. */
  render: { parent_id: string; jsx: string }
  reply: string
}

/** Token usage the agent loop requires; nothing on the page reads it. */
const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined }
}

const ARGUMENT_CHUNK_LENGTH = 24
const WORD_CHUNK = /\S+\s*/g

function split(text: string, length: number): string[] {
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += length) {
    chunks.push(text.slice(offset, offset + length))
  }
  return chunks
}

/** The first step: reasoning, then the `render` call with its arguments arriving in pieces. */
function toolStep({ reasoning, render }: RecordedTurn): ModelChunk[] {
  const input = JSON.stringify(render)
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'reasoning-start', id: 'reasoning' },
    ...(reasoning.match(WORD_CHUNK) ?? []).map(
      (delta): ModelChunk => ({ type: 'reasoning-delta', id: 'reasoning', delta })
    ),
    { type: 'reasoning-end', id: 'reasoning' },
    { type: 'tool-input-start', id: 'render-call', toolName: 'render' },
    ...split(input, ARGUMENT_CHUNK_LENGTH).map(
      (delta): ModelChunk => ({ type: 'tool-input-delta', id: 'render-call', delta })
    ),
    { type: 'tool-input-end', id: 'render-call' },
    { type: 'tool-call', toolCallId: 'render-call', toolName: 'render', input },
    { type: 'finish', usage: USAGE, finishReason: { unified: 'tool-calls', raw: 'tool_calls' } }
  ]
}

/** The second step, after the tool result: the closing reply. */
function replyStep({ reply }: RecordedTurn): ModelChunk[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'reply' },
    ...(reply.match(WORD_CHUNK) ?? []).map(
      (delta): ModelChunk => ({ type: 'text-delta', id: 'reply', delta })
    ),
    { type: 'text-end', id: 'reply' },
    { type: 'finish', usage: USAGE, finishReason: { unified: 'stop', raw: 'stop' } }
  ]
}

/**
 * A language model that plays back one recorded turn, built from the AI SDK's own test
 * helpers. The agent loop, the `render` tool, its streamed canvas preview, and the undo step
 * all run for real; only the provider is replaced. `chunkDelayMs` paces the stream.
 */
export function createRecordedModel(turn: RecordedTurn, chunkDelayMs: number | null) {
  return new MockLanguageModelV4({
    async doStream({ prompt }) {
      const answered = prompt.some((message) => message.role === 'tool')
      return {
        stream: simulateReadableStream({
          chunks: answered ? replyStep(turn) : toolStep(turn),
          initialDelayInMs: chunkDelayMs,
          chunkDelayInMs: chunkDelayMs
        })
      }
    }
  })
}
