import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ARTIFACT_TRANSFER_TIMEOUT_MS } from './commands.ts'
import { digestFile } from './manifest.ts'

export interface UploadedAssets {
  github: (args: string[], timeoutMs?: number) => Promise<string>
  repository: string
  tag: string
  names: string[]
  /** Where the verified files the release should carry are. */
  directory: string
}

/** Downloads each named asset of the release back and refuses one whose bytes differ. */
export async function verifyUploadedAssets(assets: UploadedAssets): Promise<void> {
  const { github, repository, tag, names, directory } = assets
  const temporary = await mkdtemp(join(tmpdir(), 'open-pencil-release-verify-'))
  try {
    await github(
      [
        'release',
        'download',
        tag,
        '--repo',
        repository,
        '--dir',
        temporary,
        ...names.flatMap((name) => ['--pattern', name])
      ],
      ARTIFACT_TRANSFER_TIMEOUT_MS
    )
    for (const name of names) {
      if (
        (await digestFile(join(temporary, name))).sha256 !==
        (await digestFile(join(directory, name))).sha256
      ) {
        throw new Error(`Uploaded digest mismatch: ${name}`)
      }
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
