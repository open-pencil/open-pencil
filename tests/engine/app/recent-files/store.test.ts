import { afterEach, describe, expect, test } from 'bun:test'

import {
  clearRecentFiles,
  forgetRecentFile,
  recentDocuments,
  recentFiles,
  recentLocalFileAt,
  rememberRecentFile,
  rememberRecentStorageDocument
} from '@/app/recent-files'

afterEach(() => clearRecentFiles())

describe('recent documents', () => {
  test('keeps the latest local file first without duplicates', () => {
    recentDocuments.value = []

    rememberRecentFile('/tmp/first.fig')
    rememberRecentFile('/tmp/second.fig')
    rememberRecentFile('/tmp/first.fig')

    expect(recentFiles.value.map(({ kind, name }) => ({ kind, name }))).toEqual([
      { kind: 'local', name: 'first.fig' },
      { kind: 'local', name: 'second.fig' }
    ])
    expect(recentLocalFileAt(0)).toBe('/tmp/first.fig')
  })

  test('tracks storage documents alongside local files', () => {
    rememberRecentFile('/tmp/local.fig')
    rememberRecentStorageDocument('s3-compatible', 'remote-1', 'Remote design')

    expect(recentFiles.value.map(({ id, kind, name }) => ({ id, kind, name }))).toEqual([
      {
        id: 'storage:s3-compatible:remote-1',
        kind: 'storage',
        name: 'Remote design'
      },
      { id: 'local:/tmp/local.fig', kind: 'local', name: 'local.fig' }
    ])
    expect(recentLocalFileAt(0)).toBe('/tmp/local.fig')
  })

  test('keeps same-ID Cloud documents from different instances separate with their bindings', () => {
    const first = {
      providerId: 'openpencil-cloud' as const,
      connectionId: 'instance-a',
      workspaceId: 'workspace-a',
      documentId: 'shared-id'
    }
    const second = { ...first, connectionId: 'instance-b', workspaceId: 'workspace-b' }
    rememberRecentStorageDocument(first.providerId, first.documentId, 'First', first)
    rememberRecentStorageDocument(second.providerId, second.documentId, 'Second', second)
    expect(recentFiles.value).toHaveLength(2)
    expect(recentFiles.value).toMatchObject([
      { id: 'storage:openpencil-cloud:instance-b:shared-id', binding: second },
      { id: 'storage:openpencil-cloud:instance-a:shared-id', binding: first }
    ])
  })

  test('forgets missing local files and clears the list', () => {
    rememberRecentFile('/tmp/first.fig')
    rememberRecentFile('/tmp/second.fig')

    forgetRecentFile('/tmp/first.fig')
    expect(recentFiles.value.map((document) => document.name)).toEqual(['second.fig'])

    clearRecentFiles()
    expect(recentFiles.value).toEqual([])
    expect(recentLocalFileAt(0)).toBeNull()
  })
})
