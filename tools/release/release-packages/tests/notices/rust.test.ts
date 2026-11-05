import { expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
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
    packageDirectory: 'packages/engine',
    notices: 'wasm/THIRD-PARTY-NOTICES.md'
  }

  await expect(writeReleaseNotices(root, [artifact])).resolves.toBeUndefined()
  expect(await Bun.file(join(root, artifact.packageDirectory, artifact.notices)).exists()).toBe(
    false
  )
})
