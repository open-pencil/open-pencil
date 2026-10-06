import { test, expect } from '@playwright/test'

// Playwright's bundled Chromium on macOS closes the page when a FileSystemFileHandle is read
// back from IndexedDB, before any app code runs; installed Google Chrome on the same machine
// reads and compares it correctly.
test.skip(
  ({ browserName, channel }) =>
    browserName === 'chromium' && !channel && process.platform === 'darwin',
  "Playwright's bundled Chromium closes the page when reading a file handle back from IndexedDB on macOS"
)

test('browser file identity survives reopening and distinguishes same-named files', async ({
  page
}) => {
  await page.goto('/')
  const ids = await page.evaluate(async () => {
    const modulePath = '/src/app/ai/chat/history/idb.ts'
    const { createConversationStore } = await import(modulePath)
    const root = await navigator.storage.getDirectory()
    const directoryName = `chat-identity-${crypto.randomUUID()}`
    const directory = await root.getDirectoryHandle(directoryName, { create: true })
    try {
      const firstDirectory = await directory.getDirectoryHandle('first', { create: true })
      const secondDirectory = await directory.getDirectoryHandle('second', { create: true })
      const file = await firstDirectory.getFileHandle('design.fig', { create: true })
      const concurrent = await Promise.all(
        Array.from({ length: 12 }, () => createConversationStore().resolveFile(file))
      )
      const first = concurrent[0]
      const reopened = await firstDirectory.getFileHandle('design.fig')
      const second = await createConversationStore().resolveFile(reopened)
      const other = await secondDirectory.getFileHandle('design.fig', { create: true })
      const third = await createConversationStore().resolveFile(other)
      return { first, second, third, concurrent }
    } finally {
      await root.removeEntry(directoryName, { recursive: true })
    }
  })
  expect(new Set(ids.concurrent).size).toBe(1)
  expect(ids.first).toBe(ids.second)
  expect(ids.third).not.toBe(ids.first)
})
