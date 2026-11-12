import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { checksum, CHECKSUMS_FILE } from '#mermaid-sources/checksums'
import { UPSTREAM_DIR } from '#mermaid-sources/sources'
import * as v from 'valibot'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const root = await resolveWorkspaceRoot(import.meta.dir)

test('the copied and generated Mermaid sources are as the generator wrote them', async () => {
  const recorded = v.parse(
    v.record(v.string(), v.string()),
    await Bun.file(join(root, CHECKSUMS_FILE)).json()
  )
  expect(Object.keys(recorded).length).toBeGreaterThan(0)
  for (const [file, expected] of Object.entries(recorded)) {
    const content = await Bun.file(join(root, UPSTREAM_DIR, file)).text()
    // A mismatch means the file was edited by hand: change the generator and regenerate instead.
    expect({ file, checksum: checksum(content) }).toEqual({ file, checksum: expected })
  }
})
