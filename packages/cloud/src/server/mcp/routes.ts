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

import { createMCPAPI, MCPAPIError, type MCPAPI } from './api'
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
  'These tools work on the documents open in the OpenPencil this connection is paired with, as the person watches. With none open, call create_document.',
  'Read with get_page_tree, get_node, and describe; build layers from JSX with render, and change them with update_node and the set_* tools.',
  'Designs stay on the person’s device until they save them; nothing is kept on the server.'
].join('\n')

/** Whom a token stands for and what it may do, or null for one the API refuses. */
async function tokenUser(api: MCPAPI) {
  try {
    const { user } = await api.session.session()
    const { credential, scopes, grant } = user
    if ((credential !== 'token' && credential !== 'app') || !scopes) return null
    return { scopes, grant }
  } catch (error) {
    if (error instanceof MCPAPIError && (error.status === 401 || error.status === 403)) return null
    throw error
  }
}

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
        api: createMCPAPI(dependencies.fetchAPI, publicURL, `Bearer ${authInfo.token}`),
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
      const user = await tokenUser(createMCPAPI(dependencies.fetchAPI, publicURL, authorization))
      if (!user) return unauthorized()
      const { grant, scopes } = user
      const authInfo: AuthInfo = {
        token,
        clientId: grant?.clientId ?? 'personal-access-token',
        scopes: [...scopes],
        ...(grant ? { extra: { workspaceId: grant.workspaceId } } : {})
      }
      return handler.fetch(context.req.raw, { authInfo })
    })
}
