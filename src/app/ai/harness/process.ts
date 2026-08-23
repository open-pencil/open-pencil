import type { HarnessSidecarMessage } from '@open-pencil/harness'

import { resolvePlatformCommand } from '@/app/tauri/command'

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
      try {
        controller?.enqueue(JSON.parse(line) as HarnessSidecarMessage)
      } catch (error) {
        console.warn('[Harness] Ignoring malformed sidecar output:', error)
      }
    }
  }

  command.stdout.on('data', (raw: Uint8Array | number[]) => {
    flush(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
  })
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    const text = typeof raw === 'string' ? raw : decoder.decode(new Uint8Array(raw))
    console.error('[Harness]', text)
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
