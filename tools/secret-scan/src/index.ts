const GITLEAKS_VERSION = 'v8.30.1'
const GITLEAKS_MODULE = `github.com/zricethezav/gitleaks/v8@${GITLEAKS_VERSION}`

const gitleaksArgs = ['dir', '--config', '.gitleaks.toml', '--redact', '--no-banner', '.']

function run(command: string, args: string[]): Bun.SpawnSyncReturns<Buffer> | null {
  try {
    return Bun.spawnSync([command, ...args], {
      stdout: 'inherit',
      stderr: 'inherit'
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const proc = run('gitleaks', gitleaksArgs) ?? run('go', ['run', GITLEAKS_MODULE, ...gitleaksArgs])

if (!proc?.success) {
  console.error('Secret scan failed.')
  process.exit(proc?.exitCode || 1)
}

console.log('Secret scan passed.')
