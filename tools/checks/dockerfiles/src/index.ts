#!/usr/bin/env bun
/**
 * Fails when a Dockerfile breaks the repository's Dockerfile style, or when an image installs
 * another Rust toolchain than `rust-toolchain.toml` pins.
 *
 *   bun tools/checks/dockerfiles/src/index.ts
 */
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { compact } from 'es-toolkit'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { dockerfileFindings, rustToolchainArgument } from './rules'

const root = await resolveWorkspaceRoot(import.meta.dir)
// Every tracked Dockerfile, wherever it lives, without walking node_modules or build output.
const listed = Bun.spawnSync(['git', 'ls-files', '-z', '--', '*Dockerfile'], { cwd: root })
if (listed.exitCode !== 0) throw new Error(`git ls-files failed: ${listed.stderr.toString()}`)
const dockerfiles = compact(listed.stdout.toString().split('\0')).map((path) => join(root, path))

const toolchain = /^channel = "([^"]+)"$/m.exec(
  await readFile(join(root, 'rust-toolchain.toml'), 'utf8')
)?.[1]
if (!toolchain) throw new Error('rust-toolchain.toml pins no channel')

let failures = 0
for (const file of dockerfiles.toSorted()) {
  const text = await readFile(file, 'utf8')
  const path = relative(root, file)
  for (const finding of dockerfileFindings(text)) {
    failures++
    console.error(`${path}:${finding.line}: ${finding.message}`)
  }
  const rust = rustToolchainArgument(text)
  if (rust && rust.value !== toolchain) {
    failures++
    console.error(
      `${path}:${rust.line}: RUST_TOOLCHAIN is ${rust.value}, but rust-toolchain.toml pins ${toolchain}`
    )
  }
}
if (failures > 0) process.exit(1)
console.log(`${dockerfiles.length} Dockerfiles follow the repository's style`)
