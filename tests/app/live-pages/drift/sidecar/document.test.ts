import { expect, test } from 'bun:test'

import { documentBelongsTo, openDocumentPath } from '@/app/live-pages/drift/sidecar/document'

const REPO = 'D:/work/site'

test('a document inside the repository belongs to it', () => {
  expect(documentBelongsTo('D:/work/site/design.fig', REPO)).toBe(true)
  expect(documentBelongsTo('D:\\work\\site\\pages\\design.fig', REPO)).toBe(true)
  expect(documentBelongsTo('D:/work/site', REPO)).toBe(false)
})

test('a document beside the repository does not belong to it', () => {
  expect(documentBelongsTo('D:/work/site-two/design.fig', REPO)).toBe(false)
  expect(documentBelongsTo('D:/work/other/design.fig', REPO)).toBe(false)
  expect(documentBelongsTo('D:/work/design.fig', REPO)).toBe(false)
})

test('a repository with no folder belongs to nothing', () => {
  expect(documentBelongsTo('D:/work/site/design.fig', '')).toBe(false)
})

test('the open document of a repository is the first one it holds', () => {
  expect(openDocumentPath([null, 'D:/work/other/design.fig', 'D:/work/site/a.fig'], REPO)).toBe(
    'D:/work/site/a.fig'
  )
  expect(openDocumentPath([], REPO)).toBeNull()
  expect(openDocumentPath([null, 'D:/work/other/design.fig'], REPO)).toBeNull()
})
