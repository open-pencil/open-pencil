import { startHostProgram, type HostChild, type HostProgram, type PermissionNotice } from '@/app/tauri/host'

/** A running agent process: its end. */
export type AgentChild = Pick<HostChild, 'kill'>

/** A started agent: its process, what it writes to stdout, and how to write to its stdin. */
export interface AgentProcess {
  child: AgentChild
  stdout: ReadableStream<Uint8Array>
  write(bytes: Uint8Array): Promise<void>
}

export interface AgentProcessOptions {
  /** Which program from the desktop app's table. */
  program: HostProgram
  /** What the agent wrote to stderr, which is diagnostics only. */
  onStderr: (text: string) => void
  /**
   * Why stdout ended when the process closed: an error fails a reader still waiting on it, and
   * null ends it as finished, as when the process was stopped on purpose.
   */
  closeError?: () => Error | null
  /** The process closed, whoever ended it. */
  onClose: () => void
  /** The agent waits on the person in the desktop app's permission window, or stopped waiting. */
  onPermission?: (event: PermissionNotice) => void
}

/**
 * Starts an agent process that talks JSON lines over its standard streams: an ACP agent or the
 * Harness companion. The desktop app starts it, checks what passes between it and the editor,
 * and stops it when this page reloads.
 */
export async function spawnAgentProcess({
  program,
  onStderr,
  closeError = () => null,
  onClose,
  onPermission
}: AgentProcessOptions): Promise<AgentProcess> {
  // The process's output, queued by the stream until it is read. It closes when the process
  // does; an exit with an error fails the stream only after what was queued is read, since
  // `flush` runs once every chunk has passed through.
  let source: ReadableStreamDefaultController<Uint8Array> | undefined
  let open = true
  let exitError: Error | null = null
  const output = new ReadableStream<Uint8Array>({
    start(controller) {
      source = controller
    },
    cancel() {
      open = false
    }
  })
  const stdout = output.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush() {
        if (exitError) throw exitError
      }
    })
  )
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const child = await startHostProgram(program, {
    onStdout: (data) => {
      if (open) source?.enqueue(encoder.encode(data))
    },
    onStderr,
    onPermission,
    onClose: () => {
      if (open) {
        open = false
        exitError = closeError()
        source?.close()
      }
      onClose()
    }
  })
  return {
    child,
    stdout,
    // A character split across writes waits for its last byte.
    write: (bytes) => child.write(decoder.decode(bytes, { stream: true }))
  }
}
