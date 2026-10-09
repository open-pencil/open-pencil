import { expect, test } from '#tests/e2e/fixtures'

// Playwright's WebKit contexts are private, like Safari Private Browsing, where IndexedDB cannot
// store Blobs; Chromium refuses a single value over 127 MiB unless it is a Blob. Recovery
// snapshots and local documents must store in both.

test('keeps recovery snapshots and local documents in IndexedDB', async ({ page }) => {
  await page.goto('/?test')
  const stored = await page.evaluate(async () => {
    const recoveryPath = '/src/app/document/recovery/idb.ts'
    const localPath = '/src/app/storage/local-store/idb.ts'
    const { createIdbRecoveryStore } = await import(recoveryPath)
    const { createIdbLocalCanvasStore } = await import(localPath)
    const bytes = new Uint8Array([1, 2, 3, 4])

    const recovery = createIdbRecoveryStore()
    await recovery.write({ id: 'binary-probe', documentName: 'Probe', figBytes: bytes })
    const snapshot = await recovery.read('binary-probe')
    await recovery.remove('binary-probe')

    const local = createIdbLocalCanvasStore()
    await local.writeCanvas({
      id: 'binary-probe',
      providerId: 'local',
      name: 'Probe',
      figBytes: bytes,
      thumbBytes: bytes
    })
    await local.writeThumb('binary-probe', new Uint8Array([5, 6]))
    const fig = await local.readFig('binary-probe')
    const thumb = await local.readThumb('binary-probe')
    await local.remove('binary-probe')

    return {
      snapshot: snapshot ? [...snapshot.figBytes] : null,
      fig: fig ? [...fig] : null,
      thumb: thumb ? [...thumb] : null
    }
  })
  expect(stored).toEqual({ snapshot: [1, 2, 3, 4], fig: [1, 2, 3, 4], thumb: [5, 6] })
})

test('keeps a local document over 127 MiB in IndexedDB', async ({ page }) => {
  await page.goto('/?test')
  const stored = await page.evaluate(async () => {
    const localPath = '/src/app/storage/local-store/idb.ts'
    const { createIdbLocalCanvasStore } = await import(localPath)
    const figBytes = new Uint8Array(140 * 1024 * 1024)
    figBytes[figBytes.length - 1] = 7

    const local = createIdbLocalCanvasStore()
    await local.writeCanvas({ id: 'large-probe', providerId: 'local', name: 'Large', figBytes })
    const fig: Uint8Array | null = await local.readFig('large-probe')
    await local.remove('large-probe')
    return fig ? { length: fig.length, last: fig[fig.length - 1] } : null
  })
  expect(stored).toEqual({ length: 140 * 1024 * 1024, last: 7 })
})
