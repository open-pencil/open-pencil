import { expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'

import { openReaderSession } from '#core/kiwi/fig/session/reader'
import { readerDiagnostics, registerReaderSession } from '#core/kiwi/fig/session/recovery'

import { readFixtureArrayBuffer } from '#tests/helpers/fig/fixtures'
import { HEAVY_TEST_TIMEOUT_MS, runsHeavyTests } from '#tests/helpers/test-utils'

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
test.if(runsHeavyTests)(
  'an edited document with instances of deleted components exports and reopens',
  async () => {
    await initCodec()
    const reader = openReaderSession(readFixtureArrayBuffer('material3.fig'), 'first-page')
    const page = reader.graph.getPages()[0]
    reader.graph.updateNode(page.id, { name: 'Edited page' })
    registerReaderSession(
      readFixtureArrayBuffer('material3.fig'),
      reader.session,
      reader.diagnostics
    )
    const bytes = await exportFigFile(reader.graph)
    const orphans = readerDiagnostics(reader.graph).filter((entry) => entry.kind === 'component')
    expect(orphans.length).toBeGreaterThan(0)
    const reopened = await parseFigFile(bytes.slice().buffer as ArrayBuffer)
    expect(reopened.getPages().some((node) => node.name === 'Edited page')).toBe(true)
    // Each orphan is still an instance record, with no component to point at.
    const { nodeChanges } = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
    const exportedOrphans = nodeChanges.filter(
      (node) => node.type === 'INSTANCE' && !node.symbolData?.symbolID
    )
    expect(exportedOrphans).toHaveLength(orphans.length)
  },
  HEAVY_TEST_TIMEOUT_MS * 4
)
