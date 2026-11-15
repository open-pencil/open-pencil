import { Command } from '@tauri-apps/plugin-shell'

import { createDeferred } from '@/app/runtime/deferred'
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

  // What the agent wrote and nobody has read yet, delivered before its end, so a message it
  // wrote just before it exited still arrives whole.
  const pending: Uint8Array[] = []
  let ended: { error: Error | null } | null = null
  let arrived = createDeferred<undefined>()
  /** Something arrived for a read waiting on it: output, or the end. */
  const settle = () => {
    arrived.resolve(undefined)
    arrived = createDeferred<undefined>()
  }
  const stdout = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        // A read is asked for only when the last one was answered, so one wait is enough: the
        // next chunk or the end resolves it.
        if (pending.length === 0 && !ended) await arrived.promise
        const chunk = pending.shift()
        if (chunk) controller.enqueue(chunk)
        else if (ended?.error) controller.error(ended.error)
        else controller.close()
      },
      cancel() {
        ended = { error: null }
        pending.length = 0
        settle()
      }
    },
    { highWaterMark: 0 }
  )
  command.stdout.on('data', (raw: Uint8Array | number[]) => {
    if (ended) return
    pending.push(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
    settle()
  })
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    onStderr(decodeTauriStderr(raw))
  })
  command.on('close', () => {
    ended ??= { error: closeError() }
    settle()
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
