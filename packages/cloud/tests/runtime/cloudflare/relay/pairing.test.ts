import { describe, expect, test } from 'bun:test'

import { asDouble } from '#cloud-tests/helpers/doubles'
import {
  agentPairingId,
  COLLAB_ACTIONS,
  decodeAgentToolMessage,
  decodeRelayServerFrame,
  encodeAgentToolMessage,
  encodeRelayClientFrame,
  RELAY_SERVER_PEER,
  type RelayServerFrame
} from '#cloud/contract'
import { createPairingSockets } from '#cloud/runtime/cloudflare/relay/pairing'
import { createAgentPairingHub, type PairedTabState } from '#cloud/server'

const token = `opg_${'9f'.repeat(32)}`
const call = { name: 'get_page_tree', args: {}, agent: { session: 'pairing:test' } }

/** A hibernatable socket as the runtime hands it to a woken object. */
class HibernatedSocket {
  readyState: number = WebSocket.OPEN
  readonly frames: RelayServerFrame[] = []
  closedWith: number | null = null

  constructor(private attachment: PairedTabState | null) {}

  send(data: Uint8Array) {
    const frame = decodeRelayServerFrame(data)
    if (frame) this.frames.push(frame)
  }

  close(code: number) {
    this.closedWith = code
    this.readyState = WebSocket.CLOSED
  }

  serializeAttachment(state: PairedTabState) {
    this.attachment = structuredClone(state)
  }

  deserializeAttachment() {
    return this.attachment
  }
}

const asSocket = (socket: HibernatedSocket) => asDouble<WebSocket>(socket)

function sockets(held: HibernatedSocket[], pairing: string) {
  return createPairingSockets({
    sockets: () => held.map(asSocket),
    createHub: async () =>
      createAgentPairingHub({
        pairing,
        maximumMessageBytes: 1_048_576,
        maximumAnswerBytes: 8_388_608
      })
  })
}

describe('paired tabs on a Durable Object', () => {
  test('a woken object resumes a hibernated tab and carries a call to it', async () => {
    const pairing = await agentPairingId(token)
    const tab = new HibernatedSocket({ pairing, peerId: crypto.randomUUID(), toolHost: true })
    const object = sockets([tab], pairing)
    expect(object.connected).toBe(true)
    const outcome = (await object.open(pairing)).call(pairing, call)
    const handed = tab.frames
      .flatMap((frame) => (frame.type === 'message' ? [decodeAgentToolMessage(frame.payload)] : []))
      .find((message) => message?.type === 'call')
    if (handed?.type !== 'call') throw new Error('No call arrived')
    await object.message(
      asSocket(tab),
      encodeRelayClientFrame({
        type: 'message',
        namespace: COLLAB_ACTIONS.agentTools,
        target: RELAY_SERVER_PEER,
        payload: encodeAgentToolMessage({ type: 'result', id: handed.id, ok: true, result: 1 })
      }).buffer
    )
    expect(await outcome).toEqual({ ok: true, result: 1 })
  })

  test('closes a socket that hibernated before presenting its token', async () => {
    const pairing = await agentPairingId(token)
    const silent = new HibernatedSocket(null)
    const object = sockets([silent], pairing)
    await object.message(asSocket(silent), new ArrayBuffer(0))
    expect(silent.closedWith).not.toBeNull()
  })
})
