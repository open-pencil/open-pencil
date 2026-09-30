export const GITLEAKS_VERSION = 'v8.30.1'
export const GITLEAKS_MODULE = `github.com/zricethezav/gitleaks/v8@${GITLEAKS_VERSION}`
export const GITLEAKS_ARGS = ['dir', '--config', '.gitleaks.toml', '--redact', '--no-banner', '.']

export interface ScanCommand {
  command: string
  args: string[]
}

/** The installed `gitleaks` binary when present, otherwise the pinned module through `go run`. */
export function scanCommands(): ScanCommand[] {
  return [
    { command: 'gitleaks', args: GITLEAKS_ARGS },
    { command: 'go', args: ['run', GITLEAKS_MODULE, ...GITLEAKS_ARGS] }
  ]
}

export interface ScanOutcome {
  exitCode: number
  success: boolean
}

/** `null` means the command is not installed and the next candidate should run. */
export type ScanRunner = (command: ScanCommand) => ScanOutcome | null

/** Runs the first available command; a missing binary falls through, any other result is final. */
export function runSecretScan(run: ScanRunner, candidates = scanCommands()): ScanOutcome {
  for (const candidate of candidates) {
    const outcome = run(candidate)
    if (outcome) return outcome
  }
  return { exitCode: 1, success: false }
}
