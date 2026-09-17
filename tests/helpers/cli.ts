import { cliSourcePath } from './paths'

const CLI = cliSourcePath('index.ts')

export interface CLICommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runOpenPencilCLI(args: string[]): Promise<CLICommandResult> {
  // Run the CLI with the Bun that runs the tests, not whatever `bun` PATH
  // resolves to in the child's cwd (version shims can differ or fail there).
  const proc = Bun.spawn([process.execPath, CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}
