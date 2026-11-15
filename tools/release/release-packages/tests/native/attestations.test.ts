import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { verifyAttestations } from '#release/native/attestations'
import { releaseCommands } from '#release/native/commands'
import { desktopReleasePaths } from '#release/native/context'

import type { CommandRequest } from '@open-pencil/package-artifacts-tools'

async function withRelease(files: string[], run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'release-attestations-'))
  try {
    const paths = desktopReleasePaths(root)
    await mkdir(join(paths.output, 'nested'), { recursive: true })
    for (const file of files) await writeFile(join(paths.output, file), file)
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function contextFor(root: string) {
  const identity = {
    tag: 'v0.15.0',
    sourceCommit: 'a'.repeat(40),
    workflowCommit: 'b'.repeat(40),
    runId: '1',
    runAttempt: '1',
    frontendSha256: 'c'.repeat(64)
  }
  return {
    identity,
    repository: 'open-pencil/open-pencil',
    version: '0.15.0',
    paths: desktopReleasePaths(root)
  }
}

test('verifies every release file against the pinned workflow', async () => {
  await withRelease(['b.dmg', 'a.msi'], async (root) => {
    const requests: CommandRequest[] = []
    const commands = releaseCommands(root, async (request) => {
      requests.push(request)
      return { stdout: '', stderr: '' }
    })
    await verifyAttestations(contextFor(root), 'bundle.jsonl', commands)
    const output = desktopReleasePaths(root).output
    expect(requests.map((request) => request.args?.[2])).toEqual([
      join(output, 'a.msi'),
      join(output, 'b.dmg')
    ])
    expect(requests[0]?.args).toEqual([
      'attestation',
      'verify',
      join(output, 'a.msi'),
      '--bundle',
      'bundle.jsonl',
      '--repo',
      'open-pencil/open-pencil',
      '--signer-workflow',
      'open-pencil/open-pencil/.github/workflows/build.yml',
      '--signer-digest',
      'b'.repeat(40),
      '--deny-self-hosted-runners'
    ])
  })
})

test('fails on the first file that does not verify, and on an empty release', async () => {
  await withRelease(['a.msi'], async (root) => {
    const commands = releaseCommands(root, async () => {
      throw new Error('verification failed')
    })
    await expect(verifyAttestations(contextFor(root), 'bundle.jsonl', commands)).rejects.toThrow(
      'verification failed'
    )
  })
  await withRelease([], async (root) => {
    await expect(verifyAttestations(contextFor(root), 'bundle.jsonl')).rejects.toThrow(
      'No release files'
    )
  })
})
