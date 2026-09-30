import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { desktopBuilds, desktopTargets } from '#release/native/catalog'
import { ARTIFACT_TRANSFER_TIMEOUT_MS, releaseCommands } from '#release/native/commands'
import { createReleaseContext, releaseVersion } from '#release/native/context'
import { releasePaths } from '#release/workflow'

import type { CommandRequest } from '@open-pencil/package-artifacts-tools'

const environment = {
  RELEASE_TAG: 'v0.15.0',
  SOURCE_COMMIT: 'a'.repeat(40),
  WORKFLOW_COMMIT: 'b'.repeat(40),
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
  FRONTEND_SHA256: 'c'.repeat(64),
  GITHUB_REPOSITORY: 'open-pencil/open-pencil'
}

test('one context owns release identity and reuses existing npm paths', () => {
  const root = resolve('fixture')
  const context = createReleaseContext(environment, root)

  expect(context.version).toBe('0.15.0')
  expect(context.paths.packages).toBe(releasePaths(root).artifacts)
  expect(context.paths.notes).toBe(resolve(root, 'release-notes.md'))
  expect(context.identity.sourceCommit).toBe(environment.SOURCE_COMMIT)
})

test.each(['master', '--help', 'v0.15.0/other', 'v0.15.0\n', 'v0.15'])(
  'rejects invalid release tag %s',
  (tag) => {
    expect(() => releaseVersion(tag)).toThrow()
  }
)

test('matrix metadata and target validation share the same catalog', () => {
  expect(desktopTargets).toEqual(desktopBuilds.map((build) => build.target))
  expect(new Set(desktopTargets).size).toBe(desktopTargets.length)

  for (const platform of new Set(desktopBuilds.map((build) => build.platform))) {
    expect(
      desktopBuilds.filter((build) => build.platform === platform && build.saveBunCache)
    ).toHaveLength(1)
  }
})

test('command adapters delegate argument arrays and deadlines to shared tooling', async () => {
  const requests: CommandRequest[] = []
  const cwd = resolve('fixture')
  const commands = releaseCommands(cwd, async (request) => {
    requests.push(request)
    return { stdout: 'output\n', stderr: '' }
  })

  expect(await commands.git('rev-parse', 'HEAD')).toBe('output')
  expect(await commands.github(['release', 'view', 'v0.15.0'])).toBe('output\n')
  await commands.github(['release', 'download', 'v0.15.0'], ARTIFACT_TRANSFER_TIMEOUT_MS)
  await commands.verifySignature('asset with spaces', 'key.pub', 'asset.sig')

  expect(requests).toEqual([
    { command: 'git', args: ['rev-parse', 'HEAD'], cwd, timeoutMs: 60_000 },
    { command: 'gh', args: ['release', 'view', 'v0.15.0'], cwd, timeoutMs: 60_000 },
    {
      command: 'gh',
      args: ['release', 'download', 'v0.15.0'],
      cwd,
      timeoutMs: ARTIFACT_TRANSFER_TIMEOUT_MS
    },
    {
      command: 'minisign',
      args: ['-Vm', 'asset with spaces', '-p', 'key.pub', '-x', 'asset.sig'],
      cwd,
      output: 'inherit',
      timeoutMs: 60_000
    }
  ])
})
