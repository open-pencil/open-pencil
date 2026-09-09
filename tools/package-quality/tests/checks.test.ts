import { expect, test } from 'bun:test'

import { CommandError, type CommandRequest } from '@open-pencil/package-artifacts'

import { runPackageChecks } from '../src/checks/run'

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
