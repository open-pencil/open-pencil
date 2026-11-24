import { describe, expect, test } from 'bun:test'

import {
  connectTestClient,
  pairingSocket,
  until,
  type TestRelayClient
} from '#cloud-tests/helpers/relay'
import {
  agentPairingId,
  COLLAB_ACTIONS,
  decodeAgentToolMessage,
  encodeAgentToolMessage,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
  type AgentToolMessage
} from '#cloud/contract'
import { createAgentPairingHub, type AgentPairingHubOptions } from '#cloud/server'

const token = `opg_${'ab'.repeat(32)}`
const call = { name: 'get_page_tree', args: {}, agent: { session: 'pairing:test' } }

function hub(options: Partial<AgentPairingHubOptions> = {}) {
  return createAgentPairingHub({
    maximumMessageBytes: 1_048_576,
    maximumAnswerBytes: 8_388_608,
    ...options
  })
}

function say(client: TestRelayClient, message: AgentToolMessage) {
  client.send({
    type: 'message',
    namespace: COLLAB_ACTIONS.agentTools,
    target: RELAY_SERVER_PEER,
    payload: encodeAgentToolMessage(message)
  })
}

/** A tab that presented `presented` and, once welcomed, offered to run tools. */
async function pairedTab(pairing: ReturnType<typeof hub>, presented = token) {
  const tab = connectTestClient((socket) => pairing.connect(pairingSocket(socket)))
  tab.send({ type: 'auth', token: presented })
  await until(() => tab.peerId() !== undefined || tab.closed !== null)
  if (tab.peerId()) say(tab, { type: 'host' })
  return tab
}

async function nextCall(tab: TestRelayClient) {
  const calls = () =>
    tab
      .messages(COLLAB_ACTIONS.agentTools)
      .map((frame) => decodeAgentToolMessage(frame.payload))
      .filter((message) => message?.type === 'call')
  await until(() => calls().length > 0)
  const found = calls()[0]
  if (found?.type !== 'call') throw new Error('No call arrived')
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
    say(tab, { type: 'result', id: handed.id, ok: true, result: { page: 'Page 1' } })
    expect(await outcome).toEqual({ ok: true, result: { page: 'Page 1' } })
  })

  test('answers that no tab has it open for a pairing nobody connected or one that left', async () => {
    const pairing = hub()
    const id = await agentPairingId(token)
    expect(await pairing.call(id, call)).toEqual({ ok: false, failure: 'editor_not_open' })
    const tab = await pairedTab(pairing)
    const outcome = pairing.call(id, call)
    await nextCall(tab)
    tab.connection.closed()
    expect(await outcome).toMatchObject({ ok: false, failure: 'tool_failed' })
    expect(await pairing.call(id, call)).toEqual({ ok: false, failure: 'editor_not_open' })
  })

  test('turns away an account token and, on a hub for one pairing, any other pairing', async () => {
    const refused = await pairedTab(hub(), 'opa_not-a-pairing')
    expect(refused.closed?.code).toBe(RELAY_CLOSE.unauthorized)
    const other = await pairedTab(hub({ pairing: await agentPairingId(`opg_${'cd'.repeat(32)}`) }))
    expect(other.closed?.code).toBe(RELAY_CLOSE.unauthorized)
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
    say(tab, { type: 'result', id: handed.id, ok: false, error: 'No document is open' })
    expect(await outcome).toEqual({
      ok: false,
      failure: 'tool_failed',
      message: 'No document is open'
    })
  })
})
