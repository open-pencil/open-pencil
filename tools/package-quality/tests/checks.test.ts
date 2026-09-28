import { expect, test } from 'bun:test'

import { runPackageChecks } from '#package-quality/checks/run'

import { CommandError, type CommandRequest } from '@open-pencil/package-artifacts'

test('bounded checks drain after failures and preserve diagnostic order', async () => {
  const requests = Array.from({ length: 5 }, (_, index) => ({
    command: String(index),
    cwd: '/fixture'
  }))
  const entered = requests.map(() => Promise.withResolvers<undefined>())
  const releases = requests.map(() => Promise.withResolvers<undefined>())
  let active = 0
  let peak = 0
  let settled = false
  const completion = runPackageChecks(
    requests,
    async (request) => {
      const index = Number(request.command)
      active++
      peak = Math.max(peak, active)
      entered[index]?.resolve(undefined)
      await releases[index]?.promise
      active--
      if (index < 2) throw new Error(`failure ${index}`)
      return { stdout: '', stderr: '' }
    },
    2
  )
    .catch((error: unknown) => error)
    .finally(() => {
      settled = true
    })
  try {
    await Promise.all(entered.slice(0, 2).map(({ promise }) => promise))
    expect(active).toBe(2)
    releases[1]?.resolve(undefined)
    await entered[2]?.promise
    expect(settled).toBe(false)
    expect(active).toBe(2)
  } finally {
    for (const release of releases) release.resolve(undefined)
  }
  const error = await completion
  expect(peak).toBe(2)
  expect(active).toBe(0)
  expect(error).toBeInstanceOf(AggregateError)
  if (!(error instanceof AggregateError)) throw new Error('Expected aggregate diagnostics')
  expect(error.message).toBe('failure 0\n\nfailure 1')
})

test('package checks finish all requests and retain output from every failure', async () => {
  const visited: string[] = []
  const requests = ['first', 'second', 'third'].map((command) => ({ command, cwd: '/fixture' }))
  const error = await runPackageChecks(requests, async (request: CommandRequest) => {
    visited.push(request.command)
    if (request.command !== 'second') {
      throw new CommandError(
        `failed ${request.command}`,
        request,
        1,
        `stdout ${request.command}`,
        `stderr ${request.command}`,
        false
      )
    }
    return { stdout: '', stderr: '' }
  }).catch((caught: unknown) => caught)
  expect(visited).toEqual(['first', 'second', 'third'])
  expect(error).toBeInstanceOf(AggregateError)
  if (!(error instanceof AggregateError)) throw new Error('Expected aggregate diagnostics')
  expect(error.errors).toHaveLength(2)
  expect(error.message).toContain('stdout first')
  expect(error.message).toContain('stderr third')
})
