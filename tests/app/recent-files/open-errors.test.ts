import { expect, test } from 'bun:test'

import type { RecentDocument } from '@/app/recent-files'
import { isRecentFileOpenCancellation } from '@/app/recent-files/open-errors'
import { openRecentDocument } from '@/app/recent-files/workspace'

const document: RecentDocument = {
  id: 'local:/work/design.pen',
  kind: 'local',
  path: '/work/design.pen',
  name: 'design.pen',
  updatedAt: '2026-10-25T00:00:00.000Z'
}

test('recognizes an aborted recent-file open', () => {
  expect(
    isRecentFileOpenCancellation(new DOMException('The operation was aborted', 'AbortError'))
  ).toBe(true)
})

test('does not treat other open failures as cancellations', () => {
  expect(isRecentFileOpenCancellation(new Error('The file could not be read'))).toBe(false)
})

test('keeps a recent file when closing its loading tab cancels the open', async () => {
  const forgotten: string[] = []
  const cancellation = new DOMException('The operation was aborted', 'AbortError')

  await expect(
    openRecentDocument(document, undefined, {
      openLocalFile: async () => {
        throw cancellation
      },
      forgetRecentDocument: (id) => forgotten.push(id)
    })
  ).rejects.toBe(cancellation)

  expect(forgotten).toEqual([])
})

test('forgets a recent file after a non-cancellation open failure', async () => {
  const forgotten: string[] = []
  const error = new Error('The file could not be read')

  await expect(
    openRecentDocument(document, undefined, {
      openLocalFile: async () => {
        throw error
      },
      forgetRecentDocument: (id) => forgotten.push(id)
    })
  ).rejects.toBe(error)

  expect(forgotten).toEqual([document.id])
})
