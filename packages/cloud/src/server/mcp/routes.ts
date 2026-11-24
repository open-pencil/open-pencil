import {
  agentPairingId,
  CLOUD_MCP_PATH,
  CLOUD_PROTOCOL_VERSION,
  cloudMCPResource,
  cloudTokenScopeSchema,
  isAgentPairingToken,
  type AgentToolCall,
  type AgentToolOutcome
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import { resourceChallenge } from '#cloud/server/oauth'
import {
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  createMcpHandler as createMCPHandler,
  McpServer,
  type AuthInfo
} from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as v from 'valibot'

import { createMCPAPIRequest } from './api'
import type { MCPCaller } from './context'
import { registerDesignTools, registerPairedDesignTools } from './design'
import { registerDocumentTools } from './documents'

/** What the endpoint tells a client about its tools when it connects. */
const INSTRUCTIONS = [
  'OpenPencil Cloud keeps design documents in workspaces; these tools manage them and work on their designs.',
  'Find documents with list_documents. Design tools such as get_page_tree, render, and update_node take a document_id and run in OpenPencil where the person has that document open; when none has it open, give the person its link and ask them to open it.',
  'Edits made through these tools are the person’s own, so they appear for everyone in the document and can be undone there.'
].join('\n')

/** What the endpoint tells an agent paired with an editor tab, which has no account behind it. */
const PAIRED_INSTRUCTIONS = [
  'These tools work on the design open in the OpenPencil tab this connection is paired with, as the person watches.',
  'Read with get_page_tree, get_node, and describe; build layers from JSX with render, and change them with update_node and the set_* tools.',
  'The design stays in that tab until the person saves it; nothing is kept on the server.'
].join('\n')

/** Who the token stands for, as the document API answers `/api/session` for it. */
const sessionSchema = v.object({
  user: v.object({
    credential: v.picklist(['token', 'app']),
    scopes: v.array(cloudTokenScopeSchema),
    grant: v.optional(v.object({ clientId: v.string(), workspaceId: v.string() }))
  })
})

const BEARER = /^Bearer\s+(\S+)$/i

export type MCPRouteDependencies = {
  publicURL: string
  /** The server itself, which each tool calls with the request's token. */
  fetchAPI: (request: Request) => Response | Promise<Response>
  /** Whether apps connect through OAuth, so a request without a token learns where to sign in. */
  oauth: boolean
  /**
   * Runs a design tool in the editor tab paired with an agent, where the server pairs tabs; pairing
   * tokens are refused without it.
   */
  callPairedTool?: (pairingId: string, call: AgentToolCall) => Promise<AgentToolOutcome>
  onError?: (error: Error) => void
}

/**
 * The MCP endpoint (Streamable HTTP, stateless) for apps people connect, such as ChatGPT, Claude,
 * and Grok, and for scripts with a personal access token. It holds no state between requests and
 * no rights of its own: every tool is a request to the document API with the caller's token.
 */
export function createMCPRoutes(dependencies: MCPRouteDependencies) {
  const { publicURL } = dependencies
  const unauthorized = () => {
    const challenge = dependencies.oauth
      ? resourceChallenge(publicURL, undefined, cloudMCPResource(publicURL))
      : null
    return Response.json(
      { error: { code: 'unauthorized' as const } },
      { status: 401, headers: challenge ? { 'WWW-Authenticate': challenge } : {} }
    )
  }
  const handler = createMCPHandler(
    ({ authInfo }) => {
      const server = new McpServer(
        { name: 'OpenPencil Cloud', version: CLOUD_PROTOCOL_VERSION },
        { instructions: INSTRUCTIONS }
      )
      if (!authInfo) return server
      const pairing = v.safeParse(v.string(), authInfo.extra?.pairing)
      const callPaired = dependencies.callPairedTool
      if (pairing.success && callPaired) {
        const paired = new McpServer(
          { name: 'OpenPencil', version: CLOUD_PROTOCOL_VERSION },
          { instructions: PAIRED_INSTRUCTIONS }
        )
        registerPairedDesignTools(paired, (call) =>
          callPaired(pairing.output, {
            ...call,
            agent: { session: `pairing:${pairing.output.slice(0, 16)}` }
          })
        )
        return paired
      }
      const workspaceId = v.safeParse(v.string(), authInfo.extra?.workspaceId)
      const caller: MCPCaller = {
        api: createMCPAPIRequest(dependencies.fetchAPI, publicURL, `Bearer ${authInfo.token}`),
        publicURL,
        scopes: v.parse(v.array(cloudTokenScopeSchema), authInfo.scopes),
        ...(workspaceId.success ? { workspaceId: workspaceId.output } : {})
      }
      registerDocumentTools(server, caller)
      registerDesignTools(server, caller)
      return server
    },
    { onerror: dependencies.onError }
  )

  return new Hono<CloudAPIEnvironment>()
    .use(
      CLOUD_MCP_PATH,
      // Clients in a browser send the token themselves; no cookie ever reaches the endpoint.
      cors({
        origin: '*',
        allowHeaders: ['Authorization', 'Content-Type', 'Mcp-Protocol-Version', 'Mcp-Session-Id'],
        exposeHeaders: ['WWW-Authenticate', 'Mcp-Session-Id']
      })
    )
    .all(CLOUD_MCP_PATH, async (context) => {
      const authorization = context.req.header('authorization')
      const token = authorization?.match(BEARER)?.[1]
      if (!authorization || !token) return unauthorized()
      // A pairing token names an editor tab, not an account: it reaches that tab's design alone.
      if (isAgentPairingToken(token)) {
        if (!dependencies.callPairedTool) return unauthorized()
        const pairingInfo: AuthInfo = {
          token,
          clientId: 'agent-pairing',
          scopes: [],
          extra: { pairing: await agentPairingId(token) }
        }
        return handler.fetch(context.req.raw, { authInfo: pairingInfo })
      }
      const { status, body } = await createMCPAPIRequest(
        dependencies.fetchAPI,
        publicURL,
        authorization
      )('GET', '/api/session')
      const session = v.safeParse(sessionSchema, body)
      if (status !== 200 || !session.success) return unauthorized()
      const { grant, scopes } = session.output.user
      const authInfo: AuthInfo = {
        token,
        clientId: grant?.clientId ?? 'personal-access-token',
        scopes: [...scopes],
        ...(grant ? { extra: { workspaceId: grant.workspaceId } } : {})
      }
      return handler.fetch(context.req.raw, { authInfo })
    })
}
