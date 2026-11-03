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
    if (isAuthRequiredError(e)) throw e
    throw new AgentSessionResumeError(agentDef, e)
  }
}
