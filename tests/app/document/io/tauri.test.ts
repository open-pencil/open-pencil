import { afterEach, describe, expect, test } from 'bun:test'

import { repoPath } from '@open-pencil/test-support/paths'

import { readReloadSource } from '@/app/document/io/reload-source'
import { chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import { createDocumentWriter } from '@/app/document/io/write'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Tauri document IO helpers', () => {
  test('reads reload source bytes through plugin-fs', async () => {
    const fixture = await Bun.file(repoPath('tests/fixtures/circle-text.fig')).arrayBuffer()
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:fs|read_file')
      expect(args).toEqual({ path: '/tmp/document.fig', options: undefined })
      return [...new Uint8Array(fixture)]
    })

    const document = await readReloadSource({
      documentName: 'document',
      filePath: '/tmp/document.fig',
      fileHandle: null
    })

    expect(document?.getPages().length).toBeGreaterThan(0)
  })

  test('streams document bytes through a plugin-fs file handle', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args, options: undefined })
      if (cmd === 'plugin:fs|open') return 7
      if (cmd === 'plugin:fs|write') {
        const data = (args as { data: Uint8Array | number[] }).data
        return ArrayBuffer.isView(data) ? data.byteLength : data.length
      }
      return null
    })
    const savedVersions: number[] = []
    const progress: Array<[number, number]> = []
    const write = createDocumentWriter({
      state: { documentName: 'Document' },
      getFilePath: () => '/tmp/document.fig',
      getFileHandle: () => null,
      getStorageBinding: () => null,
      setSavedVersion: (version) => savedVersions.push(version),
      setLastWriteTime: () => undefined
    })

    await write(
      async (sink, onProgress) => {
        await sink(new Uint8Array([1, 2, 3, 4]))
        onProgress?.(4, 6)
        await sink(new Uint8Array([5, 6]))
        onProgress?.(6, 6)
      },
      42,
      (written, total) => progress.push([written, total])
    )

    expect(calls.map((call) => call.cmd)).toEqual([
      'plugin:fs|open',
      'plugin:fs|write',
      'plugin:fs|write',
      'plugin:resources|close',
      'plugin:fs|rename'
    ])
    expect(calls[0]?.args).toEqual({
      path: '/tmp/document.fig.saving',
      options: { write: true, create: true, truncate: true }
    })
    expect(calls[4]?.args).toEqual({
      oldPath: '/tmp/document.fig.saving',
      newPath: '/tmp/document.fig',
      options: undefined
    })
    const written = calls
      .filter((call) => call.cmd === 'plugin:fs|write')
      .flatMap((call) => [...new Uint8Array((call.args as { data: ArrayBuffer }).data)])
    expect(written).toEqual([1, 2, 3, 4, 5, 6])
    expect(progress).toEqual([
      [4, 6],
      [6, 6]
    ])
    expect(savedVersions).toEqual([42])
  })

  test('keeps the saved file when a stream fails', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:fs|open') return 7
      if (cmd === 'plugin:fs|write') {
        const data = (args as { data: Uint8Array | number[] }).data
        return ArrayBuffer.isView(data) ? data.byteLength : data.length
      }
      return null
    })
    const write = createDocumentWriter({
      state: { documentName: 'Document' },
      getFilePath: () => '/tmp/document.fig',
      getFileHandle: () => null,
      getStorageBinding: () => null,
      setSavedVersion: () => undefined,
      setLastWriteTime: () => undefined
    })

    await expect(
      write(async (sink) => {
        await sink(new Uint8Array([1, 2]))
        throw new Error('disk full')
      }, 3)
    ).rejects.toThrow('disk full')

    expect(calls.map((call) => call.cmd)).toEqual([
      'plugin:fs|open',
      'plugin:fs|write',
      'plugin:resources|close',
      'plugin:fs|remove'
    ])
    expect(calls[0]?.args).toEqual({
      path: '/tmp/document.fig.saving',
      options: { write: true, create: true, truncate: true }
    })
    expect(calls[3]?.args).toEqual({ path: '/tmp/document.fig.saving', options: undefined })
  })

  test('keeps a completed write successful when recovery cleanup fails', async () => {
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:fs|open') return 7
      if (cmd === 'plugin:fs|write') {
        const data = (args as { data: Uint8Array | number[] }).data
        return ArrayBuffer.isView(data) ? data.byteLength : data.length
      }
      return null
    })
    const savedVersions: number[] = []
    const write = createDocumentWriter({
      state: { documentName: 'Document' },
      getFilePath: () => '/tmp/document.fig',
      getFileHandle: () => null,
      getStorageBinding: () => null,
      setSavedVersion: (version) => savedVersions.push(version),
      setLastWriteTime: () => undefined,
      onWriteSuccess: () => Promise.reject(new Error('IndexedDB blocked'))
    })

    await expect(
      write(async (sink) => {
        await sink(new Uint8Array([1]))
      }, 17)
    ).resolves.toBe(true)
    expect(savedVersions).toEqual([17])
  })

  test('chooses a Tauri save path through plugin-dialog', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:dialog|save')
      expect(args).toEqual({
        options: {
          defaultPath: 'Untitled.fig',
          filters: [{ name: 'Figma file', extensions: ['fig'] }]
        }
      })
      return '/tmp/Untitled.fig'
    })

    await expect(chooseTauriFigSavePath('design')).resolves.toBe('/tmp/Untitled.fig')
  })

  test('saves a board as a FigJam .jam', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:dialog|save')
      expect(args).toEqual({
        options: {
          defaultPath: 'Untitled.jam',
          filters: [{ name: 'FigJam board', extensions: ['jam'] }]
        }
      })
      return '/tmp/Untitled.jam'
    })

    await expect(chooseTauriFigSavePath('board')).resolves.toBe('/tmp/Untitled.jam')
  })
})
