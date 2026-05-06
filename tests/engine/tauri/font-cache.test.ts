import { afterEach, describe, expect, test } from 'bun:test'

import { clearDownloadedFontCache, downloadedFontCacheSummary } from '@/app/editor/fonts/cache'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const encoder = new TextEncoder()

afterEach(async () => {
  await clearTauriMocks()
})

describe('Tauri downloaded font cache helpers', () => {
  test('summarizes manifest entries through mocked plugin-fs IPC', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:fs|read_file')
      expect(args).toMatchObject({ path: 'font-cache/v1/manifest.json' })
      return [
        ...encoder.encode(
          JSON.stringify({
            version: 1,
            entries: {
              one: {
                family: 'Noto Sans SC',
                style: 'Regular',
                file: 'one.ttf',
                byteLength: 10,
                sha256: 'a',
                updatedAt: 100
              },
              two: {
                family: 'Noto Naskh Arabic',
                style: 'Regular',
                file: 'two.ttf',
                byteLength: 25,
                sha256: 'b',
                updatedAt: 250
              }
            }
          })
        )
      ]
    })

    await expect(downloadedFontCacheSummary()).resolves.toEqual({
      count: 2,
      byteLength: 35,
      updatedAt: 250
    })
  })

  test('returns an empty summary when manifest is missing', async () => {
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('plugin:fs|read_file')
      throw new Error('missing')
    })

    await expect(downloadedFontCacheSummary()).resolves.toEqual({
      count: 0,
      byteLength: 0,
      updatedAt: null
    })
  })

  test('clears the cache directory through mocked plugin-fs IPC', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      return null
    })

    await clearDownloadedFontCache()

    const { BaseDirectory } = await import('@tauri-apps/plugin-fs')
    expect(calls).toEqual([
      {
        cmd: 'plugin:fs|remove',
        args: {
          path: 'font-cache/v1',
          options: { baseDir: BaseDirectory.AppLocalData, recursive: true }
        }
      }
    ])
  })
})
