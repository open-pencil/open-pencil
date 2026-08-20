import type { HarnessSidecarMessage } from '@open-pencil/harness'

import { resolvePlatformCommand } from '@/app/tauri/command'

export const HARNESS_COMPANION_VERSION =
  typeof __OPENPENCIL_APP_VERSION__ === 'string' ? __OPENPENCIL_APP_VERSION__ : '0.0.0-test'
export const HARNESS_INSTALL_COMMAND = 'npm install -g @open-pencil/harness'

export type HarnessCompanionStatus =
  | { state: 'installed'; version: string }
  | { state: 'missing' }
  | { state: 'unavailable'; error: string }
  | { state: 'incompatible'; version: string }

export type HarnessChild = {
  write(data: number[]): Promise<void>
  kill(): Promise<void>
}

export type HarnessProcess = {
  child: HarnessChild
  messages: ReadableStream<HarnessSidecarMessage>
  send(request: object): Promise<void>
}

function commandName(): { command: string; args: string[] } {
  return resolvePlatformCommand('openpencil-harness')
}

function isMissingCommand(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('program not found')
}

async function queryHarnessCompanionVersion(): Promise<string> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const resolved = commandName()
  const output = await Command.create(resolved.command, [...resolved.args, '--version']).execute()
  if (output.code !== 0) throw new Error(output.stderr.trim() || 'Harness companion check failed')
  return output.stdout.trim()
}

export async function queryHarnessCompanion(): Promise<HarnessCompanionStatus> {
  try {
    const version = await queryHarnessCompanionVersion()
    return version === HARNESS_COMPANION_VERSION
      ? { state: 'installed', version }
      : { state: 'incompatible', version }
  } catch (error) {
    if (isMissingCommand(error)) return { state: 'missing' }
    return { state: 'unavailable', error: error instanceof Error ? error.message : String(error) }
  }
}

export async function spawnHarnessProcess(options: {
  environment: Record<string, string>
  onUnexpectedClose: () => void
}): Promise<HarnessProcess> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const resolved = commandName()
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
        console.warn('[Harness] Ignoring malformed companion output:', error)
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
