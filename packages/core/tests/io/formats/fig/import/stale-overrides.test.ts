import { afterEach, expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#core-tests/helpers/fig/fixtures'
import { HEAVY_TEST_TIMEOUT_MS, runsHeavyTests } from '#core-tests/helpers/test-utils'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'

import { readerDiagnostics, registerReaderSession } from '#core/kiwi/fig/session/document-state'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

// Each full material3.fig graph takes gigabytes, and the collector does not run on its own
// between steps, so release them explicitly.
afterEach(() => {
  Bun.gc(true)
})

// material3.fig retains overrides on 58114:20598 that address 57994:10133, a node the
// archive no longer contains. Figma keeps such records; opening the file must not.
test.if(runsHeavyTests)(
  'opening a file skips overrides against deleted nodes and reports them',
  () => {
    const reader = openReaderSession(readFixtureArrayBuffer('material3.fig'), 'all')
    const stale = reader.diagnostics.filter(
      (entry) =>
        (entry.kind === 'property' || entry.kind === 'assignment') &&
        entry.diagnostic.ownerId === '58114:20598' &&
        entry.diagnostic.reason === 'missing-target'
    )
    expect(stale.length).toBeGreaterThan(0)
    expect(reader.graph.getPages().length).toBeGreaterThan(1)
  },
  HEAVY_TEST_TIMEOUT_MS
)

// The Internal Only Canvas keeps instances of deleted components. Export loads every page,
// so an edited document must still export and reopen with those instances intact.
// Each step keeps only what the next one checks, so one full graph is alive at a time.
async function exportEditedDocument(): Promise<{ bytes: Uint8Array; orphanCount: number }> {
  await initCodec()
  const reader = openReaderSession(readFixtureArrayBuffer('material3.fig'), 'first-page')
  const page = reader.graph.getPages()[0]
  reader.graph.updateNode(page.id, { name: 'Edited page' })
  registerReaderSession(readFixtureArrayBuffer('material3.fig'), reader.session, reader.diagnostics)
  const bytes = await exportFigFile(reader.graph)
  const orphans = readerDiagnostics(reader.graph).filter((entry) => entry.kind === 'component')
  return { bytes, orphanCount: orphans.length }
}

async function reopenedPageNames(bytes: Uint8Array): Promise<string[]> {
  const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
  return reopened.getPages().map((node) => node.name)
}

function exportedOrphanCount(bytes: Uint8Array): number {
  const { nodeChanges } = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  return nodeChanges.filter((node) => node.type === 'INSTANCE' && !node.symbolData?.symbolID).length
}

test.if(runsHeavyTests)(
  'an edited document with instances of deleted components exports and reopens',
  async () => {
    const { bytes, orphanCount } = await exportEditedDocument()
    expect(orphanCount).toBeGreaterThan(0)
    Bun.gc(true)
    expect(await reopenedPageNames(bytes)).toContain('Edited page')
    Bun.gc(true)
    // Each orphan is still an instance record, with no component to point at.
    expect(exportedOrphanCount(bytes)).toBe(orphanCount)
  },
  HEAVY_TEST_TIMEOUT_MS * 4
)
