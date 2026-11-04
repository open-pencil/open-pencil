import { describe, expect, mock, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { ACP_AGENTS, type ACPAgentDef } from '@open-pencil/core/constants'

import { createAgentAccounts, type AgentAccount } from '@/app/ai/agents/setup/accounts'
import { createAgentDiscovery, type DetectedAgent } from '@/app/ai/agents/setup/discovery'
import type { AgentLookup } from '@/app/ai/agents/setup/native'
import {
  useAgentSetup,
  useCodingAgentSetup,
  useMCPServerSetup,
  usePiSetup
} from '@/app/ai/agents/setup/use'
import {
  agentSetupView,
  mcpServerSetupView,
  piSetupView,
  type AgentSetupState,
  type MCPServerSetupState,
  type PiSetupState
} from '@/app/ai/agents/setup/view'
import { MCP_INSTALL_COMMAND } from '@/app/automation/mcp/failure'

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

  test('reads the account of each installed agent and signs in to it', async () => {
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('npm', 'codex-acp', 'gemini'),
      install: async () => undefined
    })
    const check = mock(async (_agent: ACPAgentDef) => ({
      status: { kind: 'none' as const, label: 'Not logged in' },
      adapter: { name: '@agentclientprotocol/codex-acp', version: '2.2.2' },
      methods: [{ id: 'chat-gpt', name: 'ChatGPT' }],
      tools: null
    }))
    const signInWithAgent = mock(async () => null)
    const accounts = createAgentAccounts({
      enabled: true,
      check,
      signInWithAgent,
      startTerminalSignIn: async () => {
        throw new Error('Not expected')
      }
    })
    const agents = useAgentSetup(discovery, async () => null, accounts)
    await agents.refreshAgents()
    expect(check.mock.calls.map(([definition]) => definition.id)).toEqual(['codex'])
    expect(agentSetupView(agent('codex'), agents.agentSetup('acp:codex')).account).toMatchObject({
      state: 'signed-out',
      canSignIn: true
    })
    await agents.signInAgent('acp:claude-code')
    expect(signInWithAgent).not.toHaveBeenCalled()
    await agents.signInAgent('acp:codex')
    expect(signInWithAgent).toHaveBeenCalledTimes(1)
  })

  test('starts each agent once per session for the list, and one again on request', async () => {
    const { agents, check, lookups } = signedInAgents()
    await agents.checkOnce()
    await agents.checkOnce()
    expect(lookups()).toBe(1)
    expect(check.mock.calls.map(([definition]) => definition.id).sort()).toEqual([
      'claude-code',
      'codex'
    ])

    await agents.checkAgent('acp:codex')
    expect(lookups()).toBe(2)
    expect(check.mock.calls.map(([definition]) => definition.id).sort()).toEqual([
      'claude-code',
      'codex',
      'codex'
    ])
  })

  test('checks a coding agent whenever its model settings name it', async () => {
    const { agents, check, lookups } = signedInAgents()
    const providerID = ref('openrouter')
    const codingAgent = useCodingAgentSetup(providerID, agents)
    expect(codingAgent.agent.value).toBeUndefined()
    expect(lookups()).toBe(0)

    providerID.value = 'acp:claude-code'
    await nextTick()
    // Naming the agent starts the lookup on its own; the explicit check below only settles it.
    expect(lookups()).toBe(1)
    await agents.checkAgent('acp:claude-code')
    expect(codingAgent.agent.value?.id).toBe('claude-code')
    expect(codingAgent.state.value?.detected?.status).toBe('available')
    expect(check.mock.calls.every(([definition]) => definition.id === 'claude-code')).toBe(true)
  })
})

/** Codex and Claude Code installed, both signed in. */
function signedInAgents() {
  let lookupCount = 0
  const discovery = createAgentDiscovery({
    enabled: true,
    lookup: async () => {
      lookupCount++
      return lookup('npm', 'codex-acp', 'claude-agent-acp')
    },
    install: async () => undefined
  })
  const check = mock(async (_agent: ACPAgentDef) => ({
    status: { kind: 'account' as const, label: 'Plus' },
    adapter: null,
    methods: [],
    tools: { connected: true as const }
  }))
  const accounts = createAgentAccounts({
    enabled: true,
    check,
    signInWithAgent: async () => null,
    startTerminalSignIn: async () => {
      throw new Error('Not expected')
    }
  })
  return {
    agents: useAgentSetup(discovery, async () => null, accounts),
    check,
    lookups: () => lookupCount
  }
}

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

describe('agent account in setup', () => {
  const claude = agent('claude-code')
  const installed: DetectedAgent = {
    definition: claude,
    status: 'available',
    cliPath: null,
    adapterPath: '/test/bin/claude-agent-acp'
  }
  const ADAPTER = { name: '@agentclientprotocol/claude-agent-acp', version: '0.93.0' }
  const account = (overrides: Partial<AgentAccount> = {}): AgentAccount => ({
    checking: false,
    status: undefined,
    adapter: ADAPTER,
    canSignIn: true,
    signingIn: false,
    signInURL: null,
    acceptsCode: false,
    tools: null,
    error: null,
    ...overrides
  })

  test("shows whether a signed-in agent reached OpenPencil's tools", () => {
    const signedIn = { kind: 'account' as const, label: 'Claude Max' }
    const toolsOf = (overrides: Partial<AgentAccount>) =>
      agentSetupView(
        claude,
        agentState({ detected: installed, account: account({ status: signedIn, ...overrides }) })
      ).account?.tools
    expect(toolsOf({ tools: { connected: true } })).toEqual({ state: 'connected', reason: null })
    expect(toolsOf({ tools: { connected: false, reason: 'failed to start' } })).toEqual({
      state: 'unreachable',
      reason: 'failed to start'
    })
    expect(toolsOf({ checking: true })).toEqual({ state: 'checking', reason: null })
    // An older MCP server cannot tell, and a signed-out agent has no sessions to check.
    expect(toolsOf({ tools: { connected: null } })).toBeNull()
    expect(
      agentSetupView(
        claude,
        agentState({
          detected: installed,
          account: account({ status: { kind: 'none', label: 'Not logged in' } })
        })
      ).account?.tools
    ).toBeNull()
  })

  test('names the plan and email of a signed-in agent', () => {
    const view = agentSetupView(
      claude,
      agentState({
        detected: installed,
        account: account({
          status: { kind: 'account', label: 'Claude Max', account: { email: 'a@example.com' } }
        })
      })
    )
    expect(view.account).toMatchObject({
      state: 'signed-in',
      label: 'Claude Max',
      detail: 'a@example.com',
      canSignIn: false
    })
  })

  test('offers sign-in to a signed-out agent', () => {
    const view = agentSetupView(
      claude,
      agentState({
        detected: installed,
        account: account({ status: { kind: 'none', label: 'Not logged in' } })
      })
    )
    expect(view.account).toMatchObject({ state: 'signed-out', label: null, canSignIn: true })
  })

  test('shows nothing for an agent that does not report its login', () => {
    const view = agentSetupView(
      claude,
      agentState({ detected: installed, account: account({ status: null }) })
    )
    expect(view.account).toBeNull()
  })

  test('shows the check and the sign-in while they run', () => {
    const checking = agentSetupView(
      claude,
      agentState({ detected: installed, account: account({ checking: true }) })
    )
    expect(checking.account?.state).toBe('checking')
    const signingIn = agentSetupView(
      claude,
      agentState({
        detected: installed,
        account: account({
          status: { kind: 'none', label: 'Not logged in' },
          signingIn: true,
          signInURL: 'https://claude.com/sign-in',
          acceptsCode: true
        })
      })
    )
    expect(signingIn.account).toMatchObject({
      state: 'signing-in',
      signInURL: 'https://claude.com/sign-in',
      acceptsCode: true
    })
  })

  test('has no account before the adapter is installed', () => {
    const view = agentSetupView(
      claude,
      agentState({
        detected: { ...installed, status: 'needs-adapter', adapterPath: null },
        account: account({ status: { kind: 'none', label: 'Not logged in' } })
      })
    )
    expect(view.account).toBeNull()
  })

  test('flags another adapter under the same name and offers the supported one', () => {
    const view = agentSetupView(
      claude,
      agentState({
        detected: installed,
        account: account({ adapter: { name: 'claude-code-acp', version: '0.1.0' }, status: null })
      })
    )
    expect(view.adapterMismatch).toBe(true)
    expect(view.account).toBeNull()
    expect(view.manualAgentCommand).toBe(claude.installCommand ?? null)
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

function mcpServerState(overrides: Partial<MCPServerSetupState> = {}): MCPServerSetupState {
  return {
    supported: true,
    checked: true,
    bridge: false,
    bridgeOutdated: false,
    bridgeCommand: 'bun add -g @open-pencil/mcp@0.0.0-test',
    npm: true,
    installingBridge: false,
    error: null,
    ...overrides
  }
}

describe('mcpServerSetupView', () => {
  test('installs or updates the MCP server with one click when npm is available', () => {
    const missing = mcpServerSetupView(mcpServerState())
    expect(missing.bridge.action).toBe('install')
    expect(missing.manualCommand).toBeNull()
    expect(missing.problem).toBeNull()
    const outdated = mcpServerState({ bridge: true, bridgeOutdated: true })
    expect(mcpServerSetupView(outdated).bridge.action).toBe('update')
  })

  test('falls back to the command by hand without npm, after a check', () => {
    expect(mcpServerSetupView(mcpServerState({ npm: false, checked: false })).manualCommand).toBe(
      null
    )
    const view = mcpServerSetupView(mcpServerState({ npm: false }))
    expect(view.bridge.action).toBeNull()
    expect(view.problem).toBe('needs-npm')
    expect(view.manualCommand).toBe('bun add -g @open-pencil/mcp@0.0.0-test')
  })

  test('keeps the retry and adds the command by hand after a failed installation', () => {
    const view = mcpServerSetupView(mcpServerState({ error: 'canvas-install' }))
    expect(view.bridge.action).toBe('install')
    expect(view.problem).toBe('install-failed')
    expect(view.manualCommand).not.toBeNull()
  })

  test('offers the update one click can make with Bun, even without npm', () => {
    const view = mcpServerSetupView(
      mcpServerState({ bridge: true, bridgeOutdated: true, npm: false, bridgeInstallable: true })
    )
    expect(view.bridge.action).toBe('update')
    expect(view.problem).toBeNull()
    expect(view.manualCommand).toBeNull()
  })

  test('asks for administrator rights instead of a one-click install npm cannot finish', () => {
    const view = mcpServerSetupView(
      mcpServerState({ bridgeNeedsAdmin: true, bridgeCommand: 'sudo npm i -g x' })
    )
    expect(view.bridge.action).toBeNull()
    expect(view.problem).toBe('needs-admin')
    expect(view.manualCommand).toBe('sudo npm i -g x')
  })

  test('gives only the command where the app cannot install', () => {
    const view = mcpServerSetupView(mcpServerState({ supported: false }))
    expect(view.bridge.action).toBeNull()
    expect(view.manualCommand).toBe(MCP_INSTALL_COMMAND)
    // Nothing to install with, so no npm problem to report.
    expect(view.problem).toBeNull()
  })
})

describe('useMCPServerSetup', () => {
  test('checks while active, then installs and restarts the server with one click', async () => {
    let installed = false
    const installBridge = mock(async () => {
      installed = true
    })
    const restartBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async (): Promise<AgentLookup> => ({
        ...lookup('npm', ...(installed ? ['openpencil-mcp-http'] : [])),
        versions: installed ? { '@open-pencil/mcp': '0.0.0-test' } : {}
      }),
      install: async () => undefined,
      installBridge,
      restartBridge
    })
    const active = ref(false)
    const server = useMCPServerSetup(active, discovery)
    expect(server.state.value.checked).toBe(false)

    active.value = true
    await nextTick()
    await discovery.refresh()
    expect(mcpServerSetupView(server.state.value).bridge.action).toBe('install')

    await server.install()
    expect(installBridge).toHaveBeenCalledTimes(1)
    expect(restartBridge).toHaveBeenCalledTimes(1)
    expect(mcpServerSetupView(server.state.value).bridge.ready).toBe(true)
  })
})
