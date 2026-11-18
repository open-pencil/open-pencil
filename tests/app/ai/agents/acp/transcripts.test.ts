import { describe, expect, test } from 'bun:test'

import type { UIMessageChunk } from 'ai'

import { createSubagentTranscripts } from '@/app/ai/agents/acp/transcripts'
import { SUBAGENT_PART, subagentTranscript } from '@/app/ai/chat/subagents'

/** The last transcript the chat received for each subagent. */
function latest(chunks: UIMessageChunk[]) {
  const transcripts = new Map<string, ReturnType<typeof subagentTranscript>>()
  for (const chunk of chunks) {
    if (chunk.type !== SUBAGENT_PART || !('id' in chunk) || !chunk.id) continue
    transcripts.set(
      chunk.id,
      subagentTranscript({ type: SUBAGENT_PART, id: chunk.id, data: chunk.data })
    )
  }
  return transcripts
}

describe('a subagent’s transcript in the reply', () => {
  test('holds what its parent called it and what it did, apart from other subagents', async () => {
    const chunks: UIMessageChunk[] = []
    const transcripts = createSubagentTranscripts((chunk) => chunks.push(chunk))
    transcripts.describe({
      sessionId: 'left',
      title: 'Left card',
      state: { state: 'running' }
    })
    transcripts.update('left', {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Building the card.' }
    })
    transcripts.update('right', {
      sessionUpdate: 'tool_call',
      toolCallId: 'call-1',
      title: 'Read file',
      kind: 'read',
      status: 'completed',
      rawOutput: 'ok'
    })
    transcripts.describe({
      sessionId: 'left',
      state: { state: 'idle' }
    })
    await transcripts.end()

    const shown = latest(chunks)
    expect(shown.get('left')).toMatchObject({
      session: 'left',
      title: 'Left card',
      state: 'idle',
      parts: expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: 'Building the card.' })
      ])
    })
    expect(shown.get('right')?.parts.some((part) => 'toolCallId' in part)).toBe(true)
    expect(shown.get('right')?.parts.some((part) => part.type === 'text')).toBe(false)
  })

  test('a state the chat does not know reads as unknown', async () => {
    const chunks: UIMessageChunk[] = []
    const transcripts = createSubagentTranscripts((chunk) => chunks.push(chunk))
    transcripts.describe({
      sessionId: 'a',
      state: { state: 'paused' }
    })
    await transcripts.end()
    expect(latest(chunks).get('a')?.state).toBe('unknown')
  })

  test('a subagent never reported done stops reading as at work when the reply ends', async () => {
    const chunks: UIMessageChunk[] = []
    const transcripts = createSubagentTranscripts((chunk) => chunks.push(chunk))
    transcripts.update('quiet', {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Working on it.' }
    })
    await transcripts.end()
    expect(latest(chunks).get('quiet')?.state).toBe('unknown')
  })

  test('names the agent a subagent shows as on the canvas once it has one', async () => {
    const chunks: UIMessageChunk[] = []
    const agents = new Map<string, { id: string; name: string; color: string }>()
    const transcripts = createSubagentTranscripts(
      (chunk) => chunks.push(chunk),
      (session) => agents.get(session) ?? null
    )
    agents.set('left', { id: 'agent-1', name: 'Pico', color: '#2563EB' })
    transcripts.describe({ sessionId: 'left', state: { state: 'running' } })
    transcripts.update('left', {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Drawing.' }
    })
    // It keeps the name once its agent has left the canvas.
    agents.delete('left')
    await transcripts.end()
    expect(latest(chunks).get('left')?.agent).toEqual({
      id: 'agent-1',
      name: 'Pico',
      color: '#2563EB'
    })
  })
})
