import type { AIModel } from '#cloud/contract'
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
export function creditsFor(model: AIModel, usage: TokenUsage): number {
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
  body: ReadableStream<Uint8Array>,
  streamed: boolean
): Promise<TokenUsage | null> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const chunks = async function* () {
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      yield decoder.decode(next.value, { stream: true })
    }
    yield decoder.decode()
  }
  if (!streamed) {
    let text = ''
    for await (const chunk of chunks()) text += chunk
    return usageOf(text)
  }
  let usage: TokenUsage | null = null
  let pending = ''
  const read = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice('data:'.length).trim()
    if (data === '[DONE]') return
    usage = usageOf(data) ?? usage
  }
  for await (const chunk of chunks()) {
    pending += chunk
    const parts = pending.split(/\r?\n/)
    pending = parts.pop() ?? ''
    for (const line of parts) read(line)
  }
  read(pending)
  return usage
}
