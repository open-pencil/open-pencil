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

/**
 * How long the stream waits before each kind of chunk, in milliseconds. A visitor who has never
 * seen an agent at work needs time to read the reasoning and watch the canvas fill.
 */
export interface StreamPace {
  /** Before the first chunk of each step, as a model takes a moment to start answering. */
  start: number
  /** Before each word of reasoning and of the reply. */
  word: number
  /** Between the reasoning and the tool call, and before the reply starts. */
  pause: number
  /** Before each piece of the tool call's arguments, which the canvas previews as they arrive. */
  argument: number
}

const ARGUMENT_CHUNK_LENGTH = 12
const WORD_CHUNK = /\S+\s*/g

interface PacedChunk {
  chunk: ModelChunk
  /** Which of the pace's waits comes before this chunk, if any. */
  wait?: keyof StreamPace
}

function split(text: string, length: number): string[] {
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += length) {
    chunks.push(text.slice(offset, offset + length))
  }
  return chunks
}

/** The first step: reasoning, then the `render` call with its arguments arriving in pieces. */
function toolStep({ reasoning, render }: RecordedTurn): PacedChunk[] {
  const input = JSON.stringify(render)
  return [
    { chunk: { type: 'stream-start', warnings: [] }, wait: 'start' },
    { chunk: { type: 'reasoning-start', id: 'reasoning' } },
    ...(reasoning.match(WORD_CHUNK) ?? []).map((delta): PacedChunk => ({
      chunk: { type: 'reasoning-delta', id: 'reasoning', delta },
      wait: 'word'
    })),
    { chunk: { type: 'reasoning-end', id: 'reasoning' } },
    { chunk: { type: 'tool-input-start', id: 'render-call', toolName: 'render' }, wait: 'pause' },
    ...split(input, ARGUMENT_CHUNK_LENGTH).map((delta): PacedChunk => ({
      chunk: { type: 'tool-input-delta', id: 'render-call', delta },
      wait: 'argument'
    })),
    { chunk: { type: 'tool-input-end', id: 'render-call' } },
    { chunk: { type: 'tool-call', toolCallId: 'render-call', toolName: 'render', input } },
    {
      chunk: {
        type: 'finish',
        usage: USAGE,
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' }
      }
    }
  ]
}

/** The second step, after the tool result: the closing reply. */
function replyStep({ reply }: RecordedTurn): PacedChunk[] {
  return [
    { chunk: { type: 'stream-start', warnings: [] }, wait: 'pause' },
    { chunk: { type: 'text-start', id: 'reply' } },
    ...(reply.match(WORD_CHUNK) ?? []).map((delta): PacedChunk => ({
      chunk: { type: 'text-delta', id: 'reply', delta },
      wait: 'word'
    })),
    { chunk: { type: 'text-end', id: 'reply' } },
    { chunk: { type: 'finish', usage: USAGE, finishReason: { unified: 'stop', raw: 'stop' } } }
  ]
}

/**
 * Streams the chunks, waiting before each as the pace says, or not at all without one. Pulled
 * one chunk at a time, so a stopped chat stops the playback too.
 */
function playback(chunks: PacedChunk[], pace: StreamPace | null): ReadableStream<ModelChunk> {
  let index = 0
  return new ReadableStream<ModelChunk>({
    async pull(controller) {
      const next = chunks[index++]
      if (!next) {
        controller.close()
        return
      }
      const wait = pace && next.wait ? pace[next.wait] : 0
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      controller.enqueue(next.chunk)
    }
  })
}

/**
 * A language model that plays back one recorded turn, built from the AI SDK's own test
 * helpers. The agent loop, the `render` tool, its streamed canvas preview, and the undo step
 * all run for real; only the provider is replaced. Without a `pace`, it streams at once.
 */
export function createRecordedModel(turn: RecordedTurn, pace: StreamPace | null) {
  return new MockLanguageModelV4({
    async doStream({ prompt }) {
      const answered = prompt.some((message) => message.role === 'tool')
      return {
        stream: playback(answered ? replyStep(turn) : toolStep(turn), pace)
      }
    }
  })
}
