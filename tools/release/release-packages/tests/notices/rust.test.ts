import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { NoticedArtifact } from '#release/notices/artifacts'
import { writeReleaseNotices } from '#release/notices/rust'

test("a release source without an artifact's package writes no notices for it", async () => {
  // An older tag built again, from before the package existed: no crate, no deny.toml.
  const root = await mkdtemp(join(tmpdir(), 'release-'))
  const artifact: NoticedArtifact = {
    name: 'engine.wasm',
    manifest: 'packages/engine/crate/Cargo.toml',
    deny: 'packages/engine/deny.toml',
    targets: ['wasm32-unknown-unknown'],
    directory: 'packages/engine',
    notices: 'wasm/THIRD-PARTY-NOTICES.md'
  }

  await expect(writeReleaseNotices(root, [artifact])).resolves.toBeUndefined()
  expect(await Bun.file(join(root, artifact.directory, artifact.notices)).exists()).toBe(false)
})

test("a release source from before the artifact's license policy writes no notices for it", async () => {
  // An older tag of the desktop app: its crate, but no deny.toml yet.
  const root = await mkdtemp(join(tmpdir(), 'release-'))
  const artifact: NoticedArtifact = {
    name: 'desktop',
    manifest: 'desktop/Cargo.toml',
    deny: 'desktop/deny.toml',
    targets: ['x86_64-unknown-linux-gnu'],
    directory: 'desktop',
    notices: 'generated/THIRD-PARTY-NOTICES.md'
  }
  await mkdir(join(root, 'desktop'), { recursive: true })
  await writeFile(join(root, artifact.manifest), '[package]\nname = "desktop"\n')

  await expect(writeReleaseNotices(root, [artifact])).resolves.toBeUndefined()
  expect(await Bun.file(join(root, artifact.directory, artifact.notices)).exists()).toBe(false)
})
