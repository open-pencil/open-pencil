import {
  methods,
  PROTOCOL_VERSION,
  type InitializeResponse,
  type SessionNotification
} from '@agentclientprotocol/sdk/unstable'
import { fromUint8Array } from 'js-base64'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import {
  connectAgent,
  type AgentConnection,
  type AgentLaunch
} from '@/app/ai/agents/acp/connection'
import {
  agentModelChoices,
  chooseSessionOption,
  sessionChoice,
  sessionOptionRequests,
  type AgentModelChoices,
  type OfferedSessionOptions,
  type SessionOptionValue
} from '@/app/ai/agents/acp/options'
import { acpErrorMessage, AgentModelChoiceError } from '@/app/ai/agents/acp/session'
import { agentWorkspace } from '@/app/ai/agents/setup/native'

export interface OneOffAgentOptions {
  /** Stopping ends the agent, whether it is starting or answering. */
  signal?: AbortSignal
  /** How long each request may take, the prompt included. */
  timeoutMs?: number
  launch?: AgentLaunch
  /** The folder set aside for agents, where the agent runs. */
  workspace?: () => Promise<string>
}

interface OneOffAgent {
  connection: AgentConnection
  initialized: InitializeResponse
  cwd: string
}

/**
 * Starts an agent for one job in the folder set aside for agents. It gets none of OpenPencil's
 * tools and every permission request is refused; what the agent does without asking is its own
 * setting. The caller closes it.
 */
async function startOneOffAgent(
  agentDef: ACPAgentDef,
  { signal, timeoutMs, launch, workspace = agentWorkspace }: OneOffAgentOptions,
  onSessionUpdate?: (params: SessionNotification) => void
): Promise<OneOffAgent> {
  const cwd = await workspace()
  const connection = await connectAgent(agentDef, {
    logId: `${agentDef.id} one-off`,
    cwd,
    signal,
    timeoutMs,
    launch,
    onSessionUpdate
  })
  try {
    const initialized = await connection.bounded(
      connection.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {}
      })
    )
    return { connection, initialized, cwd }
  } catch (e) {
    await connection.close()
    throw e
  }
}

/** ACP rejects with a decoded error object, which callers that show a failure cannot read. */
function agentFailure(agentDef: ACPAgentDef, e: unknown): Error {
  if (e instanceof Error) return e
  return new Error(`${agentDef.name} reported: ${acpErrorMessage(e)}`, { cause: e })
}

/** What an agent offers a profile: the models to choose from, and whether it takes images. */
export interface AgentOffer {
  /** Empty when the agent offers no choice of model. */
  models: SessionOptionValue[]
  imageInput: boolean
  /**
   * The effort, mode, and other choices of the models read so far, by model ID; `''` is the
   * agent's own pick. Each model has its own efforts, and reading them all would switch through
   * dozens of models, so a model's choices are read when a profile chooses it.
   */
  choices: Record<string, AgentModelChoices>
}

function takesImages(initialized: InitializeResponse): boolean {
  return initialized.agentCapabilities?.promptCapabilities?.image === true
}

/**
 * Starts the agent once to read what it offers, then stops it. An agent that answers
 * `session/options` says what a session would start with; any other opens a session to say it.
 */
export async function readAgentOffer(
  agentDef: ACPAgentDef,
  options: OneOffAgentOptions = {}
): Promise<AgentOffer> {
  const { connection, initialized, cwd } = await startOneOffAgent(agentDef, options)
  try {
    const offered = await connection.bounded(
      initialized.agentCapabilities?.sessionCapabilities?.options
        ? connection.agent.request(methods.agent.session.options, { cwd })
        : connection.agent.request(methods.agent.session.new, { cwd, mcpServers: [] })
    )
    const model = sessionChoice(offered, 'model')
    const choices = agentModelChoices(offered)
    return {
      models: model?.values ?? [],
      imageInput: takesImages(initialized),
      choices: { '': choices, ...(model && { [model.current]: choices }) }
    }
  } catch (e) {
    throw agentFailure(agentDef, e)
  } finally {
    await connection.close()
  }
}

/**
 * Opens a session of the one-off agent on `model`, or on the agent's own pick when it is empty,
 * and says what the session offers on it.
 */
async function openOneOffSession(
  agentDef: ACPAgentDef,
  { connection, cwd }: OneOffAgent,
  model: string,
  onSession?: (sessionId: string) => void
): Promise<{ sessionId: string; offered: OfferedSessionOptions }> {
  const opened = await connection.bounded(
    connection.agent.request(methods.agent.session.new, { cwd, mcpServers: [] })
  )
  onSession?.(opened.sessionId)
  if (!model) return { sessionId: opened.sessionId, offered: opened }
  const chosen = await connection.bounded(
    chooseSessionOption(
      sessionOptionRequests(connection.agent),
      opened.sessionId,
      opened,
      'model',
      model
    )
  )
  if (!chosen) throw new AgentModelChoiceError(agentDef)
  return { sessionId: opened.sessionId, offered: chosen }
}

/** Starts the agent once to read the choices one of its models offers, then stops it. */
export async function readAgentChoices(
  agentDef: ACPAgentDef,
  model: string,
  options: OneOffAgentOptions = {}
): Promise<AgentModelChoices> {
  const agent = await startOneOffAgent(agentDef, options)
  try {
    const { offered } = await openOneOffSession(agentDef, agent, model)
    return agentModelChoices(offered)
  } catch (e) {
    throw agentFailure(agentDef, e)
  } finally {
    await agent.connection.close()
  }
}

/** One question for an agent: text and images in, text out. */
export interface AgentQuestion extends OneOffAgentOptions {
  text: string
  images?: ReadonlyArray<{ mediaType: string; data: Uint8Array }>
  /** The model the session is put on; empty keeps the agent's own. */
  model?: string
}

/** The agent takes no images, so it cannot be asked about any. */
export class AgentImageInputError extends Error {
  constructor(agentDef: ACPAgentDef) {
    super(`${agentDef.name} does not accept images.`)
    this.name = 'AgentImageInputError'
  }
}

/**
 * What an agent answers to one question, from a session of its own that has none of OpenPencil's
 * tools. The agent is stopped once it answered, and also when it exits, `signal` stops it, or it
 * does not answer in time, so nothing is left waiting on it.
 */
export async function askAgent(
  agentDef: ACPAgentDef,
  { text, images = [], model = '', ...options }: AgentQuestion
): Promise<string> {
  let sessionId: string | null = null
  let answer = ''
  const agent = await startOneOffAgent(agentDef, options, ({ sessionId: from, update }) => {
    // Only the session's own message is the answer; a subagent's is its working.
    if (from !== sessionId) return
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      answer += update.content.text
    }
  })
  const { connection } = agent
  try {
    if (images.length > 0 && !takesImages(agent.initialized)) {
      throw new AgentImageInputError(agentDef)
    }
    const opened = await openOneOffSession(agentDef, agent, model, (id) => {
      sessionId = id
    })
    await connection.bounded(
      connection.agent.request(methods.agent.session.prompt, {
        sessionId: opened.sessionId,
        prompt: [
          ...images.map(({ mediaType, data }) => ({
            type: 'image' as const,
            data: fromUint8Array(data),
            mimeType: mediaType
          })),
          { type: 'text' as const, text }
        ]
      })
    )
    const said = answer.trim()
    if (!said) throw new Error(`${agentDef.name} gave no answer.`)
    return said
  } catch (e) {
    throw agentFailure(agentDef, e)
  } finally {
    await connection.close()
  }
}
