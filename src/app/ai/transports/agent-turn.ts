import {
  methods,
  type ClientConnection,
  type PromptResponse,
  type SessionNotification,
  type SessionUpdate
} from '@agentclientprotocol/sdk/unstable'
import type { UIMessageChunk } from 'ai'

import { createUpdateMapper, isFinished } from '@/app/ai/agents/acp/events'
import { createSubagentTranscripts } from '@/app/ai/agents/acp/transcripts'
import { endRun, startAgentRun } from '@/app/ai/reply/run'
import { createSteering, type Steering } from '@/app/ai/transports/steering'
import { subagentAgent } from '@/app/automation/agents'
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
  connection: ClientConnection
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
 * ends when the prompt answers or fails, which it does when the agent exits, when Stop is pressed,
 * or when its reader leaves.
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
  const cancelTurn = () =>
    void connection.agent
      .notify(methods.agent.session.cancel, { sessionId })
      // An agent that exited has no turn left to cancel.
      .catch(() => undefined)
  const steering = createSteering({ yieldWhen, cancel: cancelTurn })
  const run = store ? startAgentRun(store, session.chat) : null
  /** The reply's stream until it closes or its reader leaves. */
  let output: ReadableStreamDefaultController<UIMessageChunk> | null = null
  /** Whether the reply is still going, as opposed to ended, though its stream may not be closed. */
  let live = false
  const subagents = createSubagentTranscripts(
    (chunk) => output?.enqueue(chunk),
    // The agent each subagent shows as in this chat's document.
    (subagent) => (store ? subagentAgent(store, subagent) : null)
  )

  function stopTurn() {
    cancelTurn()
    finish('stop')
  }

  /** Ends the reply, once; whether it was still going. */
  function release(): boolean {
    if (!live) return false
    live = false
    steering.stop()
    // The signal can outlive the reply, and its abort then would cancel the session's next turn.
    abortSignal?.removeEventListener('abort', stopTurn)
    if (store && run) endRun(store, run)
    session.onUpdate = null
    return true
  }

  function finish(reason: 'stop' | 'other' | 'error', errorText?: string) {
    if (!release()) return
    // The subagents' transcripts reach the chat in full before the reply closes.
    void subagents.end().finally(() => {
      const open = output
      if (!open) return
      output = null
      if (errorText) open.enqueue({ type: 'error', errorText })
      for (const chunk of mapper.end()) open.enqueue(chunk)
      open.enqueue({ type: 'finish-step' })
      open.enqueue({ type: 'finish', finishReason: reason })
      open.close()
    })
  }

  return new ReadableStream<UIMessageChunk>({
    start: (controller) => {
      output = controller
      live = true

      session.onUpdate = (params) => {
        if (!live) return
        const { update } = params
        // A subagent's own subagents are described on its session, as the agent's are on the chat's.
        if (update.sessionUpdate === 'subagent_update') subagents.describe(update)
        if (params.sessionId !== sessionId) {
          subagents.update(params.sessionId, update)
          return
        }
        const inTurn = TURN_UPDATES.has(update.sessionUpdate)
        if (inTurn) onTurn()
        for (const chunk of mapper.map(update)) controller.enqueue(chunk)
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

      connection.agent
        .request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: 'text', text: promptText }]
        })
        // The prompt answers once the agent's turn is over, or fails when the agent exits.
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
      output = null
      if (release()) {
        cancelTurn()
        void subagents.end()
      }
    }
  })
}
