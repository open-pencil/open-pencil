import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { MCP_INSTALL_COMMAND } from '@/app/ai/acp/setup-prompt'
import { readPiAccount } from '@/app/ai/harness/pi-settings'

import { agentDiscovery, type DetectedAgent, type DiscoveryError } from './discovery'

type AgentDiscovery = typeof agentDiscovery

/** What setup knows about one coding agent and the MCP server it needs. */
export interface AgentSetupState {
  /** False where agents cannot run, so only manual instructions apply. */
  supported: boolean
  /** A check has finished, so a later one keeps showing its results. */
  checked: boolean
  scanning: boolean
  detected: DetectedAgent | null
  /** OpenPencil's MCP server, through which agents reach the canvas. */
  bridge: boolean
  /** The installed MCP server does not match this app's version. */
  bridgeOutdated: boolean
  /** Installs or updates the MCP server by hand. */
  bridgeCommand: string
  /** npm, which one-click installation runs. */
  npm: boolean
  installingAgent: boolean
  installingBridge: boolean
  error: DiscoveryError | null
}

/** What setup knows about Pi: the Harness companion that runs it and Pi's own settings. */
export interface PiSetupState {
  supported: boolean
  checked: boolean
  scanning: boolean
  /** The `openpencil-harness` companion that runs Pi. */
  companion: boolean
  companionOutdated: boolean
  companionCommand: string
  bridge: boolean
  bridgeOutdated: boolean
  bridgeCommand: string
  npm: boolean
  installingCompanion: boolean
  installingBridge: boolean
  /** The default model set in Pi, used unless OpenPencil names another. */
  defaultModel: string | null
  error: DiscoveryError | null
}

/** An OpenPencil companion as setup presents it, with the one-click fix that applies. */
export interface CompanionCheck {
  /** Installed and matching this app. */
  ready: boolean
  outdated: boolean
  installing: boolean
  /** Absent once ready, and without npm, which one-click installation runs. */
  action: 'install' | 'update' | null
}

/** Why setup cannot finish on its own, in the order the person should address it. */
export type SetupProblem = 'needs-npm' | 'install-failed' | 'mcp-start-failed' | 'lookup-failed'

function companionCheck(
  installed: boolean,
  outdated: boolean,
  installing: boolean,
  npm: boolean
): CompanionCheck {
  const ready = installed && !outdated
  if (ready || !npm) return { ready, outdated, installing, action: null }
  return { ready, outdated, installing, action: outdated ? 'update' : 'install' }
}

function setupProblem(
  error: DiscoveryError | null,
  needsNpm: boolean,
  installErrors: readonly DiscoveryError[]
): SetupProblem | null {
  if (error === 'npm' || needsNpm) return 'needs-npm'
  if (error !== null && installErrors.includes(error)) return 'install-failed'
  if (error === 'canvas-start') return 'mcp-start-failed'
  if (error === 'lookup') return 'lookup-failed'
  return null
}

/** A coding agent's setup: its CLI and adapter, the MCP server, and what to run by hand. */
export interface AgentSetupView {
  bridge: CompanionCheck
  /** The adapter can be installed with one click. */
  canInstallAdapter: boolean
  busy: boolean
  problem: SetupProblem | null
  /** Commands for where one-click installation cannot help. */
  manualAgentCommand: string | null
  manualBridgeCommand: string | null
}

export function agentSetupView(agent: ACPAgentDef, setup: AgentSetupState): AgentSetupView {
  const bridge = companionCheck(
    setup.bridge,
    setup.bridgeOutdated,
    setup.installingBridge,
    setup.npm
  )
  const status = setup.detected?.status
  const needsNpm =
    !setup.npm && (status === 'needs-adapter' || (setup.detected !== null && !bridge.ready))
  let manualAgentCommand: string | null = null
  if (agent.installCommand && status !== 'available') {
    const oneClick = setup.supported && setup.npm && setup.error !== 'install'
    manualAgentCommand = oneClick && agent.adapterPackage ? null : agent.installCommand
  }
  let manualBridgeCommand: string | null = null
  if (!setup.supported) manualBridgeCommand = MCP_INSTALL_COMMAND
  else if (!bridge.ready && (!setup.npm || setup.error === 'canvas-install')) {
    manualBridgeCommand = setup.bridgeCommand
  }
  return {
    bridge,
    canInstallAdapter: status === 'needs-adapter' && setup.npm,
    busy: setup.installingAgent || setup.installingBridge,
    problem: setupProblem(setup.error, needsNpm, ['install', 'canvas-install']),
    manualAgentCommand,
    manualBridgeCommand
  }
}

/** Pi's setup: the Harness companion, the MCP server, and what to run by hand. */
export interface PiSetupView {
  companion: CompanionCheck
  bridge: CompanionCheck
  busy: boolean
  problem: SetupProblem | null
  manualCommands: string[]
}

export function piSetupView(setup: PiSetupState): PiSetupView {
  const companion = companionCheck(
    setup.companion,
    setup.companionOutdated,
    setup.installingCompanion,
    setup.npm
  )
  const bridge = companionCheck(
    setup.bridge,
    setup.bridgeOutdated,
    setup.installingBridge,
    setup.npm
  )
  const missing = !companion.ready || !bridge.ready
  const manual = !setup.npm || setup.error === 'harness-install' || setup.error === 'canvas-install'
  return {
    companion,
    bridge,
    busy: setup.installingCompanion || setup.installingBridge,
    problem: setupProblem(setup.error, setup.checked && !setup.npm && missing, [
      'harness-install',
      'canvas-install'
    ]),
    manualCommands: manual
      ? [
          ...(companion.ready ? [] : [setup.companionCommand]),
          ...(bridge.ready ? [] : [setup.bridgeCommand])
        ]
      : []
  }
}

/** Setup state of the coding agents and Pi, for guided setup and model settings. */
export function useAgentSetup(
  discovery: AgentDiscovery = agentDiscovery,
  readPi: typeof readPiAccount = readPiAccount
) {
  const piDefaultModel = ref<string | null>(null)
  const readingPi = ref(false)

  function agentID(providerID: string) {
    return providerID.startsWith('acp:') ? providerID.slice('acp:'.length) : null
  }

  function agentSetup(providerID: string): AgentSetupState {
    const id = agentID(providerID)
    return {
      supported: discovery.supported,
      checked: discovery.checked.value,
      scanning: discovery.scanning.value,
      detected: discovery.agents.value.find((agent) => agent.definition.id === id) ?? null,
      bridge: discovery.canvasBridgeAvailable.value,
      bridgeOutdated: discovery.canvasBridgeOutdated.value,
      bridgeCommand: discovery.canvasBridgeCommand.value,
      npm: discovery.npmAvailable.value,
      installingAgent: discovery.installing.value === id,
      installingBridge: discovery.installing.value === 'canvas',
      error: discovery.error.value
    }
  }

  function piSetup(providerID: string): PiSetupState | undefined {
    if (providerID !== 'harness:pi') return undefined
    return {
      supported: discovery.supported,
      checked: discovery.checked.value,
      scanning: discovery.scanning.value || readingPi.value,
      companion: discovery.harnessAvailable.value,
      companionOutdated: discovery.harnessOutdated.value,
      companionCommand: discovery.harnessCommand.value,
      bridge: discovery.canvasBridgeAvailable.value,
      bridgeOutdated: discovery.canvasBridgeOutdated.value,
      bridgeCommand: discovery.canvasBridgeCommand.value,
      npm: discovery.npmAvailable.value,
      installingCompanion: discovery.installing.value === 'harness',
      installingBridge: discovery.installing.value === 'canvas',
      defaultModel: piDefaultModel.value,
      error: discovery.error.value
    }
  }

  function installAgent(providerID: string): Promise<void> {
    if (providerID === 'harness:pi') return discovery.setupHarness()
    const detected = agentSetup(providerID).detected
    return detected ? discovery.install(detected.definition.id) : Promise.resolve()
  }

  async function refreshAgents(): Promise<void> {
    if (!discovery.supported) return
    readingPi.value = true
    try {
      const [, account] = await Promise.all([discovery.refresh(true), readPi().catch(() => null)])
      piDefaultModel.value = account?.defaultModel ?? null
    } finally {
      readingPi.value = false
    }
  }

  return {
    agentSetup,
    piSetup,
    installAgent,
    refreshAgents,
    setupCanvasBridge: () => discovery.setupCanvasBridge()
  }
}

/**
 * Pi's setup while `active`, checked each time it becomes active. Undefined outside the desktop
 * app, where Pi cannot run and there is nothing to check.
 */
export function usePiSetup(active: MaybeRefOrGetter<boolean>, setup = useAgentSetup()) {
  const state = computed(() => {
    const pi = toValue(active) ? setup.piSetup('harness:pi') : undefined
    return pi?.supported ? pi : undefined
  })
  watch(
    () => toValue(active),
    (on) => {
      if (on) void setup.refreshAgents()
    },
    { immediate: true }
  )
  return {
    state,
    refresh: setup.refreshAgents,
    installCompanion: () => setup.installAgent('harness:pi'),
    installBridge: setup.setupCanvasBridge
  }
}
