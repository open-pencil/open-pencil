import { afterEach, describe, expect, test, vi } from 'bun:test'

import { getAutomationAuthToken, spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'

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
  test('retains an early startup failure for MCP-dependent features', async () => {
    installTauriMockWindow()
    Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'Win32', userAgent: 'Windows' }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'mcp_executable_available') return true
      if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
      if (cmd === 'plugin:fs|exists') return false
      if (cmd === 'plugin:shell|spawn') {
        const onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent
          .onmessage
        queueMicrotask(() => {
          onEvent({
            event: 'Stderr',
            payload: Array.from(
              new TextEncoder().encode('El sistema no puede encontrar el archivo especificado.')
            )
          })
          onEvent({ event: 'Terminated', payload: { code: 1, signal: null } })
        })
        return 88
      }
      return null
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationAuthToken()).rejects.toThrow('MCP server exited before startup completed')
  })

  test('retains unexpected spawn errors for MCP-dependent features', async () => {
    installTauriMockWindow()
    Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'MacIntel', userAgent: 'Macintosh' }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockTauriIPC((cmd) => {
      if (cmd === 'mcp_executable_available') return true
      if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
      if (cmd === 'plugin:fs|exists') return false
      if (cmd === 'plugin:shell|spawn') throw new Error('shell permission denied')
      return null
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationAuthToken()).rejects.toThrow('shell permission denied')
  })

  test('retains a language-independent missing executable diagnostic', async () => {
    installTauriMockWindow()
    Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'MacIntel', userAgent: 'Macintosh' }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
      if (cmd === 'plugin:fs|exists') return false
      if (cmd === 'mcp_executable_available') return false
      return null
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationAuthToken()).rejects.toThrow('MCP automation is not installed')
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
      if (cmd === 'mcp_executable_available') return true
      if (cmd === 'plugin:shell|spawn') {
        expect(args).toMatchObject({
          program: 'openpencil-mcp-http',
          args: [],
          options: {
            env: {
              PORT: '7600',
              OPENPENCIL_MCP_AUTH_TOKEN: expect.any(String),
              OPENPENCIL_MCP_CORS_ORIGIN: 'tauri://localhost',
              OPENPENCIL_MCP_TCP: '1',
              OPENPENCIL_MCP_ROOT: '/mock/home',
              OPENPENCIL_MCP_APP_TIMEOUT_MS: '30000'
            }
          }
        })
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 77
      }
      const pathArg = (args as { path?: string })?.path
      if (cmd === 'plugin:fs|exists') {
        return pathArg === DISCOVERY_PATH
      }
      if (cmd === 'plugin:fs|read_text_file') {
        // Only return discovery data when reading the expected discovery path
        if (pathArg === DISCOVERY_PATH) return new TextEncoder().encode(DISCOVERY_JSON)
        return null
      }
      // Handle homeDir() IPC call from resolveTauriHomeDir
      if (cmd === 'plugin:path|resolve_directory') {
        return '/mock/home'
      }
      return null
    })

    const handle = await spawnMCPIfNeeded()
    await expect(getAutomationAuthToken()).resolves.toBe('discovery-token')
    onEvent?.({ event: 'Stderr', payload: [119, 97, 114, 110] })
    handle?.disconnect()
    await Promise.resolve()

    expect(handle?.authToken).toBe('discovery-token')
    expect(calls.some((c) => c.cmd === 'plugin:shell|spawn')).toBe(true)
    expect(
      calls.some(
        (c) =>
          c.cmd === 'plugin:fs|read_text_file' &&
          (c.args as { path?: string })?.path === DISCOVERY_PATH
      )
    ).toBe(true)
    expect(calls.at(-1)).toEqual({ cmd: 'plugin:shell|kill', args: { cmd: 'killChild', pid: 77 } })
  })
})
