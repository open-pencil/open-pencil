import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertNoticesPrepared, type NoticedArtifact } from '#release/notices/artifacts'

const ARTIFACT: NoticedArtifact = {
  name: 'engine.wasm',
  manifest: 'packages/engine/crate/Cargo.toml',
  deny: 'packages/engine/deny.toml',
  targets: ['wasm32-unknown-unknown'],
  packageDirectory: 'packages/engine',
  notices: 'wasm/THIRD-PARTY-NOTICES.md'
}

describe('prepared notices', () => {
  test('refuse a package that ships compiled crates without their notices', async () => {
    const prepared = await mkdtemp(join(tmpdir(), 'notices-'))
    await mkdir(join(prepared, 'engine', 'wasm'), { recursive: true })

    await expect(assertNoticesPrepared(prepared, ['packages/engine'], [ARTIFACT])).rejects.toThrow(
      'packages/engine lacks wasm/THIRD-PARTY-NOTICES.md'
    )

    await writeFile(join(prepared, 'engine', 'wasm', 'THIRD-PARTY-NOTICES.md'), '# Notices')
    await expect(
      assertNoticesPrepared(prepared, ['packages/engine'], [ARTIFACT])
    ).resolves.toBeUndefined()
  })

  test('skip a package the release does not publish', async () => {
    const prepared = await mkdtemp(join(tmpdir(), 'notices-'))
    await expect(
      assertNoticesPrepared(prepared, ['packages/other'], [ARTIFACT])
    ).resolves.toBeUndefined()
  })
})
