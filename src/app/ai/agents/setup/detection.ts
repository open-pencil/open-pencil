import type { ACPAgentDef } from '@open-pencil/core/constants'

import { agentSetupView, type AgentSetupState, type PiSetupState } from './view'

/** What setup found of an agent on this computer, shown before the person picks it. */
export type AgentDetection =
  | { state: 'checking' }
  | { state: 'not-found' }
  /** Installed, or its CLI is, with no account to report. */
  | { state: 'found' }
  | { state: 'signed-out' }
  /** `account` joins the plan and email when the agent names them. */
  | { state: 'signed-in'; account: string | null }

function joined(parts: (string | null)[]): string | null {
  const present = parts.filter((part): part is string => part !== null)
  return present.length ? present.join(' · ') : null
}

export function codingAgentDetection(agent: ACPAgentDef, setup: AgentSetupState): AgentDetection {
  if (!setup.checked) return { state: 'checking' }
  const detected = setup.detected
  if (detected?.status === 'available') {
    const account = agentSetupView(agent, setup).account
    if (account?.state === 'checking') return { state: 'checking' }
    if (account?.state === 'signed-out') return { state: 'signed-out' }
    if (account?.state === 'signed-in') {
      return { state: 'signed-in', account: joined([account.label, account.detail]) }
    }
    return { state: 'found' }
  }
  return detected?.cliPath ? { state: 'found' } : { state: 'not-found' }
}

export function piDetection(setup: PiSetupState): AgentDetection {
  if (!setup.checked) return { state: 'checking' }
  // Pi signs in to providers, not one account, so there is no account to name.
  if (setup.signedIn) return { state: 'signed-in', account: null }
  return setup.companion ? { state: 'found' } : { state: 'not-found' }
}
