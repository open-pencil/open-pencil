export async function runPackageQualityCommand(entrypoints: string[]): Promise<void> {
  for (const entrypoint of entrypoints) {
    const process = Bun.spawn(['bun', entrypoint], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    })
    const exitCode = await process.exited
    if (exitCode !== 0) throw new Error(`${entrypoint} exited with code ${exitCode}`)
  }
}
