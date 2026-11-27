import { afterEach, describe, expect, test, vi } from 'bun:test'

import { fetchStub } from '@open-pencil/test-support/fetch'

import { getMCPClientToken } from '@/app/automation/mcp/client-token'
import { getAutomationHealthFailure } from '@/app/automation/mcp/health'
import {
  getAutomationAuthToken,
  getAutomationStartupFailure,
  readAutomationHealth,
  spawnMCPIfNeeded
} from '@/app/automation/mcp/spawn'

import {
  clearTauriMocks,
  installTauriMockWindow,
  mockHost,
  mockTauriIPC
} from '#tests/helpers/tauri/mocks'

const DISCOVERY_PATH = '/mock/home/.openpencil/mcp.json'
/** The tokens the desktop app makes for the server it runs (`mcp_tokens`). */
const DESKTOP_TOKENS = { appToken: 'app-token', clientToken: 'client-token' }
const MCP_LOOKUP = {
  available: true,
  path: '/mock/bin/openpencil-mcp-http',
  searched: ['/mock/bin']
}

function installDesktop(platform: string, userAgent = platform) {
  installTauriMockWindow()
  Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { platform, userAgent }
  })
}

/** A desktop package that may not start host programs, so it only finds a server the user runs. */
function forbidHostProcesses() {
  Object.defineProperty(globalThis.window, '__OPENPENCIL_DESKTOP_CAPABILITIES__', {
    configurable: true,
    value: { selfUpdate: false, hostProcesses: false }
  })
}

/** Answers the commands a desktop MCP launch makes besides the host's own. */
function desktopLaunch(tokens: unknown = DESKTOP_TOKENS) {
  return (cmd: string) => {
    if (cmd === 'mcp_lookup') return MCP_LOOKUP
    if (cmd === 'mcp_tokens') return tokens
    if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
    if (cmd === 'plugin:fs|exists') return false
    return null
  }
}

function healthyResponse() {
  return Response.json({
    status: 'ok',
    version: '0.0.0-test',
    authRequired: true,
    discoveryPath: DISCOVERY_PATH,
    clientTokens: true
  })
}

function bearer(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('authorization')
}

afterEach(async () => {
  if ('window' in globalThis) {
    Reflect.deleteProperty(globalThis.window, '__OPENPENCIL_DESKTOP_CAPABILITIES__')
  }
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'navigator')
  Reflect.deleteProperty(globalThis, 'location')
})

describe('MCP health probe diagnostics', () => {
  test('records a rejected token separately from an unreachable server', async () => {
    installTauriMockWindow()
    const reject = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 401 }))

    await expect(readAutomationHealth('stale-token')).resolves.toBeNull()
    expect(getAutomationHealthFailure()).toEqual({ code: 'rejected', detail: 'HTTP 401' })

    reject.mockResolvedValue(new Response('', { status: 500 }))
    await expect(readAutomationHealth('stale-token')).resolves.toBeNull()
    expect(getAutomationHealthFailure()).toEqual({ code: 'malformed', detail: 'HTTP 500' })

    reject.mockRejectedValue(new Error('connection refused'))
    await expect(readAutomationHealth('stale-token')).resolves.toBeNull()
    expect(getAutomationHealthFailure()).toEqual({
      code: 'unreachable',
      detail: expect.any(String)
    })
  })

  test('records an unexpected health payload and clears the failure on success', async () => {
    installTauriMockWindow()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }))

    await expect(readAutomationHealth()).resolves.toBeNull()
    expect(getAutomationHealthFailure()).toEqual({ code: 'malformed', detail: 'HTTP 200' })

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', version: '0.0.0-test' }), { status: 200 })
    )
    await expect(readAutomationHealth()).resolves.toMatchObject({ status: 'ok' })
    expect(getAutomationHealthFailure()).toBeNull()
  })
})

describe('Tauri MCP spawning', () => {
  test('retains an early startup failure for MCP-dependent features', async () => {
    installDesktop('Win32', 'Windows')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockHost({
      onStart: ({ emit }) =>
        queueMicrotask(() => {
          emit({ type: 'stderr', data: 'El sistema no puede encontrar el archivo especificado.' })
          emit({ type: 'close', code: 1, signal: null })
        }),
      otherwise: desktopLaunch()
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationAuthToken()).rejects.toThrow('MCP server exited before startup completed')
    expect(getAutomationStartupFailure()).toMatchObject({
      code: 'exited',
      detail: expect.stringContaining('code=')
    })
  })

  test('retains unexpected spawn errors for MCP-dependent features', async () => {
    installDesktop('MacIntel', 'Macintosh')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockHost({
      onStart: () => {
        throw new Error('host permission denied')
      },
      otherwise: desktopLaunch()
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationAuthToken()).rejects.toThrow('host permission denied')
    expect(getAutomationStartupFailure()).toMatchObject({ code: 'permission-denied' })
  })

  test('retains a language-independent missing executable diagnostic', async () => {
    installDesktop('MacIntel', 'Macintosh')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
      if (cmd === 'plugin:fs|exists') return false
      if (cmd === 'mcp_lookup')
        return { available: false, path: null, searched: ['/usr/local/bin', '/mock/home/.bun/bin'] }
      return null
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationAuthToken()).rejects.toThrow('MCP automation is not installed')
    expect(getAutomationStartupFailure()).toMatchObject({
      code: 'not-installed',
      // The searched directories let a report show where the app looked.
      detail: expect.stringContaining('/mock/home/.bun/bin')
    })
  })

  test('reports an older running server as outdated with the install command for this app', async () => {
    installDesktop('MacIntel', 'Macintosh')
    forbidHostProcesses()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async () =>
        Response.json({
          status: 'ok',
          version: '0.15.1',
          installCommand: 'npm i -g @open-pencil/mcp@0.15.1'
        })
      )
    )
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
      if (cmd === 'plugin:fs|exists') return true
      return null
    })

    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationStartupFailure()).toEqual({ code: 'outdated', detail: '0.15.1' })
    // The old server names its own version; the fix must name this app's.
    const error = await getAutomationAuthToken().catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain('npm i -g @open-pencil/mcp@0.0.0-test')
    expect(String(error)).not.toContain('@open-pencil/mcp@0.15.1')
  })

  test('reports a server of the same minor without client tokens as outdated', async () => {
    installDesktop('MacIntel', 'Macintosh')
    forbidHostProcesses()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async () => Response.json({ status: 'ok', version: '0.0.0-beta.1' }))
    )
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:path|resolve_directory') return '/mock/home'
      if (cmd === 'plugin:fs|exists') return true
      return null
    })

    // Its /mcp would refuse the client token agents get, so the user is told to update it.
    expect(await spawnMCPIfNeeded()).toBeNull()
    expect(getAutomationStartupFailure()).toEqual({ code: 'outdated', detail: '0.0.0-beta.1' })
    const error = await getAutomationAuthToken().catch((reason: unknown) => reason)
    expect(String(error)).toContain('npm i -g @open-pencil/mcp@0.0.0-test')
  })

  test('starts the MCP server through the desktop app and uses the tokens it hands over', async () => {
    installDesktop('MacIntel')
    const healthTokens: Array<string | null> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async (_input, init) => {
        healthTokens.push(bearer(init))
        if (healthTokens.length === 1) return new Response('', { status: 404 })
        return healthyResponse()
      })
    )
    const host = await mockHost({ otherwise: desktopLaunch() })

    const handle = await spawnMCPIfNeeded({ earlyExitMs: 5, healthPollMs: 5 })

    // The editor asks for the server alone; the desktop app makes its tokens.
    expect(host.started.map((start) => start.program)).toEqual([
      {
        kind: 'mcpServer',
        tokenlessClients: expect.any(Boolean),
        root: '/mock/home',
        disabledTools: expect.any(Array),
        scope: expect.stringMatching(/^(document|selection)$/)
      }
    ])
    // Health is read with the client token, never the server's own.
    expect(healthTokens).toEqual(['Bearer client-token', 'Bearer client-token'])
    // The app token registers the editor, and agents connect with the client token.
    expect(handle?.authToken).toBe('app-token')
    expect(handle?.managed).toBe(true)
    await expect(getAutomationAuthToken()).resolves.toBe('app-token')
    await expect(getMCPClientToken()).resolves.toBe('client-token')
    // The discovery file of a server the desktop app runs holds its own token; it is not read.
    expect(host.calls.some((call) => call.cmd === 'plugin:fs|read_text_file')).toBe(false)

    host.emit({ type: 'stderr', data: 'warn' })
    await handle?.disconnect()
    expect(host.calls.at(-1)).toEqual({ cmd: 'host_kill', args: { id: 1 } })
  })

  test('stops the server and reports a failure when the desktop app hands over no tokens', async () => {
    installDesktop('MacIntel')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(fetchStub(async () => healthyResponse()))
    const host = await mockHost({ otherwise: desktopLaunch(null) })

    expect(await spawnMCPIfNeeded({ earlyExitMs: 5, healthPollMs: 5 })).toBeNull()

    expect(host.calls).toContainEqual({ cmd: 'host_kill', args: { id: 1 } })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getAutomationStartupFailure()).toMatchObject({ code: 'unknown' })
  })

  test('keeps waiting for a server that is slow to answer while its child runs', async () => {
    installDesktop('Win32', 'Windows')
    let healthChecks = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async () => {
        healthChecks += 1
        // Slower than the five fixed tries the app used to allow.
        if (healthChecks <= 9) return new Response('', { status: 404 })
        return healthyResponse()
      })
    )
    await mockHost({ otherwise: desktopLaunch() })

    const handle = await spawnMCPIfNeeded({
      earlyExitMs: 5,
      healthPollMs: 5,
      healthDeadlineMs: 5000
    })
    expect(handle?.managed).toBe(true)
    expect(healthChecks).toBeGreaterThan(9)
    await handle?.disconnect()
  })

  test('reports a child that exits while the app waits as exited, not as a timeout', async () => {
    installDesktop('MacIntel', 'Macintosh')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await mockHost({
      // Past the early-exit window, before the deadline.
      onStart: ({ emit }) => setTimeout(() => emit({ type: 'close', code: 3, signal: null }), 40),
      otherwise: desktopLaunch()
    })

    const handle = await spawnMCPIfNeeded({
      earlyExitMs: 5,
      healthPollMs: 5,
      healthDeadlineMs: 5000
    })
    expect(handle).toBeNull()
    expect(getAutomationStartupFailure()).toMatchObject({
      code: 'exited',
      detail: expect.stringContaining('code=3')
    })
  })
})
