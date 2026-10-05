import { describe, expect, test, mock } from 'bun:test'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { createAgentDiscovery, detectedAgents } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import { createDeferred } from '@/app/runtime/deferred'

// Installed companions report the version of the app under test, as matching ones do.
const COMPANION_PACKAGES: Record<string, string> = {
  'openpencil-mcp-http': '@open-pencil/mcp',
  'openpencil-harness': '@open-pencil/harness'
}

function lookup(...commands: string[]): AgentLookup {
  return {
    searchPath: '/test/bin',
    versions: Object.fromEntries(
      commands.flatMap((command) => {
        const name = COMPANION_PACKAGES[command]
        return name ? [[name, '0.0.0']] : []
      })
    ),
    executables: Object.fromEntries(commands.map((command) => [command, `/test/bin/${command}`]))
  }
}

describe('local agent discovery', () => {
  test('installs the canvas companion once, discovers it, and restarts the bridge', async () => {
    let installed = false
    const pending = createDeferred<undefined>()
    const installBridge = mock(async () => {
      await pending.promise
      installed = true
    })
    const restartBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('gemini', 'npm', ...(installed ? ['openpencil-mcp-http'] : [])),
      install: async () => undefined,
      installBridge,
      restartBridge
    })
    await discovery.refresh()
    expect(installBridge).not.toHaveBeenCalled()
    const setup = discovery.setupCanvasBridge()
    await discovery.setupCanvasBridge()
    expect(installBridge).toHaveBeenCalledTimes(1)
    pending.resolve(undefined)
    await setup
    expect(discovery.canvasBridgeAvailable.value).toBe(true)
    expect(restartBridge).toHaveBeenCalledTimes(1)
    expect(discovery.error.value).toBeNull()
  })

  test('retries bridge startup without reinstalling a successfully installed companion', async () => {
    const installBridge = mock(async () => undefined)
    const restartBridge = mock(async (): Promise<void> => {
      throw new Error('Cannot start')
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('gemini', 'openpencil-mcp-http'),
      install: async () => undefined,
      installBridge,
      restartBridge
    })
    await discovery.refresh()
    await discovery.setupCanvasBridge()
    expect(discovery.error.value).toBe('canvas-start')
    restartBridge.mockImplementation(async () => undefined)
    await discovery.setupCanvasBridge()
    expect(installBridge).not.toHaveBeenCalled()
    expect(discovery.error.value).toBeNull()
  })
  test('distinguishes native CLIs, adapters, and absent agents without starting them', () => {
    const agents = detectedAgents(lookup('claude', 'codex-acp'))
    expect(agents.map((agent) => [agent.definition.id, agent.status])).toEqual([
      ['claude-code', 'needs-adapter'],
      ['codex', 'available'],
      ['gemini-cli', 'not-installed']
    ])
  })

  test('browser discovery performs no native operations', async () => {
    const scan = mock(async () => lookup('gemini'))
    const install = mock(async () => undefined)
    const discovery = createAgentDiscovery({ enabled: false, lookup: scan, install })
    await discovery.refresh()
    await discovery.install('claude-code')
    expect(scan).not.toHaveBeenCalled()
    expect(install).not.toHaveBeenCalled()
    expect(discovery.agents.value).toEqual([])
  })

  test('deduplicates concurrent scans and notices removals on refresh', async () => {
    const pending = createDeferred<AgentLookup>()
    const scan = mock(() => pending.promise)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: scan,
      install: async () => undefined
    })
    const first = discovery.refresh()
    const second = discovery.refresh()
    expect(scan).toHaveBeenCalledTimes(1)
    pending.resolve(lookup('gemini', 'codex-acp'))
    await Promise.all([first, second])
    expect(discovery.availableAgents.value).toHaveLength(2)
    scan.mockImplementation(async () => lookup())
    await discovery.refresh()
    expect(discovery.availableAgents.value).toHaveLength(0)
  })

  test('installs only on request, blocks duplicate installs, and rescans afterward', async () => {
    let installed = false
    const pending = createDeferred<undefined>()
    const install = mock(async (_agent: ACPAgentDef, _searchPath: string) => {
      await pending.promise
      installed = true
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('claude', 'npm', ...(installed ? ['claude-agent-acp'] : [])),
      install
    })
    await discovery.refresh()
    expect(install).not.toHaveBeenCalled()
    const operation = discovery.install('claude-code')
    await discovery.install('claude-code')
    expect(install).toHaveBeenCalledTimes(1)
    expect(install.mock.calls[0]).toEqual([
      expect.objectContaining({ adapterPackage: '@agentclientprotocol/claude-agent-acp' }),
      '/test/bin'
    ])
    pending.resolve(undefined)
    await operation
    expect(discovery.availableAgents.value[0]?.definition.id).toBe('claude-code')
    expect(discovery.installing.value).toBeNull()
    expect(discovery.error.value).toBeNull()
  })

  test('failed installation remains retryable and does not publish raw errors', async () => {
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('codex', 'npm'),
      install: async () => {
        throw new Error('private npm backend error')
      }
    })
    await discovery.refresh()
    await discovery.install('codex')
    expect(discovery.error.value).toBe('install')
    expect(discovery.installing.value).toBeNull()
    expect(discovery.availableAgents.value).toEqual([])
  })

  test('requires npm for adapter setup but not for native ACP agents', async () => {
    const install = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('claude', 'gemini'),
      install
    })
    await discovery.refresh()
    await discovery.install('claude-code')
    expect(discovery.error.value).toBe('npm')
    expect(install).not.toHaveBeenCalled()
    expect(discovery.availableAgents.value[0]?.definition.id).toBe('gemini-cli')
  })

  test('a failed scan preserves the last successful discovery and allows retry', async () => {
    const scan = mock(async () => lookup('gemini'))
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: scan,
      install: async () => undefined
    })
    await discovery.refresh()
    scan.mockImplementation(async () => {
      throw new Error('unavailable')
    })
    await discovery.refresh()
    expect(discovery.error.value).toBe('lookup')
    expect(discovery.scanning.value).toBe(false)
    expect(discovery.availableAgents.value[0]?.definition.id).toBe('gemini-cli')
    scan.mockImplementation(async () => lookup('gemini', 'codex-acp'))
    await discovery.refresh()
    expect(discovery.error.value).toBeNull()
    expect(discovery.availableAgents.value).toHaveLength(2)
  })
})

describe('Harness companion setup', () => {
  test('installs the companion once and rescans', async () => {
    let installed = false
    const installHarness = mock(async () => {
      installed = true
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('npm', ...(installed ? ['openpencil-harness'] : [])),
      install: async () => undefined,
      installHarness
    })
    await discovery.refresh()
    expect(discovery.harnessAvailable.value).toBe(false)
    await discovery.setupHarness()
    expect(installHarness).toHaveBeenCalledWith('/test/bin')
    expect(discovery.harnessAvailable.value).toBe(true)
    expect(discovery.error.value).toBeNull()
  })

  test('updates a companion whose version does not match the app', async () => {
    let version = '0.12.0'
    const installHarness = mock(async () => {
      version = '0.0.1'
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => ({
        ...lookup('npm', 'openpencil-harness'),
        versions: { '@open-pencil/harness': version }
      }),
      install: async () => undefined,
      installHarness
    })
    await discovery.refresh()
    expect(discovery.harnessOutdated.value).toBe(true)
    await discovery.setupHarness()
    expect(installHarness).toHaveBeenCalledTimes(1)
    expect(discovery.harnessOutdated.value).toBe(false)
    expect(discovery.error.value).toBeNull()
  })

  test('reports an update that left the old MCP server first on the path', async () => {
    const installBridge = mock(async () => undefined)
    const restartBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => ({
        searchPath: '/test/bin',
        executables: { npm: '/test/bin/npm', 'openpencil-mcp-http': '/home/me/.bun/bin/mcp' },
        versions: { '@open-pencil/mcp': '0.12.0' }
      }),
      install: async () => undefined,
      installBridge,
      restartBridge
    })
    await discovery.refresh()
    expect(discovery.canvasBridgeCommand.value).toStartWith('bun add -g @open-pencil/mcp@')
    await discovery.setupCanvasBridge()
    expect(installBridge).toHaveBeenCalledTimes(1)
    expect(restartBridge).not.toHaveBeenCalled()
    expect(discovery.error.value).toBe('canvas-install')
  })

  test('needs npm and reports a failed install without raw errors', async () => {
    const withoutNpm = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup(),
      install: async () => undefined,
      installHarness: async () => undefined
    })
    await withoutNpm.refresh()
    await withoutNpm.setupHarness()
    expect(withoutNpm.error.value).toBe('npm')
    const failing = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('npm'),
      install: async () => undefined,
      installHarness: async () => {
        throw new Error('private npm details')
      }
    })
    await failing.refresh()
    await failing.setupHarness()
    expect(failing.error.value).toBe('harness-install')
  })
})
