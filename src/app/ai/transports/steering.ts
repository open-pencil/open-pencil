import { whenever } from '@vueuse/core'

interface SteeringOptions {
  /** Whether a message waits to go in mid-turn; reactive state, so a new one is noticed at once. */
  yieldWhen: () => boolean
  /** Cancels the agent's turn. */
  cancel: () => void
}

/**
 * Lets a coding agent's reply give way to a message the person wrote while it worked, as the
 * built-in chat's `yieldWhen` does once a step's tool calls finish. An agent cannot take a message
 * mid-turn, so its turn is cancelled and the reply ends as a finished one; the chat then sends the
 * waiting message into the same session.
 *
 * The turn is cancelled once, and only while no tool call runs, since a call cancelled halfway
 * leaves its edit unfinished. `check` looks whenever the agent reports something, and the watch
 * looks when a message starts waiting while the agent is quiet.
 */
export function createSteering({ yieldWhen, cancel }: SteeringOptions) {
  const running = new Set<string>()
  let yielded = false

  function check(): void {
    if (yielded || running.size > 0 || !yieldWhen()) return
    yielded = true
    stop()
    cancel()
  }

  const stop = whenever(yieldWhen, check, { flush: 'sync' })

  return {
    /** A tool call began or reported again, still running or over. */
    callRunning(id: string, isRunning: boolean) {
      if (isRunning) running.add(id)
      else running.delete(id)
    },
    check,
    /** Whether the turn was cancelled to make room, so that its ending is no failure. */
    get yielded() {
      return yielded
    },
    /** Stops watching, once the reply has ended. */
    stop
  }
}

export type Steering = ReturnType<typeof createSteering>
