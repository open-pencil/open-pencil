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
  AGENT_CHOICE_CATEGORIES,
  chooseSessionOption,
  sessionChoice,
  sessionChoices,
  sessionOptionRequests,
  type AgentChoiceCategory,
  type AgentChoices,
  type OfferedSessionOptions,
  type SessionChoices,
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
  /** The effort, mode, and other options the session is put on; absent ones keep the agent's. */
  choices?: AgentChoices
}

export interface OpenedAgentSession {
  sessionId: string
  model: string | null
  /** What the session offers to choose besides its model, on that model, and what it runs on. */
  choices: SessionChoices
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

const CHOICE_NAMES: Record<AgentChoiceCategory, string> = {
  thought_level: "this model's effort",
  mode: 'its mode',
  collaboration_mode: 'its collaboration mode'
}

/** The session offers no option of a category, so it cannot run the value a profile names. */
export class AgentOptionChoiceError extends Error {
  constructor(agentDef: ACPAgentDef, category: AgentChoiceCategory) {
    super(`${agentDef.name} does not let OpenPencil choose ${CHOICE_NAMES[category]}.`)
    this.name = 'AgentOptionChoiceError'
  }
}

/** What the chat wants a session to run on; empty ones keep the agent's own. */
interface WantedSettings {
  model: string
  choices: AgentChoices
}

/**
 * The model, effort, and mode a session runs on: the ones the chat names, which the session is
 * put on, or else the agent's own. A resumed session starts on the agent's defaults again,
 * whatever it ran before, so all are set each time. The model goes first, since each model offers
 * its own efforts. An agent that offers no choice fails the start rather than answer on a model,
 * effort, or mode the chat did not name.
 */
async function startingSettings(
  connection: SessionRequests,
  agentDef: ACPAgentDef,
  sessionId: string,
  offered: OfferedSessionOptions,
  wanted: WantedSettings
): Promise<Pick<OpenedAgentSession, 'model' | 'choices'>> {
  let current = offered
  if (wanted.model) {
    const chosen = await chooseSessionOption(connection, sessionId, current, 'model', wanted.model)
    if (!chosen) throw new AgentModelChoiceError(agentDef)
    current = chosen
  }
  for (const category of AGENT_CHOICE_CATEGORIES) {
    const value = wanted.choices[category]
    if (!value) continue
    const chosen = await chooseSessionOption(connection, sessionId, current, category, value)
    if (!chosen) throw new AgentOptionChoiceError(agentDef, category)
    current = chosen
  }
  return { model: wanted.model || sessionModel(offered), choices: sessionChoices(current) }
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

export function isMissingCommandError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('program not found')
}

function missingCommandMessage(agentDef?: ACPAgentDef): string {
  if (!agentDef) return 'ACP agent CLI is not installed.'
  if (!agentDef.installCommand) {
    return `"${agentDef.command}" is not installed. Install it and restart OpenPencil.`
  }
  return `"${agentDef.command}" is not installed. Install it with: ${agentDef.installCommand}`
}

export function formatConnectionError(e: unknown, agentDef?: ACPAgentDef): string {
  const msg = acpErrorMessage(e)
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch')
  ) {
    return 'MCP server is not running. Make sure the editor is open.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
    return 'MCP server did not respond in time.'
  }
  if (isMissingCommandError(msg)) {
    return missingCommandMessage(agentDef)
  }
  if (isAuthRequiredError(e)) {
    return `${agentDef?.name ?? 'The agent'} is not signed in. Sign in from Set up AI, then try again.`
  }
  return msg
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
 * session is then put on the model, effort, and mode the chat names.
 */
export async function openAgentSession(
  connection: SessionRequests,
  agentDef: ACPAgentDef,
  initialized: InitializeResponse,
  { cwd, mcpServers, meta, resume, model = '', choices = {} }: AgentSessionRequest
): Promise<OpenedAgentSession> {
  if (resume === null) {
    const result = await connection.newSession({ cwd, mcpServers, _meta: meta })
    return {
      sessionId: result.sessionId,
      ...(await startingSettings(connection, agentDef, result.sessionId, result, {
        model,
        choices
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
    ...(await startingSettings(connection, agentDef, resume, result, { model, choices })),
    resumed: true
  }
}
