import { afterEach, describe, expect, test } from 'bun:test'

import { repoPath } from '@open-pencil/test-support/paths'

import { readReloadSource } from '@/app/document/io/reload-source'
import { chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import { createDocumentWriter } from '@/app/document/io/write'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

/** The file a raw `write_file` call targets, from the headers plugin-fs sends. */
function writePath(options: unknown): string | null {
  const path = (options as { headers?: { path?: string } } | undefined)?.headers?.path
  return path ? decodeURIComponent(path) : null
}

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

  test('streams document bytes through plugin-fs without JSON IPC', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args, options) => {
      calls.push({ cmd, args, options })
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
      'plugin:fs|lstat',
      'plugin:fs|write_file',
      'plugin:fs|write_file',
      'plugin:fs|rename'
    ])
    const temporary = writePath(calls[1]?.options)
    expect(temporary).toMatch(/^\/tmp\/document\.fig\.[0-9a-f]{16}\.saving$/)
    expect(writePath(calls[2]?.options)).toBe(temporary)
    expect(calls[2]?.args).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]))
    expect(calls[3]?.args).toEqual({
      oldPath: temporary,
      newPath: '/tmp/document.fig',
      options: undefined
    })
    expect(progress).toEqual([
      [4, 6],
      [6, 6]
    ])
    expect(savedVersions).toEqual([42])
  })

  test('writes large streams in bounded raw chunks', async () => {
    const sizes: number[] = []
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:fs|write_file') sizes.push((args as Uint8Array).byteLength)
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

    await write(async (sink) => {
      await sink(new Uint8Array(5 * 1024 * 1024).fill(1))
      await sink(new Uint8Array(5 * 1024 * 1024).fill(2))
    }, 1)

    expect(sizes).toEqual([0, 8 * 1024 * 1024, 2 * 1024 * 1024])
  })

  test('keeps the saved file when a stream fails', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args, options) => {
      calls.push({ cmd, args, options })
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
      'plugin:fs|lstat',
      'plugin:fs|write_file',
      'plugin:fs|remove'
    ])
    const temporary = writePath(calls[1]?.options)
    expect(temporary).toMatch(/^\/tmp\/document\.fig\.[0-9a-f]{16}\.saving$/)
    expect(calls[2]?.args).toEqual({ path: temporary, options: undefined })
  })

  test('writes through a symlink instead of replacing it', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args, options) => {
      calls.push({ cmd, args, options })
      if (cmd === 'plugin:fs|lstat') {
        return {
          isFile: false,
          isDirectory: false,
          isSymlink: true,
          size: 0,
          mtime: null,
          atime: null,
          birthtime: null,
          readonly: false
        }
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

    await write(async (sink) => {
      await sink(new Uint8Array([1, 2, 3]))
    }, 1)

    expect(calls.map((call) => call.cmd)).toEqual([
      'plugin:fs|lstat',
      'plugin:fs|write_file',
      'plugin:fs|write_file'
    ])
    expect(writePath(calls[1]?.options)).toBe('/tmp/document.fig')
    expect(writePath(calls[2]?.options)).toBe('/tmp/document.fig')
  })

  test('removes the temporary file when an append write fails', async () => {
    const calls: string[] = []
    let writes = 0
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      if (cmd === 'plugin:fs|write_file' && ++writes === 2) throw new Error('disk full')
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
        await sink(new Uint8Array(9 * 1024 * 1024))
      }, 1)
    ).rejects.toThrow('disk full')

    expect(calls).toEqual([
      'plugin:fs|lstat',
      'plugin:fs|write_file',
      'plugin:fs|write_file',
      'plugin:fs|remove'
    ])
  })

  test('runs saves one after another', async () => {
    const order: string[] = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let firstStarted!: () => void
    const firstDidStart = new Promise<void>((resolve) => {
      firstStarted = resolve
    })
    await mockTauriIPC(() => null)
    const write = createDocumentWriter({
      state: { documentName: 'Document' },
      getFilePath: () => '/tmp/document.fig',
      getFileHandle: () => null,
      getStorageBinding: () => null,
      setSavedVersion: () => undefined,
      setLastWriteTime: () => undefined
    })

    const first = write(async (sink) => {
      order.push('first')
      firstStarted()
      await firstGate
      await sink(new Uint8Array([1]))
    }, 1)
    await firstDidStart
    const second = write(async (sink) => {
      order.push('second')
      await sink(new Uint8Array([2]))
    }, 2)
    await Promise.resolve()

    expect(order).toEqual(['first'])

    releaseFirst()
    await first
    await second
    expect(order).toEqual(['first', 'second'])
  })

  test('uses a different temporary file for each save', async () => {
    const temporaryPaths = new Set<string>()
    await mockTauriIPC((cmd, _args, options) => {
      if (cmd === 'plugin:fs|write_file') {
        const path = writePath(options)
        if (path) temporaryPaths.add(path)
      }
      return null
    })
    const makeWriter = () =>
      createDocumentWriter({
        state: { documentName: 'Document' },
        getFilePath: () => '/tmp/document.fig',
        getFileHandle: () => null,
        getStorageBinding: () => null,
        setSavedVersion: () => undefined,
        setLastWriteTime: () => undefined
      })
    const first = makeWriter()
    const second = makeWriter()

    await Promise.all([
      first(async (sink) => {
        await sink(new Uint8Array([1]))
      }, 1),
      second(async (sink) => {
        await sink(new Uint8Array([2]))
      }, 2)
    ])

    expect(temporaryPaths.size).toBe(2)
    for (const path of temporaryPaths) {
      expect(path).toMatch(/^\/tmp\/document\.fig\.[0-9a-f]{16}\.saving$/)
    }
  })

  test('keeps a completed write successful when recovery cleanup fails', async () => {
    await mockTauriIPC(() => null)
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
