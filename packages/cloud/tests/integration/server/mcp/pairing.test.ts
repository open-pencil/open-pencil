import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  createAccountAuthenticationFixture
} from '#cloud-tests/helpers/account-authentication'
import {
  connectTestClient,
  pairingSocket,
  until,
  type TestRelayClient
} from '#cloud-tests/helpers/relay'
import {
  cloudMCPResource,
  COLLAB_ACTIONS,
  decodeAgentToolMessage,
  encodeAgentToolMessage,
  RELAY_SERVER_PEER
} from '#cloud/contract'
import { createAgentPairingHub, parseCloudServerConfig } from '#cloud/server'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import * as v from 'valibot'

const config = parseCloudServerConfig({ ...accountAuthenticationConfig, agentPairing: true })
const token = `opg_${'5e'.repeat(32)}`
const textSchema = v.object({
  content: v.tuple([v.object({ type: v.literal('text'), text: v.string() })])
})

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
const pairing = createAgentPairingHub({
  maximumMessageBytes: 1_048_576,
  maximumAnswerBytes: 8_388_608
})

async function withAgent<T>(bearer: string, use: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: 'pairing-test', version: '0.0.0' })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(cloudMCPResource(config.publicURL)), {
      fetch: async (input, init) => fixture.app.fetch(new Request(input, init)),
      requestInit: { headers: { Authorization: `Bearer ${bearer}` } }
    })
  )
  try {
    return await use(client)
  } finally {
    await client.close()
  }
}

/** A tab paired with `token` that answers every call with the call's name. */
async function pairTab(): Promise<TestRelayClient> {
  const tab = connectTestClient((socket) => pairing.connect(pairingSocket(socket)))
  tab.send({ type: 'auth', token })
  await until(() => tab.peerId() !== undefined)
  const say = (payload: Uint8Array) =>
    tab.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.agentTools,
      target: RELAY_SERVER_PEER,
      payload
    })
  say(encodeAgentToolMessage({ type: 'host' }))
  const answered = new Set<string>()
  void (async () => {
    while (!tab.closed) {
      for (const frame of tab.messages(COLLAB_ACTIONS.agentTools)) {
        const message = decodeAgentToolMessage(frame.payload)
        if (message?.type !== 'call' || answered.has(message.id)) continue
        answered.add(message.id)
        say(
          encodeAgentToolMessage({
            type: 'result',
            id: message.id,
            ok: true,
            result: { ran: message.name, args: message.args }
          })
        )
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 1)
      })
    }
  })()
  return tab
}

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture({
    config,
    services: { callPairedTool: (pairingId, call) => pairing.call(pairingId, call) }
  })
})

afterAll(async () => {
  pairing.close()
  await fixture.close()
})

describe('MCP for an agent paired with an editor tab', () => {
  test("lists Core's design tools and nothing that needs an account", async () => {
    await withAgent(token, async (client) => {
      const names = (await client.listTools()).tools.map((tool) => tool.name)
      expect(names).toEqual(expect.arrayContaining(['get_page_tree', 'render']))
      expect(names).toEqual(expect.arrayContaining(['list_documents', 'create_document']))
      expect(names).not.toContain('list_workspaces')
      expect(names).not.toContain('save_version')
    })
  })

  test('runs a call in the paired tab, on the page it names', async () => {
    const tab = await pairTab()
    try {
      await withAgent(token, async (client) => {
        const result = await client.callTool({
          name: 'get_page_tree',
          arguments: { page_id: '0:1' }
        })
        expect(
          v.parse(v.pipe(v.string(), v.parseJson()), v.parse(textSchema, result).content[0].text)
        ).toEqual({ ran: 'get_page_tree', args: { page_id: '0:1' } })
      })
    } finally {
      tab.connection.closed()
    }
  })

  test('tells the agent to pair again once no tab holds its token', async () => {
    await withAgent(`opg_${'77'.repeat(32)}`, async (client) => {
      const result = await client.callTool({ name: 'get_page_tree', arguments: {} })
      expect(result.isError).toBe(true)
      expect(v.parse(textSchema, result).content[0].text).toContain('OpenPencil is not open')
    })
  })
})
