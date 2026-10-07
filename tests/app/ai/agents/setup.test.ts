import { describe, expect, mock, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { ACP_AGENTS, type ACPAgentDef } from '@open-pencil/core/constants'

import { createAgentDiscovery, type DetectedAgent } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import {
  agentSetupView,
  piSetupView,
  useAgentSetup,
  usePiSetup,
  type AgentSetupState,
  type PiSetupState
} from '@/app/ai/agents/setup'

function lookup(...commands: string[]): AgentLookup {
  return {
    searchPath: '/test/bin',
    versions: {},
    executables: Object.fromEntries(commands.map((command) => [command, `/test/bin/${command}`]))
  }
}

describe('useAgentSetup', () => {
  test('installs the Harness companion for Pi and reads Pi’s default model', async () => {
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
    const agents = useAgentSetup(discovery, async () => ({
      agentDir: '/home/test/.pi/agent',
      defaultModel: 'openai-codex/gpt-5.6',
      signedIn: true
    }))
    await agents.refreshAgents()
    expect(agents.piSetup('harness:pi')).toMatchObject({
      companion: false,
      npm: true,
      defaultModel: 'openai-codex/gpt-5.6'
    })
    await agents.installAgent('harness:pi')
    expect(installHarness).toHaveBeenCalledTimes(1)
    expect(agents.piSetup('harness:pi')?.companion).toBe(true)
    expect(agents.piSetup('acp:codex')).toBeUndefined()
  })
})

function agent(id: string): ACPAgentDef {
  const definition = ACP_AGENTS.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Unknown agent ${id}`)
  return definition
}

function agentState(overrides: Partial<AgentSetupState> = {}): AgentSetupState {
  return {
    supported: true,
    checked: true,
    scanning: false,
    detected: null,
    bridge: true,
    bridgeOutdated: false,
    bridgeCommand: 'npm i -g @open-pencil/mcp@1.0.0',
    npm: true,
    installingAgent: false,
    installingBridge: false,
    error: null,
    ...overrides
  }
}

function piState(overrides: Partial<PiSetupState> = {}): PiSetupState {
  return {
    supported: true,
    checked: true,
    scanning: false,
    companion: true,
    companionOutdated: false,
    companionCommand: 'npm i -g @open-pencil/harness@1.0.0',
    bridge: true,
    bridgeOutdated: false,
    bridgeCommand: 'npm i -g @open-pencil/mcp@1.0.0',
    npm: true,
    installingCompanion: false,
    installingBridge: false,
    defaultModel: null,
    error: null,
    ...overrides
  }
}

describe('agentSetupView', () => {
  const claude = agent('claude-code')
  const needsAdapter: DetectedAgent = {
    definition: claude,
    status: 'needs-adapter',
    cliPath: '/test/bin/claude',
    adapterPath: null
  }

  test('installs the adapter and updates an outdated MCP server with one click', () => {
    const view = agentSetupView(
      claude,
      agentState({ detected: needsAdapter, bridgeOutdated: true })
    )
    expect(view.canInstallAdapter).toBe(true)
    expect(view.bridge).toMatchObject({ ready: false, action: 'update' })
    expect(view.manualAgentCommand).toBeNull()
    expect(view.manualBridgeCommand).toBeNull()
  })

  test('falls back to commands by hand without npm', () => {
    const view = agentSetupView(
      claude,
      agentState({ detected: needsAdapter, bridge: false, npm: false })
    )
    expect(view.canInstallAdapter).toBe(false)
    expect(view.bridge.action).toBeNull()
    expect(view.problem).toBe('needs-npm')
    expect(view.manualAgentCommand).toBe(claude.installCommand ?? null)
    expect(view.manualBridgeCommand).toBe('npm i -g @open-pencil/mcp@1.0.0')
  })

  test('offers the command of an agent without an adapter package to install by hand', () => {
    const gemini = agent('gemini-cli')
    const view = agentSetupView(
      gemini,
      agentState({
        detected: { definition: gemini, status: 'not-installed', cliPath: null, adapterPath: null }
      })
    )
    expect(view.manualAgentCommand).toBe(gemini.installCommand ?? null)
  })

  test('shows the commands after a failed installation', () => {
    const view = agentSetupView(
      claude,
      agentState({ detected: needsAdapter, bridge: false, error: 'canvas-install' })
    )
    expect(view.problem).toBe('install-failed')
    expect(view.manualBridgeCommand).toBe('npm i -g @open-pencil/mcp@1.0.0')
  })

  test('gives only instructions where agents cannot run', () => {
    const view = agentSetupView(claude, agentState({ supported: false, bridge: false }))
    expect(view.manualAgentCommand).toBe(claude.installCommand ?? null)
    expect(view.manualBridgeCommand).toMatch(/@open-pencil\/mcp/)
  })
})

describe('piSetupView', () => {
  test('is ready with a matching companion and MCP server', () => {
    const view = piSetupView(piState())
    expect(view.companion).toMatchObject({ ready: true, action: null })
    expect(view.problem).toBeNull()
    expect(view.manualCommands).toEqual([])
  })

  test('asks for npm and lists the missing commands only after a check', () => {
    const missing = { companion: false, npm: false }
    expect(piSetupView(piState({ ...missing, checked: false })).problem).toBeNull()
    const view = piSetupView(piState(missing))
    expect(view.problem).toBe('needs-npm')
    expect(view.manualCommands).toEqual(['npm i -g @open-pencil/harness@1.0.0'])
  })

  test('reports a failed companion installation, which the agent panel ignores', () => {
    const failed = { error: 'harness-install' as const }
    expect(piSetupView(piState({ ...failed, companion: false })).problem).toBe('install-failed')
    expect(agentSetupView(agent('codex'), agentState(failed)).problem).toBeNull()
  })
})

describe('usePiSetup', () => {
  test('checks Pi each time the editor switches to it', async () => {
    const scan = mock(async () => lookup('npm', 'openpencil-harness'))
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: scan,
      install: async () => undefined
    })
    const active = ref(false)
    const pi = usePiSetup(
      active,
      useAgentSetup(discovery, async () => null)
    )
    expect(pi.state.value).toBeUndefined()
    expect(scan).not.toHaveBeenCalled()

    active.value = true
    await nextTick()
    expect(scan).toHaveBeenCalledTimes(1)
    await scan.mock.results[0]?.value
    await nextTick()
    expect(pi.state.value?.companion).toBe(true)
  })

  test('has nothing to check outside the desktop app', () => {
    const discovery = createAgentDiscovery({
      enabled: false,
      lookup: async () => lookup(),
      install: async () => undefined
    })
    expect(
      usePiSetup(
        true,
        useAgentSetup(discovery, async () => null)
      ).state.value
    ).toBeUndefined()
  })
})
