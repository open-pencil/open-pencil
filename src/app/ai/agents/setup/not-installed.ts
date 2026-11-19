import type { ACPAgentDef } from '@open-pencil/core/constants'

/** The executable lookup found none of the agent's command names, so startup must not launch a shell. */
export class AgentNotInstalledError extends Error {
  constructor(readonly agent: ACPAgentDef) {
    super(`${agent.name} is not installed.`)
    this.name = 'AgentNotInstalledError'
  }
}
