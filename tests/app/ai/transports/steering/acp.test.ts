import { afterEach, expect, test } from 'bun:test'

import type { SessionUpdate } from '@agentclientprotocol/sdk'

import {
  clearQueuedMessages,
  enqueueMessage,
  hasSteeringMessage,
  takeNextMessage
} from '@/app/ai/chat/queue'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'

import { fakeAgents, message, send, sending, tick, transport } from '#tests/helpers/ai/acp-agent'

afterEach(() => {
  clearQueuedMessages()
})

function submission(text: string): ChatSubmission {
  return { modelText: text, displayText: text, images: [], nodes: [] }
}

function toolCall(id: string): SessionUpdate {
  return {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'Read',
    kind: 'read',
    status: 'in_progress'
  }
}

function toolCallEnded(id: string, status: 'completed' | 'failed'): SessionUpdate {
  return { sessionUpdate: 'tool_call_update', toolCallId: id, status }
}

function agentText(text: string): SessionUpdate {
  return { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
}

test("a steering message cancels the agent's turn once its running tool calls finished, never before", async () => {
  const agents = fakeAgents({ turn: 'held' })
  // Plain state rather than the queue, so only an agent's update can make the transport look.
  let waiting = false
  const { transport: chat } = transport(agents, { yieldWhen: () => waiting })
  const reply = sending(chat, 'first')
  await agents.promptTaken
  await agents.say(toolCall('read-1'))
  await agents.say(toolCall('read-2'))
  waiting = true
  await agents.say(agentText('Reading'))
  await agents.say(toolCallEnded('read-1', 'completed'))
  await tick()
  // `read-2` still runs.
  expect(agents.cancels).toEqual([])

  await agents.say(toolCallEnded('read-2', 'failed'))
  await reply.ended
  expect(agents.cancels).toEqual(['session-1'])
  // The reply finished on its own terms: no error, and not a Stop.
  expect(reply.chunks.some((chunk) => chunk.type === 'error')).toBe(false)
  expect(reply.chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
  await chat.destroy()
})

test('a steering message waiting before the agent says anything cancels at its first update', async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat } = transport(agents, { yieldWhen: () => true })
  const reply = sending(chat, 'first')
  await reply.ended
  expect(agents.cancels).toEqual(['session-1'])
  await chat.destroy()
})

test('a steering message written while the agent is quiet cancels its turn at once', async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat } = transport(agents, { yieldWhen: hasSteeringMessage })
  const reply = sending(chat, 'first')
  await agents.promptTaken
  await tick()
  expect(agents.cancels).toEqual([])

  enqueueMessage(submission('Make it blue'), 'steer')
  await reply.ended
  expect(agents.cancels).toEqual(['session-1'])
  await chat.destroy()
})

test('a steering message written during a tool call waits for the call to finish', async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat } = transport(agents, { yieldWhen: hasSteeringMessage })
  const reply = sending(chat, 'first')
  await agents.promptTaken
  await agents.say(toolCall('read-1'))
  await tick()

  enqueueMessage(submission('Make it blue'), 'steer')
  await tick()
  expect(agents.cancels).toEqual([])

  await agents.say(toolCallEnded('read-1', 'completed'))
  await reply.ended
  expect(agents.cancels).toEqual(['session-1'])
  await chat.destroy()
})

test("a follow-up never cancels the agent's turn", async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat } = transport(agents, { yieldWhen: hasSteeringMessage })
  const reply = sending(chat, 'first')
  await agents.promptTaken
  enqueueMessage(submission('Then add a caption'), 'follow-up')
  await agents.say(toolCall('read-1'))
  await agents.say(toolCallEnded('read-1', 'completed'))
  await agents.say(agentText('Done'))
  await tick()
  expect(agents.cancels).toEqual([])

  agents.endTurn('end_turn')
  await reply.ended
  expect(agents.cancels).toEqual([])
  expect(reply.chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
  await chat.destroy()
})

test('the agent carries on in its session with the steering message', async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat } = transport(agents, { yieldWhen: hasSteeringMessage })
  const first = sending(chat, 'first')
  await agents.promptTaken
  enqueueMessage(submission('Make it blue'), 'steer')
  await first.ended

  // The chat sends what waited, once the reply is over.
  const steer = takeNextMessage()?.modelText ?? ''
  await send(chat, steer, [message('user', 'first'), message('assistant', 'Reading')])
  expect(agents.spawns()).toBe(1)
  expect(agents.created).toHaveLength(1)
  expect(agents.prompts[1]).toBe('Make it blue')
  await chat.destroy()
})

test('a steering message written after the reply ended cancels nothing', async () => {
  const agents = fakeAgents()
  const { transport: chat } = transport(agents, { yieldWhen: hasSteeringMessage })
  await send(chat, 'first')

  enqueueMessage(submission('Make it blue'), 'steer')
  await tick()
  expect(agents.cancels).toEqual([])
  await chat.destroy()
})
