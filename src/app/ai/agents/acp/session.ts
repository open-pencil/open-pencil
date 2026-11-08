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
const noRollout = v.pipe(v.string(), v.includes('no rollout found for thread id'))
const codexMissingRolloutSchema = v.union([
  v.object({ code: v.literal(-32603), message: noRollout }),
  v.object({ code: v.literal(-32603), data: v.object({ details: noRollout }) })
])

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
  return agent === 'codex' && v.is(codexMissingRolloutSchema, error)
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
