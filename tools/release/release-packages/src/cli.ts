#!/usr/bin/env bun

import { defineCommand, runMain } from 'citty'

import { resolveWorkspaceRoot } from '@lawha/package-artifacts-tools'

import { adoptPublishedReleaseArtifacts, releaseSourceFromEnv } from './resume'
import {
  buildReleasePackages,
  packReleasePackages,
  prepareReleasePackages,
  publishReleasePackages
} from './workflow'

function command(name: string, description: string, execute: (root: string) => Promise<unknown>) {
  return defineCommand({
    meta: { name, description },
    args: { root: { type: 'string', description: 'Explicit workspace root' } },
    async run({ args }) {
      await execute(await resolveWorkspaceRoot(process.cwd(), args.root))
    }
  })
}

await runMain(
  defineCommand({
    meta: { name: 'release-packages', description: 'Build and publish verified npm packages' },
    subCommands: {
      build: command('build', 'Build public packages in dependency order', buildReleasePackages),
      prepare: command(
        'prepare',
        'Prepare transparent publish directories',
        prepareReleasePackages
      ),
      pack: command('pack', 'Pack and validate release package artifacts', packReleasePackages),
      resume: command(
        'resume',
        "Use the registry's tarballs for versions this release tag already published",
        (root) => adoptPublishedReleaseArtifacts(root, releaseSourceFromEnv())
      ),
      publish: command(
        'publish',
        'Publish the exact verified package artifacts',
        publishReleasePackages
      )
    }
  })
)
