import { runCommand } from '@open-pencil/package-artifacts-tools'

const METADATA_TIMEOUT_MS = 60_000
export const ARTIFACT_TRANSFER_TIMEOUT_MS = 15 * 60_000

/** Release-specific command defaults; shared tooling owns spawning and diagnostics. */
export function releaseCommands(cwd: string, execute = runCommand) {
  async function git(...args: string[]): Promise<string> {
    const result = await execute({ command: 'git', args, cwd, timeoutMs: METADATA_TIMEOUT_MS })

    return result.stdout.trim()
  }

  async function github(args: string[], timeoutMs = METADATA_TIMEOUT_MS): Promise<string> {
    const result = await execute({ command: 'gh', args, cwd, timeoutMs })

    return result.stdout
  }

  async function verifySignature(artifact: string, publicKey: string, signature: string) {
    await execute({
      command: 'minisign',
      args: ['-Vm', artifact, '-p', publicKey, '-x', signature],
      cwd,
      output: 'inherit',
      timeoutMs: METADATA_TIMEOUT_MS
    })
  }

  return { git, github, verifySignature }
}
