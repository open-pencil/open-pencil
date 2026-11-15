import { Command } from '@tauri-apps/plugin-shell'

import { decodeTauriStderr } from '@/app/shell/ui'
import { spawnAgentChild } from '@/app/tauri/children'
import { resolvePlatformCommand } from '@/app/tauri/command'

/** A running agent process, as plugin-shell gives it: its stdin and its end. */
export interface AgentChild {
  write(data: number[]): Promise<void>
  kill(): Promise<void>
}

/** A started agent: its process, what it writes to stdout, and how to write to its stdin. */
export interface AgentProcess {
  child: AgentChild
  stdout: ReadableStream<Uint8Array>
  write(bytes: Uint8Array): Promise<void>
}

export interface AgentProcessOptions {
  /** The program, resolved for the platform, as a Windows command shim is. */
  command: string
  args?: string[]
  env: Record<string, string>
  cwd?: string
  /** What the agent wrote to stderr, which is diagnostics only. */
  onStderr: (text: string) => void
  /**
   * Why stdout ended when the process closed: an error fails a reader still waiting on it, and
   * null ends it as finished, as when the process was stopped on purpose.
   */
  closeError?: () => Error | null
  /** The process closed, whoever ended it. */
  onClose: () => void
}

/**
 * Starts an agent process that talks over its standard streams: an ACP agent or the Harness
 * companion. It starts through `spawnAgentChild`, so the next page stops it if this one leaves it
 * running.
 */
export async function spawnAgentProcess({
  command: program,
  args = [],
  env,
  cwd,
  onStderr,
  closeError = () => null,
  onClose
}: AgentProcessOptions): Promise<AgentProcess> {
  const resolved = resolvePlatformCommand(program, args)
  const command = Command.create(resolved.command, resolved.args, { encoding: 'raw', env, cwd })

  let output: ReadableStreamDefaultController<Uint8Array> | undefined
  // A reader that cancelled stdout wants no more of it; the process may still write.
  let open = true
  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller
    },
    cancel() {
      open = false
    }
  })
  command.stdout.on('data', (raw: Uint8Array | number[]) => {
    if (open) output?.enqueue(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
  })
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    onStderr(decodeTauriStderr(raw))
  })
  command.on('close', () => {
    if (open) {
      open = false
      const error = closeError()
      if (error) output?.error(error)
      else output?.close()
    }
    onClose()
  })

  const child = await spawnAgentChild(command)
  return {
    child,
    stdout,
    async write(bytes) {
      await child.write(Array.from(bytes))
    }
  }
}
