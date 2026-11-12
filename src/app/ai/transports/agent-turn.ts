import type {
  ClientSideConnection,
  PromptResponse,
  SessionNotification,
  SessionUpdate
} from '@agentclientprotocol/sdk'
import type { UIMessageChunk } from 'ai'

import { createUpdateMapper, isFinished } from '@/app/ai/agents/acp/events'
import { endRun, startAgentRun } from '@/app/ai/reply/run'
import { createSteering, type Steering } from '@/app/ai/transports/steering'
import type { EditorStore } from '@/app/editor/active-store'

/**
 * Updates that belong to a turn the agent took, after which it can continue the session even if
 * the turn is cut off. Claude Code and Codex cannot resume a session that never took a prompt, and
 * both send command, usage, and session info updates before they take one.
 */
const TURN_UPDATES: ReadonlySet<SessionUpdate['sessionUpdate']> = new Set([
  'user_message_chunk',
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan'
])

/** The part of an agent session a turn drives. */
interface TurnSession {
  connection: ClientSideConnection
  sessionId: string
  /** The id the agent's tool calls carry, which ties them to this chat's replies. */
  chat: string
  onUpdate: ((params: SessionNotification) => void) | null
}

interface AgentTurnOptions {
  session: TurnSession
  promptText: string
  abortSignal?: AbortSignal
  /** The chat's document, where the reply's run records the edits the agent's calls make. */
  store: EditorStore | null
  /** Whether a message waits to go in mid-turn; see `createSteering`. */
  yieldWhen: () => boolean
  /** The agent took a turn, from one of its updates or from its answer to the prompt. */
  onTurn: () => void
  /** The agent's answer to the prompt. */
  onAnswer: (result: PromptResponse) => void
  /** Handles a failed turn and says what the reply shows, or null when nothing failed. */
  onFailure: (error: unknown) => string | null
}

/** A call runs from its first report until one says it completed or failed. */
function followToolCalls(steering: Steering, update: SessionUpdate): void {
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') return
  // An update without a status leaves its call as it was.
  if (update.sessionUpdate === 'tool_call' || update.status) {
    steering.callRunning(update.toolCallId, !isFinished(update))
  }
}

/**
 * One reply as a stream: the agent's prompt, mapped to chunks until its turn is over. The reply
 * ends when the prompt answers, the agent exits, Stop is pressed, or its reader leaves.
 */
export function streamAgentTurn({
  session,
  promptText,
  abortSignal,
  store,
  yieldWhen,
  onTurn,
  onAnswer,
  onFailure
}: AgentTurnOptions): ReadableStream<UIMessageChunk> {
  const { connection, sessionId } = session
  const mapper = createUpdateMapper(`turn-${Date.now()}`)
  const cancelTurn = () => void connection.cancel({ sessionId })
  const steering = createSteering({ yieldWhen, cancel: cancelTurn })
  const run = store ? startAgentRun(store, session.chat) : null
  /** The reply's stream while someone reads it; once it ended or its reader left, null. */
  let reading: ReadableStreamDefaultController<UIMessageChunk> | null = null

  function stopTurn() {
    cancelTurn()
    finish('stop')
  }

  /** Ends the reply, once, and hands back its stream if someone still reads it. */
  function release() {
    const controller = reading
    reading = null
    steering.stop()
    // The signal can outlive the reply, and its abort then would cancel the session's next turn.
    abortSignal?.removeEventListener('abort', stopTurn)
    if (controller) {
      if (store && run) endRun(store, run)
      session.onUpdate = null
    }
    return controller
  }

  function finish(reason: 'stop' | 'other' | 'error', errorText?: string) {
    const controller = release()
    if (!controller) return
    if (errorText) controller.enqueue({ type: 'error', errorText })
    for (const chunk of mapper.end()) controller.enqueue(chunk)
    controller.enqueue({ type: 'finish-step' })
    controller.enqueue({ type: 'finish', finishReason: reason })
    controller.close()
  }

  return new ReadableStream<UIMessageChunk>({
    start: (controller) => {
      reading = controller

      session.onUpdate = ({ update }) => {
        const open = reading
        if (!open) return
        const inTurn = TURN_UPDATES.has(update.sessionUpdate)
        if (inTurn) onTurn()
        for (const chunk of mapper.map(update)) open.enqueue(chunk)
        followToolCalls(steering, update)
        // A message waiting from the start lets the agent take a turn first, as the built-in
        // chat's step runs before it yields. A cancel before the agent took the prompt can miss it.
        if (inTurn) steering.check()
      }

      abortSignal?.addEventListener('abort', stopTurn)

      controller.enqueue({ type: 'start' })
      controller.enqueue({ type: 'start-step' })

      // Stopped while the agent started and reached its tools: the abort event already fired.
      if (abortSignal?.aborted) {
        finish('stop')
        return
      }

      // The SDK leaves the prompt pending when the agent exits, so the reply races the exit.
      const exited = connection.closed.then((): never => {
        throw new Error('Agent process exited unexpectedly.')
      })
      Promise.race([
        connection.prompt({ sessionId, prompt: [{ type: 'text', text: promptText }] }),
        exited
      ])
        // The prompt answers once the agent's turn is over, or the agent exits.
        .then((result) => {
          onTurn()
          onAnswer(result)
          // A turn cancelled to make room for a waiting message is a finished reply.
          finish(result.stopReason === 'end_turn' || steering.yielded ? 'stop' : 'other')
          return undefined
        })
        .catch((e) => {
          const errorText = onFailure(e)
          finish(errorText === null ? 'stop' : 'error', errorText ?? undefined)
        })
    },
    // The reader left without a Stop, as when the chat cannot process a chunk: stop its work.
    cancel: () => {
      if (release()) cancelTurn()
    }
  })
}
