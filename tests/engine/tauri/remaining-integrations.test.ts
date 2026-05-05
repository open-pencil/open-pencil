import { afterEach, describe, expect, test, vi } from 'bun:test'

import type { ACPChatTransport } from '@/app/ai/acp/transport'
import { createACPTransport } from '@/app/ai/chat/transports'
import { ensureTauriParentDirectory } from '@/app/automation/bridge/file-handlers'
import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'

import { clearTauriMocks, installTauriMockWindow, mockTauriIPC } from '#tests/helpers/tauri-mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'navigator')
  Reflect.deleteProperty(globalThis, 'location')
})

describe('remaining Tauri integrations', () => {
  test('uses Tauri home directory for ACP transport cwd', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:path|resolve_directory')
      expect(args).toEqual({ directory: 21 })
      return '/Users/tester'
    })

    const transport = (await createACPTransport('acp:claude-code')) as ACPChatTransport & {
      cwd: string
    }

    expect(transport.cwd).toBe('/Users/tester')
  })

  test('creates parent directory for automation new-document paths in Tauri', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:fs|mkdir')
      expect(args).toEqual({ path: '/tmp/open-pencil/nested', options: { recursive: true } })
      return null
    })

    await ensureTauriParentDirectory('/tmp/open-pencil/nested/file.fig')
  })

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
      return new Response(JSON.stringify({ status: 'ok', token: 'server-token' }), { status: 200 })
    })

    let onEvent: ((event: unknown) => void) | null = null
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:shell|spawn') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 77
      }
      return null
    })

    const handle = await spawnMCPIfNeeded()
    onEvent?.({ event: 'Stderr', payload: [119, 97, 114, 110] })
    handle?.disconnect()
    await Promise.resolve()

    expect(handle?.authToken).toBe('server-token')
    expect(calls[0]?.cmd).toBe('plugin:shell|spawn')
    expect(calls[0]?.args).toMatchObject({
      program: 'openpencil-mcp-http',
      args: [],
      options: {
        env: {
          OPENPENCIL_MCP_AUTH_TOKEN: expect.any(String),
          OPENPENCIL_MCP_CORS_ORIGIN: 'tauri://localhost'
        }
      }
    })
    expect(calls.at(-1)).toEqual({ cmd: 'plugin:shell|kill', args: { cmd: 'killChild', pid: 77 } })
  })
})
