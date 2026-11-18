#!/usr/bin/env bun

import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

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

export type SourceMapsOptions = {
  /** The build to publish, relative to the workspace root; its `dist` by default. */
  dist?: string
  /** The PostHog release the chunks belong to; the app's, at the workspace version, by default. */
  release?: { name: string; version: string }
  /** Also archive the maps as the release asset. */
  archive?: boolean
  /** Leave the maps and their links in place, for a build whose code is never served. */
  linked?: boolean
}

/**
 * Prepares a build for error reports: injects the chunk IDs and release that PostHog symbolicates
 * stack frames by, uploads the source maps, and optionally archives them as the release asset. A
 * build that ships to people then loses its maps, so neither the web deploy nor the desktop bundle
 * carries them; a `linked` one, such as the Cloud Worker, is never served and may keep them.
 */
export async function publishSourceMaps(root: string, options: SourceMapsOptions = {}) {
  v.parse(credentialsSchema, process.env)
  // The CLI runs from the root, so a relative build is the root's, for every step alike.
  const dist = resolve(root, options.dist ?? 'dist')
  const { name, version } = options.release ?? {
    name: POSTHOG_RELEASE_NAME,
    version: (await readPackageManifest(join(root, 'package.json'))).version
  }
  const release = ['--release-name', name, '--release-version', version]

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
  await assertInjectedChunks(dist, maps, { linked: options.linked })
  await posthog('sourcemap', 'upload', '--directory', dist, ...release)

  if (options.archive) {
    await runCommand({
      command: 'tar',
      args: ['-czf', join(root, sourceMapsAssetName(version)), '-C', dist, ...maps],
      cwd: root,
      timeoutMs: ARCHIVE_TIMEOUT_MS
    })
  }
  if (!options.linked) {
    await Promise.all(maps.map((map) => rm(join(dist, map))))
    if ((await listSourceMaps(dist)).length > 0) throw new Error('Source maps left in dist')
  }
  console.log(`Uploaded ${maps.length} source maps for ${name}@${version}`)
}

if (import.meta.main) {
  await runMain(
    defineCommand({
      meta: { name: 'sourcemaps', description: 'Upload a release build’s source maps to PostHog' },
      args: {
        root: { type: 'string', description: 'Explicit workspace root' },
        dist: { type: 'string', description: 'The build to publish, instead of the app’s dist' },
        'release-name': { type: 'string', description: 'PostHog release name, with its version' },
        'release-version': { type: 'string', description: 'PostHog release version' },
        archive: { type: 'boolean', description: 'Also archive the maps as the release asset' },
        linked: { type: 'boolean', description: 'Keep the maps linked beside unserved code' }
      },
      async run({ args }) {
        const name = args['release-name']
        const version = args['release-version']
        if (Boolean(name) !== Boolean(version)) {
          throw new Error('--release-name and --release-version go together')
        }
        await publishSourceMaps(await resolveWorkspaceRoot(process.cwd(), args.root), {
          dist: args.dist,
          release: name && version ? { name, version } : undefined,
          archive: args.archive,
          linked: args.linked
        })
      }
    })
  )
}
