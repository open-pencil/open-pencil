import { agentDiscovery } from './discovery'

/** What an agent chat needs before it can start, each fixed by guided setup. */
export type AgentSetupProblem =
  | 'companion-missing'
  | 'companion-outdated'
  | 'mcp-outdated'
  | 'pi-sign-in'
  | 'pi-model'

/** A chat that cannot start until setup is finished; the chat names the fix. */
export class AgentSetupError extends Error {
  constructor(readonly problem: AgentSetupProblem) {
    super(`Agent setup is incomplete: ${problem}`)
    this.name = 'AgentSetupError'
  }
}

type AgentDiscovery = Pick<
  typeof agentDiscovery,
  | 'supported'
  | 'refresh'
  | 'error'
  | 'harnessAvailable'
  | 'harnessOutdated'
  | 'canvasBridgeOutdated'
>

/**
 * Checks the companions an agent chat starts, so a missing or mismatched one fails with a fix
 * instead of an opaque process error. A failed lookup does not block the chat.
 */
export async function assertAgentReady(
  agent: 'acp' | 'pi',
  discovery: AgentDiscovery = agentDiscovery
): Promise<void> {
  if (!discovery.supported) return
  await discovery.refresh(true)
  if (discovery.error.value === 'lookup') return
  if (agent === 'pi' && !discovery.harnessAvailable.value) {
    throw new AgentSetupError('companion-missing')
  }
  if (agent === 'pi' && discovery.harnessOutdated.value) {
    throw new AgentSetupError('companion-outdated')
  }
  if (discovery.canvasBridgeOutdated.value) throw new AgentSetupError('mcp-outdated')
}
