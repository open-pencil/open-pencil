import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertNoticesPrepared,
  NOTICED_ARTIFACTS,
  type NoticedArtifact
} from '#release/notices/artifacts'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const ARTIFACT: NoticedArtifact = {
  name: 'engine.wasm',
  manifest: 'packages/engine/crate/Cargo.toml',
  deny: 'packages/engine/deny.toml',
  targets: ['wasm32-unknown-unknown'],
  directory: 'packages/engine',
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

describe('noticed artifacts', () => {
  test("each cargo deny configuration checks the targets its artifact's notices cover", async () => {
    const root = await resolveWorkspaceRoot(import.meta.dir)
    for (const artifact of NOTICED_ARTIFACTS) {
      const deny = Bun.TOML.parse(await readFile(join(root, artifact.deny), 'utf8'))
      expect({ artifact: artifact.name, deny }).toMatchObject({
        artifact: artifact.name,
        deny: { graph: { targets: [...artifact.targets] } }
      })
    }
  })
})
