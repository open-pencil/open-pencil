import { spawn } from 'node:child_process'

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

function commandFailureReason(
  request: CommandRequest,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  timedOut: boolean
): string {
  if (timedOut) return `timed out after ${request.timeoutMs}ms`
  if (signal) return `signal ${signal}`
  return `exit code ${exitCode ?? 'unknown'}`
}

export async function runCommand(request: CommandRequest): Promise<CommandResult> {
  const args = request.args ?? []
  const output = request.output ?? 'capture'

  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(request.command, args, {
      cwd: request.cwd,
      env: request.env,
      stdio: output === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => (stdout += chunk))
    child.stderr?.on('data', (chunk: string) => (stderr += chunk))

    let timedOut = false
    const timeout = request.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          child.kill('SIGKILL')
        }, request.timeoutMs)
      : undefined

    child.once('error', (error) => {
      if (timeout) clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (exitCode, signal) => {
      if (timeout) clearTimeout(timeout)
      if (exitCode === 0) {
        resolve({ stderr, stdout })
        return
      }
      const rendered = [request.command, ...args].join(' ')
      const reason = commandFailureReason(request, exitCode, signal, timedOut)
      reject(
        new CommandError(
          `${rendered} failed: ${reason}`,
          request,
          exitCode,
          stdout,
          stderr,
          timedOut
        )
      )
    })
  })
}
