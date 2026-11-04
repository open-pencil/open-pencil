import { afterEach, describe, expect, test } from 'bun:test'

import {
  clearRecentFiles,
  forgetRecentFile,
  recentDocumentKind,
  recentDocuments,
  recentFiles,
  recentLocalFileAt,
  rememberRecentFile,
  rememberRecentStorageDocument,
  type RecentDocument
} from '@/app/recent-files'

afterEach(() => clearRecentFiles())

describe('recent documents', () => {
  test('keeps the latest local file first without duplicates', () => {
    recentDocuments.value = []

    rememberRecentFile('/tmp/first.fig', 'design')
    rememberRecentFile('/tmp/second.fig', 'design')
    rememberRecentFile('/tmp/first.fig', 'design')

    expect(recentFiles.value.map(({ kind, name }) => ({ kind, name }))).toEqual([
      { kind: 'local', name: 'first.fig' },
      { kind: 'local', name: 'second.fig' }
    ])
    expect(recentLocalFileAt(0)).toBe('/tmp/first.fig')
  })

  test('tracks storage documents alongside local files', () => {
    rememberRecentFile('/tmp/local.fig', 'design')
    rememberRecentStorageDocument(
      { providerId: 's3-compatible', documentId: 'remote-1' },
      'Remote design',
      'design'
    )

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

  test('keeps documents of different server profiles apart', () => {
    const document = {
      providerId: 'openpencil-cloud',
      containerId: 'workspace-1',
      documentId: 'doc-1'
    }
    rememberRecentStorageDocument({ ...document, profileId: 'server-a' }, 'On A', 'design')
    rememberRecentStorageDocument({ ...document, profileId: 'server-b' }, 'On B', 'design')

    expect(recentFiles.value.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'storage:openpencil-cloud:server-b:doc-1', name: 'On B' },
      { id: 'storage:openpencil-cloud:server-a:doc-1', name: 'On A' }
    ])
    expect(recentFiles.value[0]).toMatchObject({
      profileId: 'server-b',
      containerId: 'workspace-1'
    })
  })

  test('forgets missing local files and clears the list', () => {
    rememberRecentFile('/tmp/first.fig', 'design')
    rememberRecentFile('/tmp/second.fig', 'design')

    forgetRecentFile('/tmp/first.fig')
    expect(recentFiles.value.map((document) => document.name)).toEqual(['second.fig'])

    clearRecentFiles()
    expect(recentFiles.value).toEqual([])
    expect(recentLocalFileAt(0)).toBeNull()
  })

  test('remembers whether each file is a design or a board, whatever its name', () => {
    rememberRecentFile('/tmp/plan.fig', 'board')
    rememberRecentFile('/tmp/screens.fig', 'design')
    rememberRecentStorageDocument(
      { providerId: 's3-compatible', documentId: 'b' },
      'Retro',
      'board'
    )
    expect(recentFiles.value.map(({ name, documentKind }) => [name, documentKind])).toEqual([
      ['Retro', 'board'],
      ['screens.fig', 'design'],
      ['plan.fig', 'board']
    ])
    expect(recentFiles.value.map(recentDocumentKind)).toEqual(['board', 'design', 'board'])
  })

  test('reads the kind of files recorded before kinds were', () => {
    const updatedAt = new Date().toISOString()
    const legacy: RecentDocument[] = [
      { id: 'local:/tmp/plan.jam', kind: 'local', path: '/tmp/plan.jam', name: 'plan', updatedAt },
      { id: 'local:/tmp/ui.fig', kind: 'local', path: '/tmp/ui.fig', name: 'ui', updatedAt },
      {
        id: 'storage:s3-compatible:r',
        kind: 'storage',
        providerId: 's3-compatible',
        documentId: 'r',
        name: 'Remote',
        updatedAt
      }
    ]
    expect(legacy.map(recentDocumentKind)).toEqual(['board', 'design', 'design'])
  })
})
