#!/usr/bin/env bun

import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import { defineCommand, runMain } from 'citty'
import * as v from 'valibot'

import {
  readPackageManifest,
  resolveWorkspaceRoot,
  runCommand
} from '@open-pencil/package-artifacts-tools'

import {
  assertInjectedChunks,
  listSourceMaps,
  POSTHOG_RELEASE_NAME,
  sourceMapsAssetName
} from './bundle.ts'

const POSTHOG_TIMEOUT_MS = 10 * 60_000
const ARCHIVE_TIMEOUT_MS = 5 * 60_000

const credentialsSchema = v.object({
  POSTHOG_CLI_API_KEY: v.pipe(v.string(), v.minLength(1)),
  POSTHOG_CLI_PROJECT_ID: v.pipe(v.string(), v.regex(/^\d+$/))
})

/** The pinned CLI's launcher, which fetches its binary on first run; Bun skips install scripts. */
const posthogCLI = Bun.resolveSync('@posthog/cli/run-posthog-cli.js', import.meta.dir)

/**
 * Prepares a release build's `dist` for error reports: injects the chunk IDs and release that
 * PostHog symbolicates stack frames by, uploads the source maps, optionally archives them as the
 * release asset, and removes them so neither the web deploy nor the desktop bundle ships them.
 */
export async function publishSourceMaps(root: string, options: { archive: boolean }) {
  v.parse(credentialsSchema, process.env)
  const { version } = await readPackageManifest(join(root, 'package.json'))
  const dist = join(root, 'dist')
  const release = ['--release-name', POSTHOG_RELEASE_NAME, '--release-version', version]

  async function posthog(...args: string[]) {
    await runCommand({
      command: process.execPath,
      args: [posthogCLI, ...args],
      cwd: root,
      output: 'inherit',
      timeoutMs: POSTHOG_TIMEOUT_MS
    })
  }

  await posthog('sourcemap', 'inject', '--directory', dist, ...release)
  const maps = await listSourceMaps(dist)
  await assertInjectedChunks(dist, maps)
  await posthog('sourcemap', 'upload', '--directory', dist, ...release)

  if (options.archive) {
    await runCommand({
      command: 'tar',
      args: ['-czf', join(root, sourceMapsAssetName(version)), '-C', dist, ...maps],
      cwd: root,
      timeoutMs: ARCHIVE_TIMEOUT_MS
    })
  }
  await Promise.all(maps.map((map) => rm(join(dist, map))))
  if ((await listSourceMaps(dist)).length > 0) throw new Error('Source maps left in dist')
  console.log(`Uploaded ${maps.length} source maps for ${POSTHOG_RELEASE_NAME}@${version}`)
}

if (import.meta.main) {
  await runMain(
    defineCommand({
      meta: { name: 'sourcemaps', description: 'Upload a release build’s source maps to PostHog' },
      args: {
        root: { type: 'string', description: 'Explicit workspace root' },
        archive: { type: 'boolean', description: 'Also archive the maps as the release asset' }
      },
      async run({ args }) {
        await publishSourceMaps(await resolveWorkspaceRoot(process.cwd(), args.root), {
          archive: args.archive
        })
      }
    })
  )
}
