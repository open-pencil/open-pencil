import { afterEach, describe, expect, test } from 'bun:test'

import { ensureTauriParentDirectory } from '@/app/automation/bridge/file-handlers'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Tauri automation file handling', () => {
  test('creates parent directory for automation new-document paths', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:path|dirname') return '/tmp/open-pencil/nested'
      return null
    })

    await ensureTauriParentDirectory('/tmp/open-pencil/nested/file.fig')

    expect(calls).toEqual([
      {
        cmd: 'plugin:path|dirname',
        args: { path: '/tmp/open-pencil/nested/file.fig' }
      },
      {
        cmd: 'plugin:fs|mkdir',
        args: { path: '/tmp/open-pencil/nested', options: { recursive: true } }
      }
    ])
  })

  test('uses native dirname for Unicode Windows save paths', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:path|dirname') return 'C:\\Users\\Тест\\Документы'
      return null
    })

    await ensureTauriParentDirectory('C:\\Users\\Тест\\Документы\\пример.fig')

    expect(calls).toEqual([
      {
        cmd: 'plugin:path|dirname',
        args: { path: 'C:\\Users\\Тест\\Документы\\пример.fig' }
      },
      {
        cmd: 'plugin:fs|mkdir',
        args: { path: 'C:\\Users\\Тест\\Документы', options: { recursive: true } }
      }
    ])
  })
})
