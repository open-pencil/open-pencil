import { describe, expect, test } from 'bun:test'

import { CommandError, runCommand } from '../src/process'

describe('runCommand', () => {
  test('captures output', async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ['--eval', "process.stdout.write('ready')"],
      cwd: process.cwd()
    })
    expect(result.stdout).toBe('ready')
  })

  test('captures output larger than a pipe buffer before resolving', async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ['--eval', "process.stdout.write('x'.repeat(262144)); process.stderr.write('done')"],
      cwd: process.cwd(),
      timeoutMs: 10_000
    })
    expect(result.stdout).toHaveLength(262144)
    expect(result.stderr).toBe('done')
  })

  test('reports missing executables', async () => {
    await expect(
      runCommand({
        command: '/nonexistent/open-pencil-command',
        cwd: process.cwd(),
        timeoutMs: 1000
      })
    ).rejects.toThrow()
  })

  test('returns structured command failures', async () => {
    const failure = runCommand({
      command: process.execPath,
      args: ['--eval', "process.stderr.write('broken'); process.exit(7)"],
      cwd: process.cwd()
    })
    const error = await failure.catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CommandError)
    if (!(error instanceof CommandError)) throw new Error('Expected CommandError')
    expect(error.exitCode).toBe(7)
    expect(error.stderr).toBe('broken')
  })

  test('terminates commands after their deadline', async () => {
    const error = await runCommand({
      command: process.execPath,
      args: ['--eval', 'setTimeout(() => {}, 10_000)'],
      cwd: process.cwd(),
      timeoutMs: 20
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CommandError)
    if (!(error instanceof CommandError)) throw new Error('Expected CommandError')
    expect(error.timedOut).toBe(true)
    expect(error.message).toContain('timed out after 20ms')
  })
})
