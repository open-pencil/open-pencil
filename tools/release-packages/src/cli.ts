#!/usr/bin/env bun

import { fileURLToPath } from 'node:url'

import { defineCommand, runMain } from 'citty'

import {
  buildReleasePackages,
  packReleasePackages,
  prepareReleasePackages,
  publishReleasePackages
} from './workflow'

const root = fileURLToPath(new URL('../../..', import.meta.url))

const main = defineCommand({
  meta: { name: 'release-packages', description: 'Build and publish verified npm packages' },
  subCommands: {
    build: defineCommand({
      meta: { name: 'build', description: 'Build public packages in dependency order' },
      async run() {
        await buildReleasePackages(root)
      }
    }),
    prepare: defineCommand({
      meta: { name: 'prepare', description: 'Prepare transparent publish directories' },
      async run() {
        await prepareReleasePackages(root)
      }
    }),
    pack: defineCommand({
      meta: { name: 'pack', description: 'Pack and validate unpublished package artifacts' },
      async run() {
        await packReleasePackages(root)
      }
    }),
    publish: defineCommand({
      meta: { name: 'publish', description: 'Publish the exact verified package artifacts' },
      async run() {
        await publishReleasePackages(root)
      }
    })
  }
})

await runMain(main)
