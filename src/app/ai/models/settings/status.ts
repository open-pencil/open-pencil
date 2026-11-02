import type { Ref } from 'vue'

import { ACP_AGENTS, HARNESS_PROVIDER_ID } from '@open-pencil/core/constants'

import {
  codingAgentDetection,
  piDetection,
  type AgentDetection
} from '@/app/ai/agents/setup/detection'
import { useAgentSetup } from '@/app/ai/agents/setup/use'
import { agentSetupView } from '@/app/ai/agents/setup/view'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import { cloudAIAvailable } from '@/app/cloud/integration'
import type { CredentialStatus } from '@/app/settings/credentials/types'

/** How a model's connection stands, in one vocabulary for keys, sign-ins, and agents. */
export type ModelConnectionState =
  | 'connected'
  | 'needs-credential'
  | 'unavailable'
  | 'checking'
  | 'not-installed'
  /** Installed, for an agent that reports no login to check. */
  | 'installed'
  | 'signed-out'
  /** Signed in, but a session did not reach OpenPencil's tools. */
  | 'tools-unreachable'
  /** An agent seen outside the desktop app, where it cannot run. */
  | 'agent'

export interface ModelConnectionInput {
  providerID: string
  credential: CredentialStatus | undefined
  /** What setup found of a coding agent or Pi; null for other providers and outside the desktop app. */
  agent: AgentDetection | null
  toolsUnreachable: boolean
  /** Whether the Home server offers Cloud's AI service to someone signed in there. */
  cloudAI?: boolean
}

function isAgentProvider(providerID: string): boolean {
  return providerID.startsWith('acp:') || providerID === HARNESS_PROVIDER_ID
}

export function modelConnectionState({
  providerID,
  credential,
  agent,
  toolsUnreachable,
  cloudAI = false
}: ModelConnectionInput): ModelConnectionState {
  // Cloud's AI service signs in with the Home server, not a saved key.
  if (providerID === OPENPENCIL_AI_PROVIDER) return cloudAI ? 'connected' : 'unavailable'
  // Pi uses its own sign-ins unless an AI Gateway key is saved.
  if (credential === 'configured' && !providerID.startsWith('acp:')) return 'connected'
  if (isAgentProvider(providerID)) {
    if (!agent) return 'agent'
    switch (agent.state) {
      case 'checking':
        return 'checking'
      case 'not-found':
        return 'not-installed'
      // Pi is found once its companion is installed, and signed in once it has a provider login.
      case 'found':
        return providerID === HARNESS_PROVIDER_ID ? 'signed-out' : 'installed'
      case 'signed-out':
        return 'signed-out'
      case 'signed-in':
        return toolsUnreachable ? 'tools-unreachable' : 'connected'
    }
  }
  if (credential === 'locked' || credential === 'unavailable') return 'unavailable'
  // Not read yet: saying the key is missing before knowing would flash a wrong state.
  if (credential === undefined) return 'checking'
  return 'needs-credential'
}

/**
 * Connection states for the model list. Opening it fills in only what this session has not
 * checked, since checking an agent starts it.
 */
export function useModelConnectionStates(
  credentials: Ref<Record<string, CredentialStatus>>,
  setup = useAgentSetup()
) {
  void setup.checkOnce()

  function agentState(
    providerID: string
  ): Pick<ModelConnectionInput, 'agent' | 'toolsUnreachable'> {
    const none = { agent: null, toolsUnreachable: false }
    if (providerID === HARNESS_PROVIDER_ID) {
      const pi = setup.piSetup(providerID)
      return pi?.supported ? { agent: piDetection(pi), toolsUnreachable: false } : none
    }
    const definition = ACP_AGENTS.find((agent) => `acp:${agent.id}` === providerID)
    const agent = definition && setup.agentSetup(providerID)
    if (!definition || !agent?.supported) return none
    return {
      agent: codingAgentDetection(definition, agent),
      toolsUnreachable: agentSetupView(definition, agent).account?.tools?.state === 'unreachable'
    }
  }

  function connectionState(connectionId: string, providerID: string): ModelConnectionState {
    return modelConnectionState({
      providerID,
      credential: credentials.value[connectionId],
      cloudAI: cloudAIAvailable.value,
      ...agentState(providerID)
    })
  }

  return { connectionState, refresh: setup.checkOnce }
}
