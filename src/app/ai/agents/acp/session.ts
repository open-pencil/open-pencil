import {
  methods,
  type ClientContext,
  type InitializeResponse,
  type McpServer,
  type NewSessionRequest,
  type NewSessionResponse,
  type ResumeSessionRequest,
  type ResumeSessionResponse
} from '@agentclientprotocol/sdk/unstable'
import * as v from 'valibot'

import { acpAgentFor } from '@open-pencil/core/constants'
import type { ACPAgentDef, ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import {
  chooseSessionOption,
  sessionChoice,
  sessionOptionRequests,
  type OfferedSessionOptions,
  type SessionChoice,
  type SessionOptionRequests
} from './options'
import type { OwnToolsLink } from './tools'

/** What an agent session needs to open, whether it starts or continues a saved one. */
export interface AgentSessionRequest {
  cwd: string
  mcpServers: McpServer[]
  meta: OwnToolsLink['meta']
  /** The session a saved chat ran in, which the agent continues instead of starting anew. */
  resume: string | null
  /** The model the chat's profile names, which the session is put on; empty keeps the agent's. */
  model?: string
  /** The effort the session is put on, one the model offers; empty keeps the agent's. */
  effort?: string
}

export interface OpenedAgentSession {
  sessionId: string
  model: string | null
  /** The efforts the session's model offers and the one it runs on; null when it offers none. */
  effort: SessionChoice | null
  /** Whether the agent continued a saved session, which already holds the instructions. */
  resumed: boolean
}

/** The agent requests that open a session, which tests make without a connection. */
export interface SessionRequests extends SessionOptionRequests {
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>
  resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse>
}

/** The session requests of a connection to the agent. */
export function sessionRequests(agent: ClientContext): SessionRequests {
  return {
    newSession: (params) => agent.request(methods.agent.session.new, params),
    resumeSession: (params) => agent.request(methods.agent.session.resume, params),
    ...sessionOptionRequests(agent)
  }
}

/**
 * The `models` that ACP dropped from its schema and agents may still send; the SDK passes a
 * response through as the agent sent it.
 */
const legacyModelSchema = v.object({ models: v.object({ currentModelId: v.string() }) })

/** The model a session starts with: the legacy `models` as before, else its model option. */
function sessionModel(response: OfferedSessionOptions): string | null {
  const legacy = v.safeParse(legacyModelSchema, response)
  if (legacy.success) return legacy.output.models.currentModelId
  return sessionChoice(response, 'model')?.current ?? null
}

/** The agent offers no choice of model, so a session cannot run the one a profile names. */
export class AgentModelChoiceError extends Error {
  constructor(agentDef: ACPAgentDef) {
    super(`${agentDef.name} does not let OpenPencil choose its model.`)
    this.name = 'AgentModelChoiceError'
  }
}

/** The session's model offers no choice of effort, so it cannot run the one a profile names. */
export class AgentEffortChoiceError extends Error {
  constructor(agentDef: ACPAgentDef) {
    super(`${agentDef.name} does not let OpenPencil choose this model's effort.`)
    this.name = 'AgentEffortChoiceError'
  }
}

/** What the chat wants a session to run on; empty values keep the agent's own. */
interface WantedSettings {
  model: string
  effort: string
}

/**
 * The model and effort a session runs on: the ones the chat names, which the session is put on,
 * or else the agent's own. A resumed session starts on the agent's default again, whatever it ran
 * before, so both are set each time. The model goes first, since each model offers its own
 * efforts. An agent that offers no choice fails the start rather than answer on a model or effort
 * the chat did not name.
 */
async function startingSettings(
  connection: SessionRequests,
  agentDef: ACPAgentDef,
  sessionId: string,
  offered: OfferedSessionOptions,
  wanted: WantedSettings
): Promise<Pick<OpenedAgentSession, 'model' | 'effort'>> {
  let current = offered
  if (wanted.model) {
    const chosen = await chooseSessionOption(connection, sessionId, current, 'model', wanted.model)
    if (!chosen) throw new AgentModelChoiceError(agentDef)
    current = chosen
  }
  if (wanted.effort) {
    const chosen = await chooseSessionOption(
      connection,
      sessionId,
      current,
      'thought_level',
      wanted.effort
    )
    if (!chosen) throw new AgentEffortChoiceError(agentDef)
    current = chosen
  }
  return {
    model: wanted.model || sessionModel(offered),
    effort: sessionChoice(current, 'thought_level')
  }
}

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
 * the agent's context without replaying the transcript the chat already shows. Either way the
 * session is then put on the model and effort the chat names.
 */
export async function openAgentSession(
  connection: SessionRequests,
  agentDef: ACPAgentDef,
  initialized: InitializeResponse,
  { cwd, mcpServers, meta, resume, model = '', effort = '' }: AgentSessionRequest
): Promise<OpenedAgentSession> {
  if (resume === null) {
    const result = await connection.newSession({ cwd, mcpServers, _meta: meta })
    return {
      sessionId: result.sessionId,
      ...(await startingSettings(connection, agentDef, result.sessionId, result, {
        model,
        effort
      })),
      resumed: false
    }
  }
  // The agent no longer offers resume, as after a downgrade: a new session would lose the context.
  if (!canResume(agentDef, initialized)) throw new AgentSessionResumeError(agentDef)
  let result: ResumeSessionResponse
  try {
    result = await connection.resumeSession({ sessionId: resume, cwd, mcpServers, _meta: meta })
  } catch (e) {
    // Retire confirmed missing sessions; sign-in keeps its own error, and anything else may pass.
    if (isMissingSession(e, agentDef.id)) throw new AgentSessionResumeError(agentDef, e)
    if (isAuthRequiredError(e)) throw e
    throw new AgentSessionRetryError(agentDef, e)
  }
  return {
    sessionId: resume,
    ...(await startingSettings(connection, agentDef, resume, result, { model, effort })),
    resumed: true
  }
}
