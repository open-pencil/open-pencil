import { expect, test } from 'bun:test'
import { setImmediate } from 'node:timers/promises'

import { verifyPublicImports } from '#package-quality/smoke/runtime'
import { measurePhase } from '#package-quality/timing'

import type { CommandRequest } from '@open-pencil/package-artifacts'

test('public imports retain separate bounded Node and Bun invocations and the stdio exclusion', async () => {
  const requests: CommandRequest[] = []
  const release = Promise.withResolvers<undefined>()
  const verification = verifyPublicImports(
    [
      {
        name: '@fixture/library',
        version: '1.0.0',
        exports: { '.': './index.js', './extra': './extra.js' }
      },
      {
        name: '@open-pencil/mcp',
        version: '1.0.0',
        exports: { '.': './index.js', './stdio': './stdio.js' }
      }
    ],
    '/fixture',
    async (request) => {
      requests.push(request)
      await release.promise
      return { stdout: '', stderr: '' }
    }
  )
  try {
    await setImmediate()
    expect(requests).toHaveLength(4)
  } finally {
    release.resolve(undefined)
    await verification
  }
  expect(requests).toHaveLength(6)
  for (const runtime of ['node', 'bun']) {
    const calls = requests.filter(({ command }) => command === runtime)
    expect(calls).toHaveLength(3)
    expect(calls.map(({ args }) => args?.at(-1))).toEqual([
      'await import("@fixture/library")',
      'await import("@fixture/library/extra")',
      'await import("@open-pencil/mcp")'
    ])
    for (const request of calls) {
      expect(request.cwd).toBe('/fixture')
      expect(request.timeoutMs).toBe(30_000)
      expect(request.args).toContain('--eval')
      if (runtime === 'node') expect(request.args).toContain('--input-type=module')
    }
  }
})

test('phase timing preserves successful results when reporting throws', async () => {
  const result = { verified: true }
  expect(
    await measurePhase(
      'imports',
      async () => result,
      () => {
        throw new Error('report failed')
      }
    )
  ).toBe(result)
})

test('phase timing preserves the original exception when reporting throws', async () => {
  const error = new Error('failed import')
  await expect(
    measurePhase(
      'imports',
      async () => {
        throw error
      },
      () => {
        throw new Error('report failed')
      }
    )
  ).rejects.toBe(error)
})

test('phase timing preserves results and exceptions', async () => {
  const reports: string[] = []
  const result = { verified: true }
  expect(
    await measurePhase(
      'imports',
      async () => result,
      (line) => reports.push(line)
    )
  ).toBe(result)
  const error = new Error('failed import')
  await expect(
    measurePhase(
      'imports',
      async () => {
        throw error
      },
      (line) => reports.push(line)
    )
  ).rejects.toBe(error)
  expect(reports[0]).toMatch(/^\[package-quality\] imports: completed in \d+\.\d{2}s$/)
  expect(reports[1]).toMatch(/^\[package-quality\] imports: failed in \d+\.\d{2}s$/)
})
