import * as v from 'valibot'

import type { HarnessSidecarMessage, JSONValue } from '@open-pencil/harness'

import { resolvePlatformCommand } from '@/app/tauri/command'

/** Any value `JSON.parse` produced is a JSONValue; only presence needs checking. */
const jsonValue = v.custom<JSONValue>((value) => value !== undefined)

const HarnessTurnEventSchema = v.variant('type', [
  v.object({ type: v.literal('text-delta'), text: v.string() }),
  v.object({ type: v.literal('reasoning-delta'), text: v.string() }),
  v.object({
    type: v.literal('tool-call'),
    toolCallId: v.string(),
    toolName: v.string(),
    input: jsonValue
  }),
  v.object({
    type: v.literal('tool-result'),
    toolCallId: v.string(),
    toolName: v.string(),
    output: jsonValue
  }),
  v.object({ type: v.literal('finish'), finishReason: v.string() }),
  v.object({ type: v.literal('error'), message: v.string() })
])

const HarnessSidecarMessageJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.variant('type', [
    v.object({
      type: v.literal('response'),
      id: v.string(),
      result: v.optional(jsonValue),
      error: v.optional(v.string())
    }),
    v.object({ type: v.literal('turn.event'), id: v.string(), event: HarnessTurnEventSchema })
  ])
) satisfies v.GenericSchema<string, HarnessSidecarMessage>

export type HarnessChild = {
  write(data: number[]): Promise<void>
  kill(): Promise<void>
}

export type HarnessProcess = {
  child: HarnessChild
  messages: ReadableStream<HarnessSidecarMessage>
  send(request: object): Promise<void>
}

export async function spawnHarnessProcess(options: {
  environment: Record<string, string>
  onUnexpectedClose: () => void
}): Promise<HarnessProcess> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const resolved = resolvePlatformCommand('openpencil-harness')
  const command = Command.create(resolved.command, resolved.args, {
    encoding: 'raw',
    env: options.environment
  })
  let buffer = ''
  let controller: ReadableStreamDefaultController<HarnessSidecarMessage> | undefined
  const decoder = new TextDecoder()

  const messages = new ReadableStream<HarnessSidecarMessage>({
    start(streamController) {
      controller = streamController
    }
  })

  function flush(chunk: Uint8Array): void {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const message = v.safeParse(HarnessSidecarMessageJSON, line)
      if (message.success) controller?.enqueue(message.output)
      else console.warn('[Harness] Ignoring malformed sidecar output:', v.summarize(message.issues))
    }
  }

  command.stdout.on('data', (raw: Uint8Array | number[]) => {
    flush(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
  })
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    const text = typeof raw === 'string' ? raw : decoder.decode(new Uint8Array(raw))
    // Diagnostics only: the companion reports failures as protocol errors.
    console.warn('[Harness]', text)
  })
  command.on('close', () => {
    controller?.close()
    options.onUnexpectedClose()
  })

  const child = await command.spawn()
  return {
    child,
    messages,
    async send(request) {
      await child.write(Array.from(new TextEncoder().encode(`${JSON.stringify(request)}\n`)))
    }
  }
}
