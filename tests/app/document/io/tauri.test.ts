import { afterEach, describe, expect, test } from 'bun:test'

import { repoPath } from '@open-pencil/test-support/paths'

import { readReloadSource } from '@/app/document/io/reload-source'
import { chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import { createDocumentWriter } from '@/app/document/io/write'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

function streamOf(...chunks: number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk))
      controller.close()
    }
  })
}

const bytesOf = (args: unknown) => (args instanceof Uint8Array ? [...args] : args)

/** The decoded path a `write_file` call names in its headers. */
function pathOf(options: unknown): string {
  const headers = (options as { headers?: { path?: string } } | undefined)?.headers
  return decodeURIComponent(headers?.path ?? '')
}

const EMPTY_FILE_INFO = {
  isFile: false,
  isDirectory: false,
  isSymlink: false,
  size: 0,
  mtime: null,
  atime: null,
  birthtime: null,
  readonly: false
}

function writer(options: Partial<Parameters<typeof createDocumentWriter>[0]> = {}) {
  return createDocumentWriter({
    state: { documentName: 'Document' },
    getFilePath: () => '/tmp/document.fig',
    getFileHandle: () => null,
    getStorageBinding: () => null,
    setSavedVersion: () => undefined,
    setLastWriteTime: () => undefined,
    ...options
  })
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
      filePath: '/tmp/document.fig',
      fileHandle: null
    })

    expect(document?.getPages().length).toBeGreaterThan(0)
  })

  test('writes beside the file in gathered raw chunks and moves the copy over it once complete', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args, options) => {
      calls.push({ cmd, args, options })
      return null
    })
    const savedVersions: number[] = []
    const write = writer({ setSavedVersion: (version) => savedVersions.push(version) })

    await write(streamOf([1, 2], [3]), 42)

    const partial = pathOf(calls[1]?.options)
    expect(partial).toMatch(/^\/tmp\/document\.fig\.[0-9a-f]{16}\.saving$/)
    expect(calls.map(({ cmd, args, options }) => ({ cmd, args: bytesOf(args), options }))).toEqual([
      { cmd: 'plugin:fs|lstat', args: { path: '/tmp/document.fig' }, options: undefined },
      {
        cmd: 'plugin:fs|write_file',
        args: [1, 2, 3],
        options: { headers: { path: encodeURIComponent(partial), options: '{"append":false}' } }
      },
      {
        cmd: 'plugin:fs|rename',
        args: { oldPath: partial, newPath: '/tmp/document.fig' },
        options: undefined
      }
    ])
    expect(savedVersions).toEqual([42])
  })

  test('writes a large document in bounded raw chunks', async () => {
    const sizes: Array<[number, string]> = []
    await mockTauriIPC((cmd, args, options) => {
      if (cmd === 'plugin:fs|write_file' && args instanceof Uint8Array) {
        sizes.push([args.byteLength, (options as { headers: { options: string } }).headers.options])
      }
      return null
    })
    const megabyte = 1024 * 1024
    let pulled = 0
    const large = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled++ < 9) controller.enqueue(new Uint8Array(megabyte))
        else controller.close()
      }
    })

    await writer()(large, 1)

    expect(sizes).toEqual([
      [8 * megabyte, '{"append":false}'],
      [megabyte, '{"append":true}']
    ])
  })

  test('leaves the file alone when the document fails partway through', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return null
    })
    let pulls = 0
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(new Uint8Array([1]))
        else controller.error(new Error('The archive worker stopped'))
      }
    })

    await expect(writer()(failing, 1)).rejects.toThrow('The archive worker stopped')
    expect(calls).toEqual(['plugin:fs|lstat', 'plugin:fs|remove'])
  })

  test('writes through a symbolic link instead of replacing it', async () => {
    const paths: string[] = []
    await mockTauriIPC((cmd, _args, options) => {
      if (cmd === 'plugin:fs|lstat') return { ...EMPTY_FILE_INFO, isSymlink: true }
      paths.push(`${cmd} ${cmd === 'plugin:fs|write_file' ? pathOf(options) : ''}`)
      return null
    })

    await writer()(streamOf([1]), 1)

    expect(paths).toEqual(['plugin:fs|write_file /tmp/document.fig'])
  })

  test('runs saves one after another, each through a copy of its own', async () => {
    const events: string[] = []
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await mockTauriIPC((cmd, _args, options) => {
      if (cmd === 'plugin:fs|write_file') events.push(pathOf(options))
      if (cmd === 'plugin:fs|rename') events.push('rename')
      return null
    })
    const write = writer()
    const slow = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await held
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      }
    })

    const first = write(slow, 1)
    const second = write(streamOf([2]), 2)
    await Bun.sleep(0)
    expect(events).toEqual([])
    release()
    await Promise.all([first, second])

    expect(events.filter((event) => event === 'rename')).toHaveLength(2)
    expect(events[1]).toBe('rename')
    expect(events[0]).not.toBe(events[2])
  })

  test('keeps a completed write successful when recovery cleanup fails', async () => {
    await mockTauriIPC(() => null)
    const savedVersions: number[] = []
    const write = writer({
      setSavedVersion: (version) => savedVersions.push(version),
      onWriteSuccess: () => Promise.reject(new Error('IndexedDB blocked'))
    })

    await expect(write(streamOf([1]), 17)).resolves.toBe(true)
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
