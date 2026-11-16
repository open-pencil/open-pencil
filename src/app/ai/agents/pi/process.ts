import * as v from 'valibot'

import type { HarnessSidecarMessage, JSONValue } from '@open-pencil/harness'

import { spawnAgentProcess, type AgentChild } from '@/app/ai/agents/process'
import { tokenUsageSchema } from '@/app/diagnostics/events/schema'

/** Any value `JSON.parse` produced is a JSONValue; only presence needs checking. */
const jsonValueSchema = v.custom<JSONValue>((value) => value !== undefined)

const harnessTurnEventSchema = v.variant('type', [
  v.object({ type: v.literal('text-delta'), text: v.string() }),
  v.object({ type: v.literal('reasoning-delta'), text: v.string() }),
  v.object({
    type: v.literal('tool-call'),
    toolCallId: v.string(),
    toolName: v.string(),
    input: jsonValueSchema
  }),
  v.object({
    type: v.literal('tool-result'),
    toolCallId: v.string(),
    toolName: v.string(),
    output: jsonValueSchema
  }),
  v.object({
    type: v.literal('finish'),
    finishReason: v.string(),
    // Companions before usage reporting send none.
    usage: v.optional(tokenUsageSchema)
  }),
  v.object({
    type: v.literal('compaction'),
    trigger: v.picklist(['manual', 'auto']),
    summary: v.string(),
    tokensBefore: v.nullable(v.number())
  }),
  v.object({ type: v.literal('error'), message: v.string() })
])

const harnessSidecarMessageSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.variant('type', [
    v.object({
      type: v.literal('response'),
      id: v.string(),
      result: v.optional(jsonValueSchema),
      error: v.optional(v.string())
    }),
    v.object({ type: v.literal('turn.event'), id: v.string(), event: harnessTurnEventSchema })
  ])
) satisfies v.GenericSchema<string, HarnessSidecarMessage>

export type HarnessProcess = {
  child: AgentChild
  messages: ReadableStream<HarnessSidecarMessage>
  send(request: object): Promise<void>
}

/**
 * The companion's messages, one JSON object to a line. A line that is not one is reported and
 * skipped, so one bad write does not end the session.
 */
function sidecarMessages(): TransformStream<Uint8Array, HarnessSidecarMessage> {
  const decoder = new TextDecoder()
  let buffer = ''
  const parse = (
    line: string,
    controller: TransformStreamDefaultController<HarnessSidecarMessage>
  ) => {
    if (!line.trim()) return
    const message = v.safeParse(harnessSidecarMessageSchema, line)
    if (message.success) controller.enqueue(message.output)
    else console.warn('[Harness] Ignoring malformed sidecar output:', v.summarize(message.issues))
  }
  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) parse(line, controller)
    },
    flush(controller) {
      parse(buffer + decoder.decode(), controller)
    }
  })
}

export async function spawnHarnessProcess(options: {
  environment: Record<string, string>
  onUnexpectedClose: () => void
}): Promise<HarnessProcess> {
  const companion = await spawnAgentProcess({
    command: 'openpencil-harness',
    env: options.environment,
    // Diagnostics only: the companion reports failures as protocol errors.
    onStderr: (text) => console.warn('[Harness]', text),
    onClose: options.onUnexpectedClose
  })
  const encoder = new TextEncoder()
  return {
    child: companion.child,
    messages: companion.stdout.pipeThrough(sidecarMessages()),
    send: (request) => companion.write(encoder.encode(`${JSON.stringify(request)}\n`))
  }
}
