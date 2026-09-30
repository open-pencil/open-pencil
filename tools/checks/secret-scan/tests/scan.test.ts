import { describe, expect, test } from 'bun:test'

import { GITLEAKS_ARGS, GITLEAKS_MODULE, runSecretScan, scanCommands } from '../src/scan'

describe('scanCommands', () => {
  test('prefers the installed binary and falls back to the pinned module', () => {
    expect(scanCommands()).toEqual([
      { command: 'gitleaks', args: GITLEAKS_ARGS },
      { command: 'go', args: ['run', GITLEAKS_MODULE, ...GITLEAKS_ARGS] }
    ])
    expect(GITLEAKS_ARGS).toContain('--redact')
  })
})

describe('runSecretScan', () => {
  test('stops at the first installed command and returns its outcome', () => {
    const tried: string[] = []
    const outcome = runSecretScan((candidate) => {
      tried.push(candidate.command)
      return { exitCode: 1, success: false }
    })

    expect(tried).toEqual(['gitleaks'])
    expect(outcome).toEqual({ exitCode: 1, success: false })
  })

  test('falls through a missing binary to the next candidate', () => {
    const tried: string[] = []
    const outcome = runSecretScan((candidate) => {
      tried.push(candidate.command)
      return candidate.command === 'gitleaks' ? null : { exitCode: 0, success: true }
    })

    expect(tried).toEqual(['gitleaks', 'go'])
    expect(outcome).toEqual({ exitCode: 0, success: true })
  })

  test('fails when no candidate is installed', () => {
    expect(runSecretScan(() => null)).toEqual({ exitCode: 1, success: false })
  })
})
