import { runSecretScan, type ScanCommand, type ScanOutcome } from './scan'

function spawn({ command, args }: ScanCommand): ScanOutcome | null {
  try {
    const proc = Bun.spawnSync([command, ...args], { stdout: 'inherit', stderr: 'inherit' })
    return { exitCode: proc.exitCode, success: proc.success }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

const outcome = runSecretScan(spawn)
if (!outcome.success) {
  console.error('Secret scan failed.')
  process.exit(outcome.exitCode || 1)
}
console.log('Secret scan passed.')
