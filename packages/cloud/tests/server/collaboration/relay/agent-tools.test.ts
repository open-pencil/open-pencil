import { describe, expect, test } from 'bun:test'

import {
  joinTestRelay,
  relayTicket,
  startTestRelay,
  until,
  user,
  guest,
  type RelayTicketOptions,
  type TestRelayClient
} from '#cloud-tests/helpers/relay'
import {
  COLLAB_ACTIONS,
  decodeAgentToolMessage,
  encodeAgentToolMessage,
  RELAY_SERVER_PEER,
  type AgentToolMessage
} from '#cloud/contract'
import type { CollaborationRelay } from '#cloud/server'

const documentId = crypto.randomUUID()
const alice = user('alice')
const call = { name: 'get_page_tree', args: {}, agent: { session: 'app:claude', client: 'Claude' } }

const join = (hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) =>
  joinTestRelay(hub, documentId, { principal: alice, ...ticket })

function say(client: TestRelayClient, message: AgentToolMessage, target = RELAY_SERVER_PEER) {
  client.send({
    type: 'message',
    namespace: COLLAB_ACTIONS.agentTools,
    target,
    payload: encodeAgentToolMessage(message)
  })
}

/** The tool messages the relay sent a client, decoded. */
function heard(client: TestRelayClient) {
  return client
    .messages(COLLAB_ACTIONS.agentTools)
    .map((frame) => decodeAgentToolMessage(frame.payload))
}

/** The call the relay handed a client, once it has. */
async function nextCall(client: TestRelayClient) {
  await until(() => heard(client).some((message) => message?.type === 'call'))
  const found = heard(client).find((message) => message?.type === 'call')
  if (found?.type !== 'call') throw new Error('No call arrived')
  return found
}

async function hosting(hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) {
  const client = await join(hub, ticket)
  say(client, { type: 'host' })
  return client
}

describe('agent tools through the relay', () => {
  test("hands an app's call to the person's editor and returns its answer", async () => {
    const { relay: hub } = startTestRelay()
    const editor = await hosting(hub)
    const outcome = hub.callTool(documentId, 'alice', call)
    const handed = await nextCall(editor)
    expect(handed).toMatchObject({ name: 'get_page_tree', agent: { client: 'Claude' } })
    say(editor, { type: 'result', id: handed.id, ok: true, result: { pages: 1 } })
    expect(await outcome).toEqual({ ok: true, result: { pages: 1 } })
    await hub.close()
  })

  test('passes on the failure an editor answers with', async () => {
    const { relay: hub } = startTestRelay()
    const editor = await hosting(hub)
    const outcome = hub.callTool(documentId, 'alice', call)
    const handed = await nextCall(editor)
    say(editor, { type: 'result', id: handed.id, ok: false, error: 'Node not found' })
    expect(await outcome).toEqual({ ok: false, failure: 'tool_failed', message: 'Node not found' })
    await hub.close()
  })

  test("reaches only the caller's own editors that offered to run tools", async () => {
    const { relay: hub } = startTestRelay()
    // An editor that never offered, someone else's editor, a viewer, and a guest who edits.
    await join(hub)
    await hosting(hub, { principal: user('bob') })
    await hosting(hub, { permission: 'view' })
    await hosting(hub, { principal: guest('visitor') })
    expect(await hub.callTool(documentId, 'alice', call)).toEqual({
      ok: false,
      failure: 'editor_not_open'
    })
    expect(await hub.callTool(crypto.randomUUID(), 'bob', call)).toEqual({
      ok: false,
      failure: 'editor_not_open'
    })
    await hub.close()
  })

  test('takes only the answer of the editor it asked', async () => {
    const { relay: hub } = startTestRelay()
    const editor = await hosting(hub)
    const other = await hosting(hub, { principal: user('bob') })
    const outcome = hub.callTool(documentId, 'alice', call)
    const handed = await nextCall(editor)
    say(other, { type: 'result', id: handed.id, ok: true, result: 'forged' })
    say(editor, { type: 'result', id: handed.id, ok: true, result: 'real' })
    expect(await outcome).toEqual({ ok: true, result: 'real' })
    await hub.close()
  })

  test('never carries tool messages from one peer to another', async () => {
    const { relay: hub } = startTestRelay()
    const sender = await join(hub)
    const receiver = await join(hub)
    const peer = receiver.peerId()
    if (!peer) throw new Error('No peer')
    say(sender, { type: 'host' }, peer)
    await until(() => sender.peerId() !== undefined)
    expect(heard(receiver)).toEqual([])
    await hub.close()
  })

  test('asks the editor of theirs that joined last', async () => {
    const { relay: hub } = startTestRelay()
    const earlier = await hosting(hub)
    const later = await hosting(hub)
    const outcome = hub.callTool(documentId, 'alice', call)
    const handed = await nextCall(later)
    expect(heard(earlier)).toEqual([])
    say(later, { type: 'result', id: handed.id, ok: true, result: null })
    await outcome
    await hub.close()
  })

  test('fails the call when its editor leaves before answering', async () => {
    const { relay: hub } = startTestRelay()
    const editor = await hosting(hub)
    const outcome = hub.callTool(documentId, 'alice', call)
    await nextCall(editor)
    editor.connection.closed()
    expect(await outcome).toMatchObject({ ok: false, failure: 'tool_failed' })
    await hub.close()
  })

  test('stops waiting after the timeout and cancels the call in the editor', async () => {
    const { relay: hub } = startTestRelay({ agentToolTimeoutMs: 5 })
    const editor = await hosting(hub)
    const outcome = hub.callTool(documentId, 'alice', call)
    const handed = await nextCall(editor)
    expect(await outcome).toEqual({ ok: false, failure: 'timeout' })
    expect(heard(editor)).toContainEqual({ type: 'cancel', id: handed.id })
    await hub.close()
  })

  test('passes over an editor whose refreshed ticket only lets it view', async () => {
    const { relay: hub } = startTestRelay()
    const editor = await hosting(hub)
    const lowered = await hosting(hub)
    lowered.send({
      type: 'auth',
      token: await relayTicket({ documentId, permission: 'view', principal: alice })
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
    const outcome = hub.callTool(documentId, 'alice', call)
    const handed = await nextCall(editor)
    say(editor, { type: 'result', id: handed.id, ok: true, result: undefined })
    expect(await outcome).toEqual({ ok: true, result: null })
    await hub.close()
  })
})
