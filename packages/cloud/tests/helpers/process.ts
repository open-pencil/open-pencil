export type RunProcessOptions = {
  cwd: string
  environment?: Record<string, string | undefined>
  stdout?: 'inherit' | 'pipe'
}

export async function runProcess(command: string[], options: RunProcessOptions): Promise<void> {
  const process = Bun.spawn(command, {
    cwd: options.cwd,
    env: options.environment ?? Bun.env,
    stderr: 'inherit',
    stdout: options.stdout ?? 'inherit'
  })
  const exitCode = await process.exited
  if (exitCode !== 0) throw new Error(`${command.join(' ')} exited with code ${exitCode}`)
}

export function composeCommand(projectName: string, composeFiles: string | string[]): string[] {
  const files = typeof composeFiles === 'string' ? [composeFiles] : composeFiles
  return [
    'docker',
    'compose',
    '--project-name',
    projectName,
    ...files.flatMap((file) => ['-f', file])
  ]
}
