import type { ClientSideConnection, InitializeResponse, McpServer } from '@agentclientprotocol/sdk'

import { acpAgentFor } from '@open-pencil/core/constants'
import type { ACPAgentDef, ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import type { OwnToolsLink } from './tools'

/** What an agent session needs to open, whether it starts or continues a saved one. */
export interface AgentSessionRequest {
  cwd: string
  mcpServers: McpServer[]
  meta: OwnToolsLink['meta']
  /** The session a saved chat ran in, which the agent continues instead of starting anew. */
  resume: string | null
}

export interface OpenedAgentSession {
  sessionId: string
  model: string | null
  /** Whether the agent continued a saved session, which already holds the instructions. */
  resumed: boolean
}

type SessionConnection = Pick<ClientSideConnection, 'newSession' | 'unstable_resumeSession'>

/** ACP's `auth_required` error, which an agent returns for a session before sign-in. */
export function isAuthRequiredError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === -32000
}

/** The ACP agent a provider runs, when OpenPencil continues that agent's saved sessions. */
export function resumingAgent(providerID: AIProviderID): ACPAgentID | null {
  const agent = acpAgentFor(providerID)
  return agent?.resumesSessions ? agent.id : null
}

function canResume(agentDef: ACPAgentDef, initialized: InitializeResponse): boolean {
  return (
    agentDef.resumesSessions === true &&
    Boolean(initialized.agentCapabilities?.sessionCapabilities?.resume)
  )
}

function isMissingSession(error: unknown, agent: ACPAgentID): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  if (error.code === -32002) return true
  if (agent !== 'codex' || error.code !== -32603) return false

  // Codex can pass a missing rollout through as an internal error. The ACP SDK
  // puts the original message in data.details when it wraps that error.
  const message = 'message' in error ? error.message : undefined
  const data = 'data' in error ? error.data : undefined
  const details =
    typeof data === 'object' && data !== null && 'details' in data ? data.details : undefined
  return [message, details].some(
    (text) => typeof text === 'string' && text.includes('no rollout found for thread id')
  )
}

/** The agent cannot continue the saved session, which a new session would not know. */
export class AgentSessionResumeError extends Error {
  constructor(agentDef: ACPAgentDef, cause?: unknown) {
    super(
      `${agentDef.name} could not continue this conversation's session. Start a new chat to continue working.`,
      { cause }
    )
    this.name = 'AgentSessionResumeError'
  }
}

/**
 * Starts the agent's session, or continues the saved one through `session/resume`, which keeps
 * the agent's context without replaying the transcript the chat already shows.
 */
export async function openAgentSession(
  connection: SessionConnection,
  agentDef: ACPAgentDef,
  initialized: InitializeResponse,
  { cwd, mcpServers, meta, resume }: AgentSessionRequest
): Promise<OpenedAgentSession> {
  if (resume === null) {
    const result = await connection.newSession({ cwd, mcpServers, _meta: meta })
    return {
      sessionId: result.sessionId,
      model: result.models?.currentModelId ?? null,
      resumed: false
    }
  }
  // The agent no longer offers resume, as after a downgrade: a new session would lose the context.
  if (!canResume(agentDef, initialized)) throw new AgentSessionResumeError(agentDef)
  try {
    const result = await connection.unstable_resumeSession({
      sessionId: resume,
      cwd,
      mcpServers,
      _meta: meta
    })
    return { sessionId: resume, model: result.models?.currentModelId ?? null, resumed: true }
  } catch (e) {
    // Retire confirmed missing sessions; locks, connection failures, and sign-in can be retried.
    if (isMissingSession(e, agentDef.id)) throw new AgentSessionResumeError(agentDef, e)
    throw e
  }
}
