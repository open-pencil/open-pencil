import { afterEach, describe, expect, test, vi } from 'bun:test'

import { createDefaultEditorState } from '@open-pencil/core'

import * as browserIO from '@/app/document/io/browser'
import { createSaveActions } from '@/app/document/io/save/actions'
import * as saveTargets from '@/app/document/io/save/targets'
import { createDocumentSourceState } from '@/app/document/io/source/state'

import { asDouble } from '#tests/helpers/doubles'

function makeWritableHandle(name: string): FileSystemFileHandle {
  return asDouble<FileSystemFileHandle>({
    kind: 'file',
    name,
    createWritable: vi.fn(async () => ({
      write: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined)
    }))
  })
}

function createSaveHarness(handle: FileSystemFileHandle) {
  const state = {
    ...createDefaultEditorState('page'),
    documentName: 'Untitled'
  }
  const setSourceIdentity = vi.fn()
  const actions = createSaveActions({
    state,
    version: () => 1,
    buildFigFile: () => new Uint8Array([1, 2, 3]),
    getFilePath: () => null,
    setFilePath: vi.fn(),
    getFileHandle: () => handle,
    setFileHandle: vi.fn(),
    getDownloadName: () => null,
    setDownloadName: vi.fn(),
    getStorageBinding: () => null,
    setStorageBinding: vi.fn(),
    hasWritableSource: () => true,
    setSourceIdentity,
    setSavedVersion: vi.fn(),
    setLastWriteTime: vi.fn(),
    startWatchingFile: vi.fn()
  })
  return { actions, setSourceIdentity }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('saved document identity', () => {
  test('tracks storage binding alongside local source identity', () => {
    const source = createDocumentSourceState()
    source.setSourceIdentity({ handle: null, path: '/tmp/local.fig' })
    source.setStorageBinding({ providerId: 's3-compatible', documentId: 'remote-1' })

    expect(source.getSourceIdentity()).toEqual({ handle: null, path: '/tmp/local.fig' })
    expect(source.getStorageBinding()).toEqual({
      providerId: 's3-compatible',
      documentId: 'remote-1'
    })
  })

  test('a browser document opened from a URL saves by download, not in place', () => {
    const source = createDocumentSourceState()
    source.setFilePath('https://example.com/design.fig')
    expect(source.hasWritableSource()).toBe(false)

    source.setFileHandle(makeWritableHandle('design.fig'))
    expect(source.hasWritableSource()).toBe(true)
  })

  test('a desktop document saves to its path in place', () => {
    const source = createDocumentSourceState()
    source.setFilePath('/Users/me/design.fig')
    Reflect.set(globalThis, 'window', { __TAURI_INTERNALS__: {} })
    try {
      expect(source.hasWritableSource()).toBe(true)
    } finally {
      Reflect.deleteProperty(globalThis, 'window')
    }
  })

  test('a file the browser will not write to is downloaded under its name and forgotten', async () => {
    // An embedded browser hands out the picked file, then refuses to write to it.
    const refused = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name: 'chosen.fig',
      createWritable: vi.fn(async () => {
        throw new DOMException('Not allowed in this context', 'NotAllowedError')
      })
    })
    vi.spyOn(saveTargets, 'chooseBrowserFigSaveHandle').mockResolvedValue(refused)
    const download = vi.spyOn(browserIO, 'downloadBlob').mockReturnValue(undefined)
    const { actions, setSourceIdentity } = createSaveHarness(refused)

    expect(await actions.saveFigFileAs()).toBe(true)
    expect(download).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'chosen.fig',
      'application/octet-stream'
    )
    expect(setSourceIdentity).toHaveBeenLastCalledWith({ handle: null, path: null })
  })

  test('publishes the writable handle after a successful save', async () => {
    const handle = makeWritableHandle('saved.fig')
    const { actions, setSourceIdentity } = createSaveHarness(handle)

    await actions.saveFigFile()

    expect(setSourceIdentity).toHaveBeenCalledWith({ handle, path: null })
  })

  test('does not publish an identity when writing fails', async () => {
    const handle = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name: 'failed.fig',
      createWritable: vi.fn(async () => {
        throw new Error('write failed')
      })
    })
    const { actions, setSourceIdentity } = createSaveHarness(handle)

    await expect(actions.saveFigFile()).rejects.toThrow('write failed')
    expect(setSourceIdentity).not.toHaveBeenCalled()
  })
})
