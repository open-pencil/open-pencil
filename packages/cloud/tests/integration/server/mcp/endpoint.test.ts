import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { contractClient } from '#cloud-tests/helpers/contract'
import { oauthTestApp } from '#cloud-tests/helpers/oauth'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  cloudAccessTokenCreatedResponseSchema,
  cloudMCPResource,
  type AgentToolCall,
  type AgentToolOutcome
} from '#cloud/contract'
import { parseCloudServerConfig } from '#cloud/server'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import * as v from 'valibot'

const config = parseCloudServerConfig({ ...accountAuthenticationConfig, oauthEnabled: true })
const resource = cloudMCPResource(config.publicURL)

const documentSchema = v.object({ document: v.object({ id: v.string(), url: v.string() }) })
const textSchema = v.object({
  content: v.tuple([v.object({ type: v.literal('text'), text: v.string() })])
})

type ToolCall = { documentId: string; userId: string; call: AgentToolCall }

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
let oauth: ReturnType<typeof oauthTestApp>
let person: { userId: string; sessionCookie: string }
let granted: string
let other: string
let appToken: string
/** What the stand-in relay was asked to run, and how it answers. */
const calls: ToolCall[] = []
let answer: AgentToolOutcome = { ok: true, result: null }

async function workspace(slug: string) {
  const api = contractClient(fixture.app, withCookie(person.sessionCookie).headers)
  return (await api.workspaces.create({ body: { name: slug, slug } })).workspace.id
}

async function personalToken(access: 'read' | 'write') {
  const response = await fixture.client.api.account.tokens.create.$post(
    { json: { name: `MCP ${access}`, expiresInDays: 30, access } },
    withCookie(person.sessionCookie)
  )
  expect(response.status).toBe(201)
  return (await responseJSON(response, cloudAccessTokenCreatedResponseSchema)).token
}

/** An MCP client connected to the endpoint with a token, as ChatGPT or Claude connects. */
async function connectClient(token: string) {
  const client = new Client({ name: 'endpoint-test', version: '0.0.0' })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(resource), {
      fetch: async (input, init) => fixture.app.fetch(new Request(input, init)),
      requestInit: { headers: { Authorization: `Bearer ${token}` } }
    })
  )
  return client
}

async function withClient<T>(token: string, use: (client: Client) => Promise<T>): Promise<T> {
  const client = await connectClient(token)
  try {
    return await use(client)
  } finally {
    await client.close()
  }
}

/** A tool's answer as text, whether it succeeded or failed. */
function text(result: unknown): string {
  return v.parse(textSchema, result).content[0].text
}

/** A tool's JSON answer, read with `schema`. */
function json<T extends v.GenericSchema>(result: unknown, schema: T): v.InferOutput<T> {
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), text(result))
}

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture({
    config,
    services: {
      async callDocumentTool(documentId, userId, call) {
        calls.push({ documentId, userId, call })
        return answer
      }
    }
  })
  oauth = oauthTestApp(fixture, config.publicURL)
  person = await createVerifiedCredentialAccount(fixture, {
    email: 'designer@example.com',
    name: 'Designer',
    password: 'designer-password-long-enough',
    approved: true
  })
  granted = await workspace('granted')
  other = await workspace('other')
  const clientId = await oauth.register()
  appToken = (
    await oauth.connect({ clientId, cookie: person.sessionCookie, workspaceId: granted, resource })
  ).access_token
})

afterAll(async () => {
  await fixture.close()
})

describe('MCP endpoint', () => {
  test('sends a client without a token to the authorization server named for the endpoint', async () => {
    const response = await fixture.app.fetch(
      new Request(resource, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
      })
    )
    expect(response.status).toBe(401)
    const challenge = response.headers.get('WWW-Authenticate') ?? ''
    expect(challenge).toContain('/.well-known/oauth-protected-resource/mcp')
    const metadata = await responseJSON(
      await fixture.app.fetch(
        new Request(new URL('/.well-known/oauth-protected-resource/mcp', config.publicURL))
      ),
      v.object({ resource: v.string(), authorization_servers: v.array(v.string()) })
    )
    expect(metadata.resource).toBe(resource)
  })

  test('refuses pairing tokens where the server pairs no tabs', async () => {
    const response = await fixture.app.fetch(
      new Request(resource, {
        method: 'POST',
        headers: {
          Authorization: `Bearer opg_${'ab'.repeat(32)}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      })
    )
    expect(response.status).toBe(401)
  })

  test('refuses a token it does not know, as it refuses none', async () => {
    const response = await fixture.app.fetch(
      new Request(resource, {
        method: 'POST',
        headers: { Authorization: 'Bearer opa_unknown', 'Content-Type': 'application/json' },
        body: '{}'
      })
    )
    expect(response.status).toBe(401)
  })

  test("lists the document tools and Core's design tools to an app with a token for it", async () => {
    await withClient(appToken, async (client) => {
      const names = (await client.listTools()).tools.map((tool) => tool.name)
      expect(names).toEqual(expect.arrayContaining(['list_documents', 'create_document']))
      expect(names).toEqual(expect.arrayContaining(['get_page_tree', 'render', 'update_node']))
      expect(names).not.toContain('eval')
    })
  })

  test("creates and lists documents in the app's workspace, with links to open them", async () => {
    await withClient(appToken, async (client) => {
      const created = json(
        await client.callTool({ name: 'create_document', arguments: { name: 'Landing' } }),
        documentSchema
      )
      expect(created.document.url).toBe(`${config.publicURL}/documents/${created.document.id}`)
      // Nobody has saved it yet: it has a summary for the editor to open it by, and no file.
      const summary = await oauth.send(`/api/documents/${created.document.id}/summary`, {
        token: appToken
      })
      expect(
        (
          await responseJSON(
            summary,
            v.object({ document: v.object({ currentRevisionId: v.null() }) })
          )
        ).document.currentRevisionId
      ).toBeNull()
      expect(
        (await oauth.send(`/api/documents/${created.document.id}`, { token: appToken })).status
      ).toBe(404)
      const listed = text(
        await client.callTool({ name: 'list_documents', arguments: { query: 'land' } })
      )
      expect(listed).toContain(created.document.id)
      const elsewhere = await client.callTool({
        name: 'list_documents',
        arguments: { workspace_id: other }
      })
      expect(elsewhere.isError).toBe(true)
      expect(text(elsewhere)).toContain('Not found')
    })
  })

  test('runs a design tool through the editor of the person who connected the app', async () => {
    await withClient(appToken, async (client) => {
      const created = json(
        await client.callTool({ name: 'create_document', arguments: { name: 'Design' } }),
        documentSchema
      )
      calls.length = 0
      answer = { ok: true, result: { id: '1:2', name: 'Frame' } }
      const result = await client.callTool({
        name: 'update_node',
        arguments: { document_id: created.document.id, page_id: '0:1', id: '1:2', name: 'Frame' }
      })
      expect(json(result, v.unknown())).toEqual({ id: '1:2', name: 'Frame' })
      expect(calls).toEqual([
        {
          documentId: created.document.id,
          userId: person.userId,
          call: {
            name: 'update_node',
            args: { page_id: '0:1', id: '1:2', name: 'Frame' },
            agent: { session: expect.stringMatching(/^app:/), client: 'Example app' }
          }
        }
      ])

      answer = { ok: false, failure: 'editor_not_open' }
      const closed = await client.callTool({
        name: 'get_page_tree',
        arguments: { document_id: created.document.id }
      })
      expect(closed.isError).toBe(true)
      expect(text(closed)).toContain(created.document.url)

      answer = { ok: false, failure: 'tool_failed', message: 'Node 9:9 not found' }
      const failed = await client.callTool({
        name: 'get_node',
        arguments: { document_id: created.document.id, id: '9:9' }
      })
      expect(failed.isError).toBe(true)
      expect(text(failed)).toBe('Node 9:9 not found')
    })
  })

  test("never reaches documents outside the app's workspace", async () => {
    const outside = await oauth.send(`/api/workspaces/${other}/documents`, {
      body: { name: 'Private' },
      cookie: person.sessionCookie
    })
    const { document } = await responseJSON(
      outside,
      v.object({ document: v.object({ id: v.string() }) })
    )
    calls.length = 0
    await withClient(appToken, async (client) => {
      const result = await client.callTool({
        name: 'get_page_tree',
        arguments: { document_id: document.id }
      })
      expect(result.isError).toBe(true)
      expect(text(result)).toContain('Not found')
    })
    expect(calls).toEqual([])
  })

  test('lists only reading tools to a token that may only read', async () => {
    await withClient(await personalToken('read'), async (client) => {
      const names = (await client.listTools()).tools.map((tool) => tool.name)
      expect(names).toEqual(
        expect.arrayContaining(['list_workspaces', 'list_documents', 'get_page_tree'])
      )
      expect(names).not.toContain('create_document')
      expect(names).not.toContain('render')
    })
  })
})
