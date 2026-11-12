import { promiseTimeout } from '@vueuse/core'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import type { ACPProcess } from '@/app/ai/agents/acp/process'
import { createDeferred } from '@/app/runtime/deferred'

/** How long each startup request may take; resuming starts the agent's CLI, which is slowest. */
export const AGENT_START_TIMEOUT_MS = 60_000

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
    Promise.race([
      request,
      stoppedByUser,
      ...also,
      promiseTimeout(timeoutMs).then((): never => {
        throw new Error(`${agent.name} did not answer while starting.`)
      })
    ])

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
