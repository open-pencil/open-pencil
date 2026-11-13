import type { SessionUpdate, SubagentUpdate } from '@agentclientprotocol/sdk/unstable'
import { readUIMessageStream, type UIMessageChunk } from 'ai'
import { throttle } from 'es-toolkit'

import { SUBAGENT_PART, subagentState, type SubagentTranscript } from '@/app/ai/chat/subagents'

import { createUpdateMapper } from './events'

/** How often a working subagent's transcript reaches the chat. */
const TRANSCRIPT_INTERVAL_MS = 150

interface Subagent {
  transcript: SubagentTranscript
  mapper: ReturnType<typeof createUpdateMapper>
  input: WritableStreamDefaultWriter<UIMessageChunk>
  /** Settles once its reply has been read to the end. */
  read: Promise<void>
  report: ReturnType<typeof throttle<() => void>>
}

/**
 * Builds the transcript of each subagent a coding agent runs during one reply. A subagent's own
 * updates arrive under its ACP session; they become a reply of its own, assembled as the chat
 * assembles the agent's, and reach the chat as one part per subagent that updates in place.
 */
export function createSubagentTranscripts(
  write: (chunk: UIMessageChunk) => void,
  /** The agent a subagent shows as on the canvas, once it has one. */
  agentOf: (session: string) => SubagentTranscript['agent'] | null = () => null
) {
  const subagents = new Map<string, Subagent>()

  /** The transcript as the chat gets it, naming the subagent's agent once it has one. */
  function snapshot(transcript: SubagentTranscript): UIMessageChunk {
    const agent = agentOf(transcript.session)
    if (agent) transcript.agent = agent
    return { type: SUBAGENT_PART, id: transcript.session, data: structuredClone(transcript) }
  }

  function subagent(session: string): Subagent {
    const known = subagents.get(session)
    if (known) return known
    const { readable, writable } = new TransformStream<UIMessageChunk, UIMessageChunk>()
    const transcript: SubagentTranscript = { session, parts: [] }
    const report = throttle(() => write(snapshot(transcript)), TRANSCRIPT_INTERVAL_MS)
    const read = (async () => {
      for await (const message of readUIMessageStream({ stream: readable })) {
        transcript.parts = message.parts
        report()
      }
    })()
    const input = writable.getWriter()
    void input.write({ type: 'start' })
    void input.write({ type: 'start-step' })
    const created: Subagent = {
      transcript,
      mapper: createUpdateMapper(`subagent-${session}`),
      input,
      read,
      report
    }
    subagents.set(session, created)
    // Its card shows as soon as the agent starts it.
    report()
    return created
  }

  return {
    /** The agent described a subagent: its name, purpose, or state. */
    describe(update: SubagentUpdate) {
      const { transcript, report } = subagent(update.sessionId)
      if (update.title !== undefined) transcript.title = update.title ?? undefined
      if (update.description !== undefined) transcript.description = update.description ?? undefined
      if (update.state !== undefined) {
        transcript.state = update.state ? subagentState(update.state.state) : undefined
      }
      report()
    },

    /** A subagent reported its own work in its session. */
    update(session: string, update: SessionUpdate) {
      const { mapper, input } = subagent(session)
      for (const chunk of mapper.map(update)) void input.write(chunk)
    },

    /**
     * The reply ends: every transcript is read to its end and reaches the chat once more. A
     * subagent the agent never reported done, as adapters on ACP's older subagent draft never
     * do, no longer reads as at work: the chat cannot follow it past the reply.
     */
    async end() {
      await Promise.all(
        [...subagents.values()].map(async ({ transcript, mapper, input, read, report }) => {
          for (const chunk of mapper.end()) void input.write(chunk)
          void input.write({ type: 'finish-step' })
          void input.write({ type: 'finish', finishReason: 'stop' })
          await input.close()
          await read
          report.cancel()
          if (transcript.state !== 'idle') transcript.state = 'unknown'
          write(snapshot(transcript))
        })
      )
    }
  }
}
