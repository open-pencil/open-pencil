#!/usr/bin/env bun
import { resolve } from 'node:path'

import { defineCommand, runMain } from 'citty'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { fetchAll, fetchRelease } from './fetch'
import { pinRelease } from './pin'

await runMain(
  defineCommand({
    meta: { name: 'fork-release', description: "Fetch and pin builds of OpenPencil's forks" },
    subCommands: {
      fetch: defineCommand({
        meta: {
          name: 'fetch',
          description: 'Fetch the release a package pins, or every pinned release in the workspace'
        },
        args: {
          package: { type: 'positional', required: false, description: 'Package directory' }
        },
        async run({ args }) {
          if (args.package) {
            const fetched = await fetchRelease(resolve(String(args.package)))
            if (fetched.length > 0) process.stdout.write(`Fetched ${fetched.join(', ')}\n`)
            return
          }
          await fetchAll(await resolveWorkspaceRoot(process.cwd()))
        }
      }),
      pin: defineCommand({
        meta: { name: 'pin', description: "Pin a package to another of its fork's releases" },
        args: {
          package: { type: 'positional', required: true, description: 'Package directory' },
          tag: { type: 'positional', required: true, description: 'Release tag, <name>-<commit>' }
        },
        async run({ args }) {
          const dir = resolve(String(args.package))
          const release = await pinRelease(dir, String(args.tag))
          await fetchRelease(dir)
          process.stdout.write(`Pinned ${release.tag}: ${Object.keys(release.files).join(', ')}\n`)
        }
      })
    }
  })
)
