import type { ACPAgentDef } from '@open-pencil/core/constants'

import {
  aiModelSettings,
  modelConnectionCredentialStatus,
  resolveAIModelRole,
  resolveModelConnectionAPIKey
} from '@/app/ai/models'
import type { AIModelConnection } from '@/app/ai/models/types'

/** The connection whose saved key this agent should start with. */
export function connectionForAgentKey(agent: ACPAgentDef): AIModelConnection | null {
  if (!agent.apiKey) return null
  const providerID = `acp:${agent.id}` as const
  const design = resolveAIModelRole('design')?.connection
  if (design?.providerID === providerID) return design
  return (
    aiModelSettings.value.connections.find((connection) => connection.providerID === providerID) ??
    null
  )
}

/**
 * Environment for one agent process. A saved user key is the only addition, and only for an
 * agent that asks for one. Anything else keeps the process environment as it is.
 *
 * A missing key, or a store that cannot say whether one exists, leaves the environment alone so
 * the agent's own login still starts. A key that is saved is read, and a failed read stays visible.
 */
export async function agentProcessEnv(agent: ACPAgentDef): Promise<Record<string, string>> {
  const apiKey = agent.apiKey
  const connection = connectionForAgentKey(agent)
  if (!apiKey || !connection) return {}
  const status = await modelConnectionCredentialStatus(connection.id).catch(
    (): 'unavailable' => 'unavailable'
  )
  if (status !== 'configured') return {}
  const value = await resolveModelConnectionAPIKey(connection.id)
  return value ? { [apiKey.env]: value } : {}
}
