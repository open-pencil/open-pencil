import { afterEach, describe, expect, test, vi } from 'bun:test'

import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'

import { clearTauriMocks, installTauriMockWindow, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const DISCOVERY_PATH = '/mock/home/.openpencil/mcp.json'
const DISCOVERY_JSON = JSON.stringify({
  pid: 1234,
  socketPath: '/mock/home/.openpencil/mcp.sock',
  httpPort: 7600,
  authRequired: true,
  authToken: 'discovery-token',
  version: '0.0.0-test',
  startedAt: new Date().toISOString()
})

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'navigator')
  Reflect.deleteProperty(globalThis, 'location')
})

describe('Tauri MCP spawning', () => {
  test('spawns MCP server with shell plugin when health check is missing', async () => {
    installTauriMockWindow()
    Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'MacIntel' }
    })

    let healthChecks = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      healthChecks += 1
      if (healthChecks === 1) return new Response('', { status: 404 })
      return new Response(
        JSON.stringify({
          status: 'ok',
          version: '0.0.0-test',
          authRequired: true,
          discoveryPath: DISCOVERY_PATH
        }),
        { status: 200 }
      )
    })

    let onEvent: ((event: unknown) => void) | null = null
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:shell|spawn') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 77
      }
      if (cmd === 'plugin:fs|read_text_file') return new TextEncoder().encode(DISCOVERY_JSON)
      return null
    })

    const handle = await spawnMCPIfNeeded()
    onEvent?.({ event: 'Stderr', payload: [119, 97, 114, 110] })
    handle?.disconnect()
    await Promise.resolve()

    expect(handle?.authToken).toBe('discovery-token')
    expect(calls.some((c) => c.cmd === 'plugin:shell|spawn')).toBe(true)
    expect(calls.some((c) => c.cmd === 'plugin:fs|read_text_file')).toBe(true)
    expect(calls.at(-1)).toEqual({ cmd: 'plugin:shell|kill', args: { cmd: 'killChild', pid: 77 } })
  })
})
