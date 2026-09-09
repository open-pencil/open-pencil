import { x } from 'tinyexec'

export interface CommandRequest {
  args?: string[]
  command: string
  cwd: string
  env?: NodeJS.ProcessEnv
  output?: 'capture' | 'inherit'
  timeoutMs?: number
}

export interface CommandResult {
  stderr: string
  stdout: string
}

export class CommandError extends Error {
  constructor(
    message: string,
    readonly request: CommandRequest,
    readonly exitCode: number | null,
    readonly stdout: string,
    readonly stderr: string,
    readonly timedOut: boolean
  ) {
    super(message)
    this.name = 'CommandError'
  }
}

/** Project diagnostics only; tinyexec owns spawning, stream completion and cancellation. */
export async function runCommand(request: CommandRequest): Promise<CommandResult> {
  const deadline =
    request.timeoutMs === undefined ? undefined : AbortSignal.timeout(request.timeoutMs)
  // tinyexec distinguishes cancellation from its own timeout errors. Use cancellation
  // so completed output remains available for the project's timeout diagnostics.
  const controller = new AbortController()
  const cancel = () => controller.abort()
  deadline?.addEventListener('abort', cancel, { once: true })
  try {
    const result = x(request.command, request.args ?? [], {
      signal: controller.signal,
      nodePath: false,
      nodeOptions: {
        cwd: request.cwd,
        env: request.env,
        killSignal: 'SIGKILL',
        stdio: request.output === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'pipe']
      }
    })
    const { stdout, stderr, exitCode } = await result
    const timedOut = deadline?.aborted ?? false
    if (exitCode === 0 && !timedOut) return { stdout, stderr }
    const reason = timedOut
      ? `timed out after ${request.timeoutMs}ms`
      : `exit code ${exitCode ?? result.signalCode ?? 'unknown'}`
    throw new CommandError(
      `${[request.command, ...(request.args ?? [])].join(' ')} failed: ${reason}`,
      request,
      exitCode ?? null,
      stdout,
      stderr,
      timedOut
    )
  } finally {
    deadline?.removeEventListener('abort', cancel)
  }
}
