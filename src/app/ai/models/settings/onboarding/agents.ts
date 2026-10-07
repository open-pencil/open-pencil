import { ref } from 'vue'

import { agentDiscovery, type DetectedAgent } from '@/app/ai/agents/discovery'
import { readPiAccount } from '@/app/ai/harness/pi-settings'

import type { OnboardingAccess } from './plan'

type AgentDiscovery = typeof agentDiscovery

/** What guided setup knows about one coding agent and the MCP server it needs. */
export interface AgentSetupState {
  /** False where agents cannot run, so only manual instructions apply. */
  supported: boolean
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
  error: AgentDiscovery['error']['value']
}

/** What guided setup knows about Pi: the Harness companion that runs it and Pi's own settings. */
export interface PiSetupState {
  supported: boolean
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
  error: AgentDiscovery['error']['value']
}

/** Coding agent setup in guided setup, backed by the desktop agent discovery. */
export function useOnboardingAgents(
  discovery: AgentDiscovery = agentDiscovery,
  readPi: typeof readPiAccount = readPiAccount
) {
  const piDefaultModel = ref<string | null>(null)
  const readingPi = ref(false)

  function agentID(providerID: OnboardingAccess) {
    return providerID.startsWith('acp:') ? providerID.slice('acp:'.length) : null
  }

  function agentSetup(providerID: OnboardingAccess): AgentSetupState {
    const id = agentID(providerID)
    return {
      supported: discovery.supported,
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

  function piSetup(providerID: OnboardingAccess): PiSetupState | undefined {
    if (providerID !== 'harness:pi') return undefined
    return {
      supported: discovery.supported,
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

  function installAgent(providerID: OnboardingAccess): Promise<void> {
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
