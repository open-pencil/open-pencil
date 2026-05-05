import { afterEach, describe, expect, test } from 'bun:test'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri-mocks'

import { saveExportedFile } from '@/app/document/export/files'
import { watchTauriFile } from '@/app/document/io/watch-targets'
import { chooseTauriOpenPath, readTauriDesignFile } from '@/app/shell/menu/files'

afterEach(async () => {
  await clearTauriMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Tauri file actions', () => {
  test('chooses a design file through plugin-dialog', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:dialog|open')
      expect(args).toEqual({
        options: {
          filters: [{ name: 'Design file', extensions: ['fig', 'pen'] }],
          multiple: false
        }
      })
      return '/tmp/design.fig'
    })

    await expect(chooseTauriOpenPath()).resolves.toBe('/tmp/design.fig')
  })

  test('reads a Tauri design file into a File object', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:fs|read_file')
      expect(args).toEqual({ path: '/tmp/design.pen', options: undefined })
      return [123, 34, 97, 34, 58, 49, 125]
    })

    const file = await readTauriDesignFile('/tmp/design.pen')

    expect(file.name).toBe('design.pen')
    await expect(file.text()).resolves.toBe('{"a":1}')
  })

  test('saves exports through Tauri dialog and fs APIs', async () => {
    const calls: Array<{ cmd: string; args: unknown; options: unknown }> = []
    await mockTauriIPC((cmd, args, options) => {
      calls.push({ cmd, args, options })
      if (cmd === 'plugin:dialog|save') return '/tmp/export.png'
      return null
    })

    await saveExportedFile(
      new Uint8Array([1, 2, 3]),
      'Export@1x.png',
      'PNG',
      '.png',
      'image/png',
      () => {
        throw new Error('browser download should not run in Tauri')
      }
    )

    expect(calls[0]).toEqual({
      cmd: 'plugin:dialog|save',
      args: {
        options: {
          defaultPath: 'Export@1x.png',
          filters: [{ name: 'PNG', extensions: ['png'] }]
        }
      },
      options: undefined
    })
    expect(calls[1]?.cmd).toBe('plugin:fs|write_file')
    expect([...new Uint8Array(calls[1]?.args as ArrayBuffer)]).toEqual([1, 2, 3])
    expect(calls[1]?.options).toEqual({
      headers: { path: '%2Ftmp%2Fexport.png', options: undefined }
    })
  })

  test('watches Tauri files and ignores recent local writes', async () => {
    let onEvent: ((event: unknown) => void) | null = null
    const calls: string[] = []
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:fs|watch') {
        expect(args).toMatchObject({
          paths: ['/tmp/design.fig'],
          options: { delayMs: 500 }
        })
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 7
      }
      calls.push(cmd)
      return null
    })

    const unwatch = await watchTauriFile(
      '/tmp/design.fig',
      () => 0,
      () => calls.push('reload')
    )
    onEvent?.({ type: { modify: { kind: 'data' } } })
    expect(calls).toEqual(['reload'])

    await clearTauriMocks()
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:fs|watch') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 8
      }
      calls.push(cmd)
      return null
    })
    calls.length = 0
    await watchTauriFile(
      '/tmp/design.fig',
      () => Date.now(),
      () => calls.push('reload')
    )
    onEvent?.({ type: { modify: { kind: 'data' } } })
    expect(calls).toEqual([])

    unwatch()
  })
})
