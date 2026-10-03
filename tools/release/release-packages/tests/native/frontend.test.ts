import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { releaseCommands } from '#release/native/commands'
import { desktopReleasePaths } from '#release/native/context'
import { prepareSharedFrontend } from '#release/native/frontend'
import { digestFile } from '#release/native/manifest'

test.each(['valid', 'source', 'version', 'digest'])(
  'shared frontend validation: %s',
  async (scenario) => {
    const root = await mkdtemp(join(tmpdir(), 'release-frontend-'))

    try {
      const archive = join(root, 'frontend.tar')
      await writeFile(archive, 'shared frontend fixture')
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'open-pencil',
          version: scenario === 'version' ? '0.14.0' : '0.15.0'
        })
      )

      const sourceCommit = 'a'.repeat(40)
      const identity = {
        tag: 'v0.15.0',
        sourceCommit,
        workflowCommit: 'b'.repeat(40),
        runId: '123',
        runAttempt: '1',
        frontendSha256: (await digestFile(archive)).sha256
      }
      const context = {
        identity,
        repository: 'open-pencil/open-pencil',
        version: '0.15.0',
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
          build: { beforeBuildCommand: null }
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
