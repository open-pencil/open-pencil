import { afterEach, describe, expect, test, vi } from 'bun:test'

import { ref } from 'vue'

import { spawnAcpProcess } from '@/app/ai/acp/process'
import { checkForAppUpdate } from '@/app/shell/updater'

import { clearTauriMocks, mockTauriIPC } from '../helpers/tauri-mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Tauri process helpers', () => {
  test('spawns ACP processes and streams stdout/stdin through plugin-shell', async () => {
    let onEvent: ((event: unknown) => void) | null = null
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:shell|spawn') {
        expect(args).toMatchObject({
          program: 'agent-cli',
          args: ['--stdio'],
          options: { encoding: 'raw' }
        })
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 42
      }
      return null
    })

    const process = await spawnAcpProcess({
      command: 'agent-cli',
      args: ['--stdio'],
      logId: 'test',
      destroying: () => false,
      onUnexpectedClose: vi.fn()
    })

    const reader = process.output.getReader()
    onEvent?.({ event: 'Stdout', payload: [1, 2, 3] })
    await expect(reader.read()).resolves.toEqual({ done: false, value: new Uint8Array([1, 2, 3]) })

    const writer = process.input.getWriter()
    await writer.write(new Uint8Array([4, 5]))
    await process.child.kill()

    expect(calls.map((call) => call.cmd)).toEqual([
      'plugin:shell|spawn',
      'plugin:shell|stdin_write',
      'plugin:shell|kill'
    ])
    expect(calls[1]?.args).toEqual({ pid: 42, buffer: [4, 5] })
    expect(calls[2]?.args).toEqual({ cmd: 'killChild', pid: 42 })
  })

  test('signals unexpected ACP process close to the output stream', async () => {
    let onEvent: ((event: unknown) => void) | null = null
    const onUnexpectedClose = vi.fn()
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:shell|spawn') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 43
      }
      return null
    })

    const process = await spawnAcpProcess({
      command: 'agent-cli',
      args: [],
      logId: 'test',
      destroying: () => false,
      onUnexpectedClose
    })
    const reader = process.output.getReader()

    onEvent?.({ event: 'Terminated', payload: { code: 1, signal: null } })

    await expect(reader.read()).rejects.toThrow('Agent process exited unexpectedly.')
    expect(onUnexpectedClose).toHaveBeenCalled()
  })
})

describe('Tauri updater helper', () => {
  const messages = ref({
    appUpToDate: 'Up to date',
    updateAvailableTitle: 'Update available',
    updateAvailable: ({ version }: { version: string }) => `Version ${version}`,
    updateInstallPrompt: 'Install now?',
    downloadingUpdate: ({ version }: { version: string }) => `Downloading ${version}`,
    updateInstalledTitle: 'Installed',
    updateInstalled: ({ version, size }: { version: string; size: string }) =>
      `Installed ${version}${size}`,
    updateUnavailable: 'Unavailable',
    updateCheckFailed: ({ error }: { error: string }) => `Failed: ${error}`
  })

  test('returns quietly when no Tauri update is available', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      if (cmd === 'plugin:updater|check') return null
      return null
    })

    await checkForAppUpdate({ silent: true, messages })

    expect(calls).toEqual(['plugin:updater|check'])
  })

  test('confirms, installs, and relaunches available Tauri updates', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:updater|check') {
        return {
          rid: 9,
          currentVersion: '0.11.8',
          version: '0.11.9',
          date: null,
          body: 'Release notes',
          rawJson: '{}'
        }
      }
      if (cmd === 'plugin:dialog|confirm') return true
      if (cmd === 'plugin:updater|download_and_install') {
        const onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent
        onEvent.onmessage({ event: 'Started', data: { contentLength: 10 } })
        onEvent.onmessage({ event: 'Progress', data: { chunkLength: 10 } })
      }
      return null
    })

    await checkForAppUpdate({ messages })

    expect(calls.map((call) => call.cmd)).toEqual([
      'plugin:updater|check',
      'plugin:dialog|confirm',
      'plugin:updater|download_and_install',
      'plugin:dialog|message',
      'plugin:process|restart'
    ])
    expect(calls[1]?.args).toMatchObject({
      title: 'Update available',
      kind: 'info'
    })
    expect(calls[2]?.args).toMatchObject({ rid: 9 })
  })
})
