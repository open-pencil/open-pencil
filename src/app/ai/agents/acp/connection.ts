import {
  client,
  methods,
  ndJsonStream,
  type ClientContext,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification
} from '@agentclientprotocol/sdk/unstable'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import {
  AUTH_STATUS_UPDATE_METHOD,
  parseAuthStatusUpdate,
  type AgentAuthStatus
} from '@/app/ai/agents/acp/auth/status'
import { spawnACPProcess, type ACPProcess } from '@/app/ai/agents/acp/process'
import { resolveSpawnTarget } from '@/app/ai/agents/setup/discovery'
import { createDeferred } from '@/app/runtime/deferred'

/**
 * How long an agent may take to answer one request while it starts; resuming starts the agent's
 * CLI, which is slowest.
 */
export const AGENT_START_TIMEOUT_MS = 60_000

/**
 * The request's answer, unless one of `also` fails first or it takes longer than `timeoutMs`,
 * which rejects with `timedOut`. The timer is cleared once the race settles, so an answer that
 * comes in time leaves nothing pending.
 */
export async function withinDeadline<T>(
  request: Promise<T>,
  timeoutMs: number,
  timedOut: string,
  ...also: Promise<never>[]
): Promise<T> {
  const deadline = createDeferred<never>()
  const timer = setTimeout(() => deadline.reject(new Error(timedOut)), timeoutMs)
  try {
    return await Promise.race([request, ...also, deadline.promise])
  } finally {
    clearTimeout(timer)
  }
}

/** What starting an agent's process reaches outside the app, which tests replace. */
export interface AgentLaunch {
  resolveTarget: typeof resolveSpawnTarget
  spawn: typeof spawnACPProcess
}

export const HOST_AGENT_LAUNCH: AgentLaunch = {
  resolveTarget: resolveSpawnTarget,
  spawn: spawnACPProcess
}

export interface AgentConnectionOptions {
  /** Names the process in the log. */
  logId?: string
  /** The folder the agent runs in; left out, wherever the app runs. */
  cwd?: string
  /** Stopping ends whatever waits on the agent, and an agent that is still starting. */
  signal?: AbortSignal
  /** How long each bounded request may take. */
  timeoutMs?: number
  /** What a stop rejects with. */
  stopMessage?: string
  launch?: AgentLaunch
  /** True once the owner stops the agent itself, so its exit is not reported as unexpected. */
  stopping?: () => boolean
  /** Told when the agent exits without having been stopped. */
  onExit?: () => void
  /** Told the process once it runs, so its owner can stop an agent that is still starting. */
  onProcess?: (child: ACPProcess['child']) => void
  /**
   * Answers the agent's permission requests. Left out, every request is refused, for a connection
   * in which nothing may run on its own.
   */
  requestPermission?: (
    params: RequestPermissionRequest
  ) => RequestPermissionResponse | Promise<RequestPermissionResponse>
  /** What the agent reports about its sessions. */
  onSessionUpdate?: (params: SessionNotification) => void
  /** The login the agent reports, as Claude Code's and Codex's adapters do after they start. */
  onAuthStatus?: (status: AgentAuthStatus) => void
}

/** A started agent and the connection to it, before any session. */
export interface AgentConnection {
  /** Sends the agent requests and notifications. */
  agent: ClientContext
  child: ACPProcess['child']
  /**
   * The request's answer, unless the agent exits or `signal` stops it first. The SDK leaves a
   * request pending when the agent's process exits, so every request waits through this.
   */
  untilStopped<T>(request: Promise<T>): Promise<T>
  /** As `untilStopped`, and the request must also answer within the deadline. */
  bounded<T>(request: Promise<T>, timeoutMs?: number): Promise<T>
  /** Stops the agent. */
  close(): Promise<void>
}

/**
 * Finds the agent, starts its process, and connects to it: the one way OpenPencil starts an ACP
 * agent, for a chat, a sign-in check, or one job. Finding and starting must finish within the
 * deadline and stop with `signal`; a process that starts after that is killed. The caller sends
 * `initialize` and whatever follows through `bounded` or `untilStopped`, and closes the agent.
 */
export async function connectAgent(
  agentDef: ACPAgentDef,
  {
    logId = agentDef.id,
    cwd,
    signal,
    timeoutMs = AGENT_START_TIMEOUT_MS,
    stopMessage = 'The request was stopped.',
    launch = HOST_AGENT_LAUNCH,
    stopping,
    onExit,
    onProcess,
    requestPermission,
    onSessionUpdate,
    onAuthStatus
  }: AgentConnectionOptions = {}
): Promise<AgentConnection> {
  // Aborted once the start gave up, by a stop or the deadline, so a lookup still running launches nothing.
  const gaveUp = new AbortController()
  const stop = createDeferred<never>()
  const stoppedByUser = stop.promise
  stoppedByUser.catch(() => undefined)
  const onAbort = () => {
    gaveUp.abort()
    stop.reject(new Error(stopMessage))
  }
  if (signal?.aborted) onAbort()
  else signal?.addEventListener('abort', onAbort, { once: true })
  const timedOut = `${agentDef.name} did not answer in time.`

  let closing = false
  const starting = (async () => {
    const { command, searchPath } = await launch.resolveTarget(agentDef)
    if (gaveUp.signal.aborted) throw new Error(stopMessage)
    return launch.spawn({
      command,
      args: agentDef.args,
      logId,
      searchPath,
      cwd,
      destroying: () => closing || stopping?.() === true,
      onUnexpectedClose: () => onExit?.()
    })
  })()
  let process: ACPProcess
  try {
    process = await withinDeadline(starting, timeoutMs, timedOut, stoppedByUser)
  } catch (e) {
    gaveUp.abort()
    void starting.then((late) => late.child.kill()).catch(() => undefined)
    throw e
  }
  const { child, input, output } = process
  onProcess?.(child)

  const connection = client({ name: 'OpenPencil' })
    .onRequest(
      methods.client.session.requestPermission,
      ({ params }) => requestPermission?.(params) ?? { outcome: { outcome: 'cancelled' } }
    )
    .onNotification(methods.client.session.update, ({ params }) => onSessionUpdate?.(params))
    .onNotification(AUTH_STATUS_UPDATE_METHOD, parseAuthStatusUpdate, ({ params }) => {
      if (params) onAuthStatus?.(params)
    })
    .connect(ndJsonStream(input, output))
  const exited = connection.closed.then((): never => {
    throw new Error(`${agentDef.name} stopped.`)
  })
  exited.catch(() => undefined)

  return {
    agent: connection.agent,
    child,
    untilStopped: (request) => Promise.race([request, exited, stoppedByUser]),
    bounded: (request, within = timeoutMs) =>
      withinDeadline(request, within, timedOut, exited, stoppedByUser),
    async close() {
      closing = true
      await child.kill().catch(() => undefined)
    }
  }
}
