import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { releaseCommands } from '#release/native/commands'
import { desktopReleasePaths } from '#release/native/context'
import {
  archiveSharedFrontend,
  DESKTOP_NOTICES,
  prepareSharedFrontend,
  SHARED_FRONTEND_INPUTS
} from '#release/native/frontend'
import { digestFile } from '#release/native/manifest'

/** Writes what in a source tree produces each kind of desktop notices. */
async function writeProducers(root: string) {
  for (const { producer } of DESKTOP_NOTICES) {
    await mkdir(dirname(join(root, producer)), { recursive: true })
    await writeFile(join(root, producer), '')
  }
}

test.each(['valid', 'beta', 'legacy', 'source', 'version', 'digest'])(
  'shared frontend validation: %s',
  async (scenario) => {
    const root = await mkdtemp(join(tmpdir(), 'release-frontend-'))
    const version = scenario === 'beta' ? '0.16.0-beta.2' : '0.15.0'

    try {
      const archive = join(root, 'frontend.tar')
      await writeFile(archive, 'shared frontend fixture')
      // A release from before the notices has none of what writes them.
      if (scenario !== 'legacy') await writeProducers(root)
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'open-pencil',
          version: scenario === 'version' ? '0.14.0' : version
        })
      )

      const sourceCommit = 'a'.repeat(40)
      const identity = {
        tag: `v${version}`,
        sourceCommit,
        workflowCommit: 'b'.repeat(40),
        runId: '123',
        runAttempt: '1',
        frontendSha256: (await digestFile(archive)).sha256
      }
      const context = {
        identity,
        repository: 'open-pencil/open-pencil',
        version,
        paths: desktopReleasePaths(root)
      }
      const commands = releaseCommands(root, async () => ({
        stdout: scenario === 'source' ? 'c'.repeat(40) : sourceCommit,
        stderr: ''
      }))

      if (scenario === 'digest') await writeFile(archive, 'changed archive')

      const operation = prepareSharedFrontend(context, commands)
      const config = join(root, 'release-build-config.json')

      if (scenario === 'valid') {
        await operation
        expect(JSON.parse(await readFile(config, 'utf8'))).toEqual({
          build: { beforeBuildCommand: null },
          bundle: {
            resources: {
              '../dist/THIRD-PARTY-NOTICES.md': 'licenses/THIRD-PARTY-NOTICES-JAVASCRIPT.md',
              'generated/THIRD-PARTY-NOTICES.md': 'licenses/THIRD-PARTY-NOTICES-RUST.md'
            }
          }
        })
      } else if (scenario === 'legacy') {
        await operation
        expect(JSON.parse(await readFile(config, 'utf8'))).toEqual({
          build: { beforeBuildCommand: null },
          bundle: {}
        })
      } else if (scenario === 'beta') {
        await operation
        expect(JSON.parse(await readFile(config, 'utf8'))).toEqual({
          build: { beforeBuildCommand: null },
          bundle: {
            resources: expect.any(Object),
            windows: { wix: { version: '0.16.0.2' } }
          }
        })
      } else {
        await expect(operation).rejects.toThrow()
        expect(await Bun.file(config).exists()).toBe(false)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
)

test('archives the shared frontend inputs with their notices and returns the digest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-frontend-archive-'))
  try {
    await writeProducers(root)
    await expect(archiveSharedFrontend(root)).rejects.toThrow('Missing dist/THIRD-PARTY-NOTICES.md')
    for (const { source } of DESKTOP_NOTICES) {
      await mkdir(dirname(join(root, source)), { recursive: true })
      await writeFile(join(root, source), '# Notices')
    }
    const requests: string[][] = []
    const sha256 = await archiveSharedFrontend(root, async (request) => {
      requests.push(request.args ?? [])
      await writeFile(join(root, 'frontend.tar'), 'archive')
      return { stdout: '', stderr: '' }
    })
    expect(requests).toEqual([['-cf', 'frontend.tar', ...SHARED_FRONTEND_INPUTS]])
    expect(sha256).toBe((await digestFile(join(root, 'frontend.tar'))).sha256)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('archives a release from before the notices without them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-frontend-legacy-'))
  try {
    await expect(
      archiveSharedFrontend(root, async () => {
        await writeFile(join(root, 'frontend.tar'), 'archive')
        return { stdout: '', stderr: '' }
      })
    ).resolves.toMatch(/^[a-f0-9]{64}$/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
