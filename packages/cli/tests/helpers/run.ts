import { CLI_ENTRY } from '#cli-tests/helpers/paths'

export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface CLIRunOptions {
  /** Text piped to the CLI's standard input. */
  stdin?: string
  /** Variables added to the test's own environment. */
  env?: Record<string, string>
}

/**
 * Runs the CLI from source as a subprocess, with the Bun that runs the tests rather than whatever
 * `bun` a child's PATH resolves (version shims can differ or fail there), and returns its output
 * trimmed.
 */
export async function runCLI(args: string[], options: CLIRunOptions = {}): Promise<CLIResult> {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: options.stdin === undefined ? undefined : Buffer.from(options.stdin),
    env: options.env ? { ...process.env, ...options.env } : undefined
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}
