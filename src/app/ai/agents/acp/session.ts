import type { ClientSideConnection, InitializeResponse, McpServer } from '@agentclientprotocol/sdk'
import * as v from 'valibot'

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

/** A JSON-RPC error, which ACP can reject with as a decoded object instead of an `Error`. */
const acpErrorSchema = v.object({ code: v.number(), message: v.string() })
/** ACP's `auth_required` error, which an agent returns for a session before sign-in. */
const authRequiredSchema = v.object({ code: v.literal(-32000) })
/** ACP's `resource_not_found` error, for a session the agent no longer has. */
const resourceNotFoundSchema = v.object({ code: v.literal(-32002) })
/**
 * Codex reports a missing persisted thread as an internal error, and the ACP SDK moves the
 * original message to `data.details` when it wraps one.
 */
const noRolloutSchema = v.pipe(v.string(), v.includes('no rollout found for thread id'))
const codexMissingRolloutSchema = v.union([
  v.object({ code: v.literal(-32603), message: noRolloutSchema }),
  v.object({ code: v.literal(-32603), data: v.object({ details: noRolloutSchema }) })
])
/** `omp acp` reports a session it does not have as an internal error naming it in `data.details`. */
const ompMissingSessionSchema = v.object({
  code: v.literal(-32603),
  data: v.object({ details: v.pipe(v.string(), v.startsWith('ACP session not found:')) })
})

/** The message of an `Error` or of a decoded ACP error, or the value as text. */
export function acpErrorMessage(e: unknown): string {
  if (e instanceof Error || v.is(acpErrorSchema, e)) return e.message
  return String(e)
}

export function isAuthRequiredError(e: unknown): boolean {
  return v.is(authRequiredSchema, e)
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

/** Whether the agent confirms it no longer has the session; anything else may be retried. */
function isMissingSession(error: unknown, agent: ACPAgentID): boolean {
  if (v.is(resourceNotFoundSchema, error)) return true
  if (agent === 'codex') return v.is(codexMissingRolloutSchema, error)
  return agent === 'omp' && v.is(ompMissingSessionSchema, error)
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
 * The agent did not continue the saved session this time, as when another process still holds it.
 * The conversation keeps the session, so sending again or a new chat are both open.
 */
export class AgentSessionRetryError extends Error {
  constructor(agentDef: ACPAgentDef, cause: unknown) {
    super(
      `${agentDef.name} could not continue this conversation's session. Try again, or start a new chat. ${agentDef.name} reported: ${acpErrorMessage(cause)}`,
      { cause }
    )
    this.name = 'AgentSessionRetryError'
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
    // Retire confirmed missing sessions; sign-in keeps its own error, and anything else may pass.
    if (isMissingSession(e, agentDef.id)) throw new AgentSessionResumeError(agentDef, e)
    if (isAuthRequiredError(e)) throw e
    throw new AgentSessionRetryError(agentDef, e)
  }
}
