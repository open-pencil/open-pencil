#!/usr/bin/env bun

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { digestFile } from '#release/native/manifest'
import { isPrerelease } from '#release/version'
import { defineCommand, runMain } from 'citty'

import { resolveWorkspaceRoot, runCommand } from '@open-pencil/package-artifacts-tools'

import {
  MCP_PACKAGE_DIRECTORY,
  MCP_REGISTRY_DOMAIN,
  releaseServer,
  serverVersionURL
} from './server.ts'

/** The registry's own publisher, pinned by release and by the digest GitHub records for it. */
const PUBLISHER = {
  release: 'v1.8.16',
  asset: 'mcp-publisher_linux_amd64.tar.gz',
  sha256: '6e2f799550cf843c6fd3350498d56cc49be3dc0af1e6237eb0e6435c7a9d5c05'
}
const PUBLISHER_TIMEOUT_MS = 2 * 60_000

async function installPublisher(directory: string): Promise<string> {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(
      `The pinned MCP publisher is for linux x64, not ${process.platform} ${process.arch}`
    )
  }
  const url = `https://github.com/modelcontextprotocol/registry/releases/download/${PUBLISHER.release}/${PUBLISHER.asset}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`)
  const archivePath = join(directory, PUBLISHER.asset)
  await writeFile(archivePath, new Uint8Array(await response.arrayBuffer()))
  const { sha256 } = await digestFile(archivePath)
  if (sha256 !== PUBLISHER.sha256) throw new Error(`${PUBLISHER.asset} has digest ${sha256}`)
  await runCommand({
    command: 'tar',
    args: ['-xzf', archivePath, 'mcp-publisher'],
    cwd: directory
  })
  return join(directory, 'mcp-publisher')
}

/**
 * Lists the release's MCP server in the official MCP Registry as `dev.openpencil/mcp`, after npm
 * has the package version it names. Stable releases only: a beta's higher version would become
 * the entry clients install. A version the registry already has is left alone, so a rerun of the
 * release goes through. Without `MCP_PRIVATE_KEY`, the Ed25519 key whose public half is in
 * `openpencil.dev`'s DNS, it warns and lists nothing.
 */
export async function publishMCPRegistry(root: string): Promise<void> {
  const directory = join(root, MCP_PACKAGE_DIRECTORY)
  const server = releaseServer(
    await readFile(join(directory, 'server.json'), 'utf8'),
    await readFile(join(directory, 'package.json'), 'utf8')
  )
  if (isPrerelease(server.version)) {
    console.log(`Leaving the MCP Registry on the last stable release, not ${server.version}`)
    return
  }
  if (!process.env.MCP_PRIVATE_KEY) {
    console.log(
      `::warning::MCP_PRIVATE_KEY is not set; ${server.name} ${server.version} is not listed in the MCP Registry`
    )
    return
  }
  const existing = await fetch(serverVersionURL(server.name, server.version))
  if (existing.ok) {
    console.log(`The MCP Registry already lists ${server.name} ${server.version}`)
    return
  }
  if (existing.status !== 404) {
    throw new Error(
      `The MCP Registry answered HTTP ${existing.status} for ${server.name} ${server.version}`
    )
  }

  const work = await mkdtemp(join(tmpdir(), 'mcp-registry-'))
  try {
    const publisher = await installPublisher(work)
    const serverPath = join(work, 'server.json')
    await writeFile(serverPath, `${JSON.stringify(server, null, 2)}\n`)
    const run = (...args: string[]) =>
      runCommand({
        command: publisher,
        args,
        cwd: work,
        output: 'inherit',
        timeoutMs: PUBLISHER_TIMEOUT_MS
      })
    await run('validate', serverPath)
    await run('login', 'dns', '--domain', MCP_REGISTRY_DOMAIN)
    await run('publish', serverPath)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
  console.log(`Listed ${server.name} ${server.version} in the MCP Registry`)
}

if (import.meta.main) {
  await runMain(
    defineCommand({
      meta: {
        name: 'mcp-registry',
        description: 'List the release’s MCP server in the MCP Registry'
      },
      args: { root: { type: 'string', description: 'Explicit workspace root' } },
      async run({ args }) {
        await publishMCPRegistry(await resolveWorkspaceRoot(process.cwd(), args.root))
      }
    })
  )
}
