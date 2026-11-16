import type { ChatModel } from '#cloud/contract'
import { EventSourceParserStream } from 'eventsource-parser/stream'
import * as v from 'valibot'

export type TokenUsage = { inputTokens: number; outputTokens: number }

const tokensSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const usageSchema = v.object({
  usage: v.object({ prompt_tokens: tokensSchema, completion_tokens: tokensSchema })
})

const usageBodySchema = v.pipe(v.string(), v.parseJson(), usageSchema)

function usageOf(text: string): TokenUsage | null {
  const parsed = v.safeParse(usageBodySchema, text)
  if (!parsed.success) return null
  return {
    inputTokens: parsed.output.usage.prompt_tokens,
    outputTokens: parsed.output.usage.completion_tokens
  }
}

/** Credits a request costs, rounded up so a request is never free. */
export function creditsFor(model: ChatModel, usage: TokenUsage): number {
  return Math.ceil(
    (usage.inputTokens * model.creditsPerMillionInputTokens +
      usage.outputTokens * model.creditsPerMillionOutputTokens) /
      1_000_000
  )
}

/**
 * Reads the token usage of a chat completion: the `usage` of a JSON answer, or of the last stream
 * event that carries one, which upstreams send when asked with `stream_options.include_usage`.
 */
export async function meteredUsage(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  streamed: boolean
): Promise<TokenUsage | null> {
  if (!streamed) return usageOf(await new Response(body).text())
  // Server-sent events, as OpenAI-compatible APIs stream them; `[DONE]` ends the stream.
  let usage: TokenUsage | null = null
  const events = body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
  for await (const event of events) {
    if (event.data !== '[DONE]') usage = usageOf(event.data) ?? usage
  }
  return usage
}
