import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildLocal, IDENTIFIER, localConfig, parseOptions } from '#local-build/build'

import type { CommandRequest } from '@open-pencil/package-artifacts-tools'

describe('local native builds', () => {
  test('isolates identity, signing, updater and associations', () => {
    expect(localConfig()).toEqual({
      productName: 'OpenPencil Local',
      identifier: IDENTIFIER,
      bundle: {
        createUpdaterArtifacts: false,
        fileAssociations: [],
        macOS: { signingIdentity: '-' }
      },
      plugins: { updater: { endpoints: [] }, 'deep-link': { desktop: { schemes: [] } } }
    })
  })
  test('parses options and rejects unsupported installs before building', () => {
    expect(parseOptions([], 'linux')).toEqual({ install: false, help: false })
    expect(parseOptions(['--install'], 'darwin').install).toBe(true)
    expect(parseOptions(['--help'], 'win32').help).toBe(true)
    expect(() => parseOptions(['--install'], 'win32')).toThrow('macOS')
    expect(() => parseOptions(['--target'], 'linux')).toThrow('Unknown argument')
  })
  for (const platform of ['darwin', 'linux', 'win32'] as const) {
    test('builds and reports bundles on ' + platform, async () => {
      const commands: CommandRequest[] = []
      const output: string[] = []
      const root = join(tmpdir(), 'local-build-fixture')
      const bundle = await buildLocal({
        root,
        home: tmpdir(),
        platform,
        install: false,
        run: async (request) => {
          commands.push(request)
          return { stdout: '', stderr: '' }
        },
        log: (message) => output.push(message)
      })
      expect(commands).toHaveLength(1)
      expect(commands[0]?.args?.slice(0, 4)).toEqual(['run', 'tauri', 'build', '--config'])
      expect(commands[0]?.env?.CARGO_TARGET_DIR).toBe(join(root, 'desktop/target/local'))
      expect(commands[0]?.env?.OPENPENCIL_CREDENTIAL_SERVICE).toBe(IDENTIFIER + '.credentials')
      if (platform === 'darwin') expect(commands[0]?.env?.APPLE_SIGNING_IDENTITY).toBe('-')
      expect(output).toEqual(['Local bundles: ' + bundle])
    })
  }
  test('installs only the local app into the user Applications directory', async () => {
    const home = await mkdtemp(join(tmpdir(), 'openpencil-local-test-'))
    const commands: CommandRequest[] = []
    try {
      const stale = join(home, 'Applications/OpenPencil Local.app/stale')
      await mkdir(join(home, 'Applications/OpenPencil Local.app'), { recursive: true })
      await writeFile(stale, 'old bundle file')
      await buildLocal({
        root: home,
        home,
        platform: 'darwin',
        install: true,
        run: async (request) => {
          commands.push(request)
          return { stdout: '', stderr: '' }
        },
        log: () => undefined
      })
      await expect(access(stale)).rejects.toThrow()
      expect(commands[1]?.command).toBe('ditto')
      expect(commands[1]?.args?.[1]).toBe(join(home, 'Applications/OpenPencil Local.app'))
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
  test('does not install when the build fails', async () => {
    let calls = 0
    await expect(
      buildLocal({
        root: tmpdir(),
        home: tmpdir(),
        platform: 'darwin',
        install: true,
        run: async () => {
          calls++
          throw new Error('build failed')
        }
      })
    ).rejects.toThrow('build failed')
    expect(calls).toBe(1)
  })
})
