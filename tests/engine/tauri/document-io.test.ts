import { afterEach, describe, expect, test } from 'bun:test'

import { readReloadSource } from '@/app/document/io/reload-source'
import { chooseTauriFigSavePath } from '@/app/document/io/save-targets'
import { createDocumentWriter } from '@/app/document/io/write'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri-mocks'

afterEach(async () => {
  await clearTauriMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Tauri document IO helpers', () => {
  test('reads reload source bytes through plugin-fs', async () => {
    const fixture = await Bun.file('tests/fixtures/gold-preview.fig').arrayBuffer()
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

  test('writes document bytes through plugin-fs', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args, options) => {
      calls.push({ cmd, args, options })
      return null
    })
    const savedVersions: number[] = []
    const write = createDocumentWriter({
      state: { sceneVersion: 42 } as Parameters<typeof createDocumentWriter>[0]['state'],
      getFilePath: () => '/tmp/document.fig',
      getFileHandle: () => null,
      setSavedVersion: (version) => savedVersions.push(version),
      setLastWriteTime: () => {}
    })

    await write(new Uint8Array([1, 2, 3]))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.cmd).toBe('plugin:fs|write_file')
    expect([...new Uint8Array(calls[0]?.args as ArrayBuffer)]).toEqual([1, 2, 3])
    expect(calls[0]?.options).toEqual({
      headers: { path: '%2Ftmp%2Fdocument.fig', options: undefined }
    })
    expect(savedVersions).toEqual([42])
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

    await expect(chooseTauriFigSavePath()).resolves.toBe('/tmp/Untitled.fig')
  })
})
