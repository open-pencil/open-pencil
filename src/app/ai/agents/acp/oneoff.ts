import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type { NewSessionResponse, SessionUpdate } from '@agentclientprotocol/sdk'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { agentModels, chooseAgentModel, type AgentModels } from '@/app/ai/agents/acp/models'
import { spawnACPProcess } from '@/app/ai/agents/acp/process'
import { boundAgentStart } from '@/app/ai/agents/acp/startup'
import { resolveSpawnTarget } from '@/app/ai/agents/setup/discovery'
import { agentWorkspace } from '@/app/ai/agents/setup/native'

/** What starting an agent reaches outside this module, which tests replace. */
export interface OneOffStartup {
  resolveTarget: typeof resolveSpawnTarget
  spawn: typeof spawnACPProcess
  workspace: typeof agentWorkspace
}

const DEFAULT_STARTUP: OneOffStartup = {
  resolveTarget: resolveSpawnTarget,
  spawn: spawnACPProcess,
  workspace: agentWorkspace
}

export interface OneOffAgentOptions {
  /** The model the session switches to; empty keeps the agent's own. */
  model?: string
  /** Stopping ends the agent, whether it is starting or answering. */
  signal?: AbortSignal
  /** Receives what the session sends while it works. */
  onUpdate?: (update: SessionUpdate) => void
  startup?: OneOffStartup
  startTimeoutMs?: number
}

/** An agent started for one job, with a session of its own that has no OpenPencil tools. */
export interface OneOffAgentSession {
  connection: ClientSideConnection
  /** Whether the agent takes images in a prompt. */
  imageInput: boolean
  /** The session the agent opened, with the models it offers. */
  opened: NewSessionResponse
  /**
   * The request's answer, unless the agent exits or `signal` stops it first. The SDK leaves
   * requests pending when the agent's process exits, so a request that waits on one needs this.
   */
  untilStopped<T>(request: Promise<T>): Promise<T>
  /** Stops the agent. */
  close(): Promise<void>
}

/**
 * Starts an agent in the folder set aside for agents and opens a session without MCP servers, for
 * work that needs no OpenPencil tools. Each startup request must answer within the deadline, and
 * a failed step stops the agent. The caller closes the session.
 */
export async function startAgentSession(
  agent: ACPAgentDef,
  {
    model = '',
    signal,
    onUpdate,
    startup = DEFAULT_STARTUP,
    startTimeoutMs
  }: OneOffAgentOptions = {}
): Promise<OneOffAgentSession> {
  const { bounded, stoppedByUser, launch } = boundAgentStart(agent, {
    signal,
    timeoutMs: startTimeoutMs,
    stopMessage: 'The request was stopped.'
  })
  let closing = false
  const { child, input, output, cwd } = await launch(
    () => Promise.all([startup.resolveTarget(agent), startup.workspace()]),
    async ([{ command, searchPath }, folder]) => ({
      ...(await startup.spawn({
        command,
        args: agent.args,
        logId: `${agent.id} one-off`,
        searchPath,
        cwd: folder,
        destroying: () => closing,
        onUnexpectedClose: () => undefined
      })),
      cwd: folder
    })
  )
  const close = async () => {
    closing = true
    await child.kill().catch(() => undefined)
  }

  const connection = new ClientSideConnection(
    () => ({
      // Nothing here may run on its own, so nothing may ask for permission.
      requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
      sessionUpdate: async ({ update }) => onUpdate?.(update),
      extNotification: async () => undefined
    }),
    ndJsonStream(input, output)
  )
  const stopped = connection.closed.then((): never => {
    throw new Error(`${agent.name} stopped.`)
  })
  stopped.catch(() => undefined)

  try {
    const initialized = await bounded(
      connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} }),
      stopped
    )
    const opened = await bounded(connection.newSession({ cwd, mcpServers: [] }), stopped)
    if (model) {
      await bounded(chooseAgentModel(connection, agent, opened.sessionId, opened, model), stopped)
    }
    return {
      connection,
      imageInput: initialized.agentCapabilities?.promptCapabilities?.image === true,
      opened,
      untilStopped: (request) => Promise.race([request, stopped, stoppedByUser]),
      close
    }
  } catch (e) {
    await close()
    throw e
  }
}

/** The models an agent offers, and whether it accepts images in a prompt. */
export interface AgentModelList {
  /** Null when the agent offers no choice of model. */
  models: AgentModels | null
  imageInput: boolean
}

/** Starts the agent once to read what it offers, then stops it. */
export async function readAgentModels(
  agent: ACPAgentDef,
  options: OneOffAgentOptions = {}
): Promise<AgentModelList> {
  const session = await startAgentSession(agent, options)
  try {
    return { models: agentModels(session.opened), imageInput: session.imageInput }
  } finally {
    await session.close()
  }
}
