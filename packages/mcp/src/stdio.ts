#!/usr/bin/env node
/**
 * Verso MCP server — stdio transport for Claude Code.
 *
 * Env: APP_URL=http://host:port  →  forward browser tools via app's /rpc endpoint.
 *      Defaults to http://127.0.0.1:7600 (the app's built-in MCP HTTP server).
 *
 * Registers:
 *  - All OpenPencil tools (browser-dependent, need running app + open document)
 *  - Verso tools: get_design_context, suggest_structure,
 *    get_design_guidelines, validate_design, save_as_design, get_codegen_prompt
 *  - Verso prompts: design-page, design-system, refine-design
 *  - Verso resource: design://guidelines
 */
import { createRequire } from 'node:module'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import {
  ALL_TOOLS,
  buildComponent,
  createElement,
  resolveToTree,
} from '@verso/core'

import type { ParamDef, ParamType } from '@verso/core'

import { ok, fail, registerVersoTools } from './verso-tools'

const require = createRequire(import.meta.url)
const MCP_VERSION: string = (require('../package.json') as { version: string }).version

const RPC_TIMEOUT = 30_000

function paramToZod(param: ParamDef): z.ZodType {
  const typeMap: Record<ParamType, () => z.ZodType> = {
    string: () =>
      param.enum
        ? z.enum(param.enum as [string, ...string[]]).describe(param.description)
        : z.string().describe(param.description),
    number: () => {
      let s = z.number()
      if (param.min !== undefined) s = s.min(param.min)
      if (param.max !== undefined) s = s.max(param.max)
      return s.describe(param.description)
    },
    boolean: () => z.boolean().describe(param.description),
    color: () => z.string().describe(param.description),
    'string[]': () => z.array(z.string()).min(1).describe(param.description)
  }

  const schema = typeMap[param.type]()
  return param.required ? schema : schema.optional()
}

// ---------------------------------------------------------------------------
// App HTTP bridge — forwards browser-dependent tool calls to the app's /rpc
// endpoint (server.ts on APP_URL, default http://127.0.0.1:7600).
// The app owns the browser WSS; we just call its HTTP API.
// Without APP_URL, Verso-only tools work; browser-dependent tools error.
// ---------------------------------------------------------------------------

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:7600'
let cachedToken: string | null = null

async function fetchAppToken(): Promise<string> {
  const res = await fetch(`${appUrl}/health`)
  if (!res.ok) throw new Error(`App health check failed: ${res.status}`)
  const data = await res.json() as { status: string; token?: string }
  if (data.status !== 'ok' || !data.token) {
    throw new Error('App is running but no browser is connected. Open a document in the browser.')
  }
  return data.token
}

async function sendToBrowser(body: Record<string, unknown>): Promise<unknown> {
  // Get or refresh the auth token from the app
  if (!cachedToken) {
    cachedToken = await fetchAppToken()
  }

  const doRequest = async (token: string) => {
    const res = await fetch(`${appUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })
    if (res.status === 401) {
      // Token expired (browser reconnected), refresh once
      return null
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`App RPC error ${res.status}: ${text}`)
    }
    return res.json()
  }

  // Try with cached token, refresh once on 401
  let result = await doRequest(cachedToken)
  if (result === null) {
    cachedToken = await fetchAppToken()
    result = await doRequest(cachedToken)
    if (result === null) throw new Error('Unauthorized after token refresh')
  }
  return result
}

// JSX preprocessing (same as HTTP server)
function preprocessRpc(body: Record<string, unknown>): Record<string, unknown> {
  if (body.command !== 'tool') return body
  const args = body.args as { name?: string; args?: Record<string, unknown> } | undefined
  if (args?.name !== 'render' || !args.args?.jsx) return body
  try {
    const Component = buildComponent(args.args.jsx as string)
    const element = createElement(Component, null)
    const tree = resolveToTree(element)
    return { ...body, args: { ...args, args: { ...args.args, jsx: undefined, tree } } }
  } catch {
    return body
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const mcpServer = new McpServer({ name: 'verso', version: MCP_VERSION })
const register = mcpServer.registerTool.bind(mcpServer) as (...a: unknown[]) => void

// --- OpenPencil tools (87 tools, browser-dependent) ---

for (const def of ALL_TOOLS) {
  if (def.name === 'eval') continue
  const shape: Record<string, z.ZodType> = {}
  for (const [key, param] of Object.entries(def.params)) {
    shape[key] = paramToZod(param)
  }
  register(
    def.name,
    { description: def.description, inputSchema: z.object(shape) },
    async (args: Record<string, unknown>) => {
      try {
        const body = preprocessRpc({ command: 'tool', args: { name: def.name, args } })
        const result = await sendToBrowser(body)
        const res = result as { ok?: boolean; result?: unknown; error?: string }
        if (res.ok === false) return fail(new Error(res.error))
        const r = res.result as Record<string, unknown> | undefined
        if (r && 'base64' in r && 'mimeType' in r) {
          return { content: [{ type: 'image' as const, data: r.base64 as string, mimeType: r.mimeType as string }] }
        }
        return ok(r)
      } catch (e) { return fail(e) }
    }
  )
}

// --- Verso tools, prompts & resource (shared module) ---
registerVersoTools({ register, sendToBrowser, mcpServer })

// ---------------------------------------------------------------------------
// Connect via stdio
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()
await mcpServer.connect(transport)

process.stderr.write(`Verso MCP server (stdio) v${MCP_VERSION}\n`)
process.stderr.write(`  App bridge: ${appUrl}\n`)
process.stderr.write(`  Tools: ${ALL_TOOLS.length} OpenPencil + 6 Verso\n`)
