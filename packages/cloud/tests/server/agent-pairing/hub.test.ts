import { describe, expect, test } from 'bun:test'

import {
  connectTestClient,
  pairingSocket,
  until,
  type TestRelayClient
} from '#cloud-tests/helpers/relay'
import { agentPairingId, RELAY_CLOSE } from '#cloud/contract'
import { createAgentPairingHub, type AgentPairingHubOptions } from '#cloud/server'

import { COLLAB_ACTIONS, RELAY_SERVER_PEER } from '@open-pencil/collab'
import {
  decodeAutomationMessage,
  encodeAutomationMessage,
  type AutomationMessage
} from '@open-pencil/collab/automation'

const token = `opg_${'ab'.repeat(32)}`
const call = { name: 'get_page_tree', args: {}, agent: { session: 'pairing:test' } }

function hub(options: Partial<AgentPairingHubOptions> = {}) {
  return createAgentPairingHub({
    maximumMessageBytes: 1_048_576,
    maximumAnswerBytes: 8_388_608,
    ...options
  })
}

function say(client: TestRelayClient, message: AutomationMessage) {
  client.send({
    type: 'message',
    namespace: COLLAB_ACTIONS.agentTools,
    target: RELAY_SERVER_PEER,
    payload: encodeAutomationMessage(message)
  })
}

/** A tab that presented `presented` and, once welcomed, offered to run tools. */
async function pairedTab(pairing: ReturnType<typeof hub>, presented = token) {
  const tab = connectTestClient((socket) => pairing.connect(pairingSocket(socket)))
  tab.send({ type: 'auth', token: presented })
  await until(() => tab.peerId() !== undefined || tab.closed !== null)
  if (tab.peerId()) say(tab, { type: 'register' })
  return tab
}

async function nextCall(tab: TestRelayClient) {
  const calls = () =>
    tab
      .messages(COLLAB_ACTIONS.agentTools)
      .map((frame) => decodeAutomationMessage(frame.payload))
      .filter((message) => message?.type === 'request')
  await until(() => calls().length > 0)
  const found = calls()[0]
  if (found?.type !== 'request') throw new Error('No call arrived')
  return found
}

describe('agent pairing hub', () => {
  test('welcomes a tab with its pairing token, naming itself as the one peer', async () => {
    const tab = await pairedTab(hub())
    expect(tab.frames[0]).toMatchObject({ type: 'welcome', peers: [RELAY_SERVER_PEER] })
  })

  test("carries a call to the tab of the token's pairing and returns its answer", async () => {
    const pairing = hub()
    const tab = await pairedTab(pairing)
    const outcome = pairing.call(await agentPairingId(token), call)
    const handed = await nextCall(tab)
    say(tab, { type: 'response', id: handed.id, ok: true, result: { page: 'Page 1' } })
    expect(await outcome).toEqual({ ok: true, result: { page: 'Page 1' } })
  })

  test("sends a tool as the local MCP server's tool request, and its document commands as its own", async () => {
    const pairing = hub()
    const tab = await pairedTab(pairing)
    const id = await agentPairingId(token)
    const tool = pairing.call(id, { ...call, args: { document_id: 'tab-1', page_id: '0:1' } })
    const handedTool = await nextCall(tab)
    expect(handedTool).toMatchObject({
      command: 'tool',
      args: {
        document_id: 'tab-1',
        page_id: '0:1',
        name: 'get_page_tree',
        args: {},
        agent: { session: 'pairing:test', kind: 'mcp' }
      }
    })
    say(tab, { type: 'response', id: handedTool.id, ok: true, result: null })
    await tool
    const listed = pairing.call(id, { ...call, name: 'list_documents' })
    await until(() => tab.messages(COLLAB_ACTIONS.agentTools).length > 1)
    const handedList = decodeAutomationMessage(
      tab.messages(COLLAB_ACTIONS.agentTools).at(-1)?.payload ?? new Uint8Array()
    )
    expect(handedList).toMatchObject({
      type: 'request',
      command: 'list_documents',
      args: { agent: { session: 'pairing:test', kind: 'mcp' } }
    })
    if (handedList?.type !== 'request') throw new Error('No request arrived')
    say(tab, { type: 'response', id: handedList.id, ok: true, result: { documents: [] } })
    expect(await listed).toEqual({ ok: true, result: { documents: [] } })
  })

  test('answers that no tab has it open for a pairing nobody connected or one that left', async () => {
    const pairing = hub({ editorWaitMs: 20 })
    const id = await agentPairingId(token)
    expect(await pairing.call(id, call)).toEqual({ ok: false, failure: 'editor_not_open' })
    const tab = await pairedTab(pairing)
    const outcome = pairing.call(id, call)
    await nextCall(tab)
    tab.connection.closed()
    expect(await outcome).toMatchObject({ ok: false, failure: 'tool_failed' })
    expect(await pairing.call(id, call)).toEqual({ ok: false, failure: 'editor_not_open' })
  })

  test('holds a call made before any tab offered until one does', async () => {
    const pairing = hub()
    const outcome = pairing.call(await agentPairingId(token), call)
    // The editor the sign-in opened is still loading when the agent calls.
    const tab = await pairedTab(pairing)
    const handed = await nextCall(tab)
    say(tab, { type: 'response', id: handed.id, ok: true, result: { page: 'Page 1' } })
    expect(await outcome).toEqual({ ok: true, result: { page: 'Page 1' } })
  })

  test("waits only for a tab of the call's own pairing", async () => {
    const pairing = hub({ editorWaitMs: 50 })
    const outcome = pairing.call(await agentPairingId(token), call)
    const other = await pairedTab(pairing, `opg_${'cd'.repeat(32)}`)
    expect(await outcome).toEqual({ ok: false, failure: 'editor_not_open' })
    expect(other.messages(COLLAB_ACTIONS.agentTools)).toHaveLength(0)
  })

  test('turns away an account token and, on a hub for one pairing, any other pairing', async () => {
    const refused = await pairedTab(hub(), 'opa_not-a-pairing')
    expect(refused.closed?.code).toBe(RELAY_CLOSE.unauthorized)
    const other = await pairedTab(hub({ pairing: await agentPairingId(`opg_${'cd'.repeat(32)}`) }))
    expect(other.closed?.code).toBe(RELAY_CLOSE.unauthorized)
  })

  test('hands a call to the tab that offered to run tools last, not the one that came last', async () => {
    const pairing = hub()
    const first = connectTestClient((socket) => pairing.connect(pairingSocket(socket)))
    first.send({ type: 'auth', token })
    await until(() => first.peerId() !== undefined)
    const second = await pairedTab(pairing)
    say(first, { type: 'register' })
    const outcome = pairing.call(await agentPairingId(token), call)
    const handed = await nextCall(first)
    say(first, { type: 'response', id: handed.id, ok: true, result: 'first' })
    expect(await outcome).toEqual({ ok: true, result: 'first' })
    expect(second.messages(COLLAB_ACTIONS.agentTools)).toHaveLength(0)
  })

  test('takes a resumed tab back as the host it was', async () => {
    const pairing = hub()
    const id = await agentPairingId(token)
    const tab = connectTestClient((socket) =>
      pairing.resume(pairingSocket(socket), {
        pairing: id,
        peerId: crypto.randomUUID(),
        toolHost: true
      })
    )
    const outcome = pairing.call(id, call)
    const handed = await nextCall(tab)
    say(tab, { type: 'response', id: handed.id, ok: false, error: 'No document is open' })
    expect(await outcome).toEqual({
      ok: false,
      failure: 'tool_failed',
      message: 'No document is open'
    })
  })
})
