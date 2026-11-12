import { afterEach, expect, test } from 'bun:test'

import type { HarnessTurnEvent } from '@open-pencil/harness'

import { clearQueuedMessages, enqueueMessage, hasSteeringMessage } from '@/app/ai/chat/queue'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { HarnessChatTransport } from '@/app/ai/transports/pi'

import { configuration, fakeCompanion, send } from '#tests/helpers/ai/pi-companion'

afterEach(() => {
  clearQueuedMessages()
})

function submission(text: string): ChatSubmission {
  return { modelText: text, displayText: text, images: [], nodes: [] }
}

const toolCall: HarnessTurnEvent = {
  type: 'tool-call',
  toolCallId: 'call-1',
  toolName: 'mcp_open-pencil_get_page_tree',
  input: {}
}
const toolResult: HarnessTurnEvent = {
  type: 'tool-result',
  toolCallId: 'call-1',
  toolName: 'mcp_open-pencil_get_page_tree',
  output: {}
}

/** Reads a reply to its end, noting each chunk's type; `ended` says whether it got there. */
function drain(stream: ReadableStream<{ type: string }>) {
  const reader = stream.getReader()
  const types: string[] = []
  let ended = false
  const done = (async () => {
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      types.push(read.value.type)
    }
    ended = true
  })()
  return { types, done, ended: () => ended }
}

/** A transport whose waiting steering message is `waiting`, with a fresh companion. */
function steered(session: string, waiting: () => boolean = hasSteeringMessage) {
  const companion = fakeCompanion()
  const transport = new HarnessChatTransport(
    session,
    configuration,
    {},
    companion.spawn,
    undefined,
    waiting
  )
  return { companion, transport }
}

test("a steering message cancels Pi's turn once its running tool call finished, never before", async () => {
  // Plain state rather than the queue, so only an event from Pi can make the transport look.
  let waiting = false
  const { companion, transport } = steered('steer-session', () => waiting)
  const reply = drain(await send(transport))
  await Bun.sleep(0)
  const turn = companion.turns.at(-1) ?? ''
  companion.event(turn, toolCall)
  waiting = true
  companion.text(turn, 'Reading')
  await Bun.sleep(0)
  expect(companion.cancels).toBe(0)

  companion.event(turn, toolResult)
  await Bun.sleep(0)
  expect(companion.cancels).toBe(1)
  // The reply ends once Pi answers the cancelled turn, so the next turn finds the session idle.
  expect(reply.ended()).toBe(false)
  companion.complete(turn)
  await reply.done
  expect(reply.types.at(-1)).toBe('finish')
  expect(reply.types).not.toContain('error')
  await transport.destroy()
})

test('a steering message waiting before Pi says anything cancels at its first event', async () => {
  const { companion, transport } = steered('early-steer-session', () => true)
  const reply = drain(await send(transport))
  await Bun.sleep(0)
  expect(companion.cancels).toBe(0)
  const turn = companion.turns.at(-1) ?? ''
  companion.text(turn, 'Reading')
  await Bun.sleep(0)
  expect(companion.cancels).toBe(1)
  companion.complete(turn)
  await reply.done
  await transport.destroy()
})

test('a steering message written while Pi is quiet cancels its turn at once', async () => {
  const { companion, transport } = steered('quiet-steer-session')
  const reply = drain(await send(transport))
  await Bun.sleep(0)
  expect(companion.cancels).toBe(0)

  enqueueMessage(submission('Make it blue'), 'steer')
  await Bun.sleep(0)
  expect(companion.cancels).toBe(1)
  companion.complete(companion.turns.at(-1) ?? '')
  await reply.done
  await transport.destroy()
})

test("a follow-up never cancels Pi's turn", async () => {
  const { companion, transport } = steered('follow-up-session')
  const reply = drain(await send(transport))
  await Bun.sleep(0)
  const turn = companion.turns.at(-1) ?? ''
  enqueueMessage(submission('Then add a caption'), 'follow-up')
  companion.event(turn, toolCall)
  companion.event(turn, toolResult)
  companion.text(turn, 'Done')
  await Bun.sleep(0)
  expect(companion.cancels).toBe(0)

  companion.complete(turn)
  await reply.done
  expect(companion.cancels).toBe(0)
  expect(reply.types.at(-1)).toBe('finish')
  await transport.destroy()
})

test('a steering message written after the turn ended cancels nothing', async () => {
  const { companion, transport } = steered('ended-steer-session')
  const reply = drain(await send(transport))
  await Bun.sleep(0)
  companion.complete(companion.turns.at(-1) ?? '')
  await reply.done

  // A cancel now would hit the turn that comes next.
  enqueueMessage(submission('Make it blue'), 'steer')
  await Bun.sleep(0)
  expect(companion.cancels).toBe(0)
  await transport.destroy()
})

test('a steering message written after the chat closed its agent cancels nothing', async () => {
  const { companion, transport } = steered('closed-steer-session')
  await send(transport)
  await Bun.sleep(0)
  await transport.destroy()

  enqueueMessage(submission('Make it blue'), 'steer')
  await Bun.sleep(0)
  expect(companion.cancels).toBe(0)
})
