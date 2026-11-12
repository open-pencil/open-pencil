import type { ACPAgentDef } from '@open-pencil/core/constants'

import type { ACPProcess } from '@/app/ai/agents/acp/process'
import { createDeferred } from '@/app/runtime/deferred'

/**
 * How long an agent may take to answer one request: each startup request, where resuming starts
 * the agent's CLI, which is slowest, and a one-off agent's prompt.
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

interface AgentStartLimits {
  /** Stopping ends the start at any step, and whatever else waits on `stoppedByUser`. */
  signal?: AbortSignal
  timeoutMs?: number
  /** What a stop rejects with. */
  stopMessage: string
}

/**
 * The limits on starting an agent: Stop ends any step, and each step must answer within the
 * deadline.
 */
export function boundAgentStart(
  agent: ACPAgentDef,
  { signal, timeoutMs = AGENT_START_TIMEOUT_MS, stopMessage }: AgentStartLimits
) {
  // Aborted once the start gave up, by Stop or the deadline, so a lookup still running launches nothing.
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

  /** The request's answer, unless Stop or the deadline comes first, or one of `also` fails. */
  const bounded = <T>(request: Promise<T>, ...also: Promise<never>[]): Promise<T> =>
    withinDeadline(
      request,
      timeoutMs,
      `${agent.name} did not answer while starting.`,
      stoppedByUser,
      ...also
    )

  /** Finds the agent and starts it; a process that starts after the start gave up is killed. */
  async function launch<Found, Started extends ACPProcess>(
    find: () => Promise<Found>,
    start: (found: Found) => Promise<Started>
  ): Promise<Started> {
    const starting = (async () => {
      const found = await find()
      if (gaveUp.signal.aborted) throw new Error(stopMessage)
      return start(found)
    })()
    try {
      return await bounded(starting)
    } catch (e) {
      gaveUp.abort()
      void starting.then((late) => late.child.kill()).catch(() => undefined)
      throw e
    }
  }

  return { stoppedByUser, bounded, launch }
}
