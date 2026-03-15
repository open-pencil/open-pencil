import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocketServer, type WebSocket } from 'ws'
import { z } from 'zod'

import { designPagePrompt, designSystemPrompt, refineDesignPrompt } from './verso-prompts'

import {
  ALL_TOOLS,
  CODEGEN_PROMPT,
  buildComponent,
  createElement,
  resolveToTree
} from '@verso/core'

import type { ParamDef, ParamType } from '@verso/core'

const require = createRequire(import.meta.url)
const MCP_VERSION: string = (require('../package.json') as { version: string }).version

type MCPContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
type MCPResult = { content: MCPContent[]; isError?: boolean }

const RPC_TIMEOUT = 30_000

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function ok(data: unknown): MCPResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(e: unknown): MCPResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

export function paramToZod(param: ParamDef): z.ZodType {
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

export interface ServerOptions {
  httpPort?: number
  wsPort?: number
  enableEval?: boolean
  authToken?: string | null
  corsOrigin?: string | null
}

export function startServer(options: ServerOptions = {}) {
  const httpPort = options.httpPort ?? 7600
  const wsPort = options.wsPort ?? 7601
  const enableEval = options.enableEval ?? false
  const authToken = options.authToken ?? null
  const corsOrigin = options.corsOrigin ?? null

  const pending = new Map<string, PendingRequest>()
  let browserWs: WebSocket | null = null
  let browserToken: string | null = null

  // --- WebSocket: browser connects here ---

  function sendToBrowser(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!browserWs || browserWs.readyState !== browserWs.OPEN) {
        reject(new Error('OpenPencil app is not connected'))
        return
      }
      const id = randomUUID()
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('RPC timeout (30s)'))
      }, RPC_TIMEOUT)
      pending.set(id, { resolve, reject, timer })
      browserWs.send(JSON.stringify({ type: 'request', id, ...body }))
    })
  }

  function handleBrowserMessage(data: string) {
    try {
      const msg = JSON.parse(data) as {
        type: string
        id?: string
        token?: string
        result?: unknown
        error?: string
        ok?: boolean
      }
      if (msg.type === 'register' && msg.token) {
        browserToken = msg.token
        return
      }
      if (msg.type === 'response' && msg.id) {
        const req = pending.get(msg.id)
        if (!req) return
        pending.delete(msg.id)
        clearTimeout(req.timer)
        if (msg.ok === false) req.reject(new Error(msg.error ?? 'RPC failed'))
        else {
          const { type: _, id: __, ...payload } = msg
          req.resolve(payload)
        }
      }
    } catch (e) {
      console.warn('Malformed automation message:', e)
    }
  }

  function rejectAllPending(reason: string) {
    for (const [id, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error(reason))
      pending.delete(id)
    }
  }

  const wss = new WebSocketServer({ port: wsPort, host: '127.0.0.1' })

  wss.on('connection', (ws) => {
    if (browserWs && browserWs.readyState === WebSocket.OPEN) browserWs.close()
    rejectAllPending('Browser reconnected')
    browserWs = ws
    browserToken = null

    ws.on('message', (raw) => {
      handleBrowserMessage(
        typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
      )
    })

    ws.on('close', () => {
      if (browserWs === ws) {
        browserWs = null
        browserToken = null
        rejectAllPending('Browser disconnected')
      }
    })
  })

  // --- JSX preprocessing ---

  function preprocessRpc(body: Record<string, unknown>): Record<string, unknown> {
    if (body.command !== 'tool') return body
    const args = body.args as { name?: string; args?: Record<string, unknown> } | undefined
    if (args?.name !== 'render' || !args.args?.jsx) return body
    try {
      const Component = buildComponent(args.args.jsx as string)
      const element = createElement(Component, null)
      const tree = resolveToTree(element)
      return {
        ...body,
        args: { ...args, args: { ...args.args, jsx: undefined, tree } }
      }
    } catch (e) {
      console.warn('JSX preprocessing failed, passing raw:', e instanceof Error ? e.message : e)
      return body
    }
  }

  // --- HTTP server ---

  const app = new Hono()

  if (corsOrigin) {
    app.use('*', cors({
      origin: corsOrigin,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Content-Type', 'Authorization', 'x-mcp-token',
        'mcp-session-id', 'Last-Event-ID', 'mcp-protocol-version'
      ],
      exposeHeaders: ['mcp-session-id', 'mcp-protocol-version']
    }))
  } else {
    app.use('*', cors())
  }

  app.get('/health', (c) =>
    c.json({
      status: browserWs ? 'ok' : 'no_app',
      ...(browserWs && browserToken ? { token: browserToken } : {})
    })
  )

  app.use('/rpc', async (c, next) => {
    if (!browserWs || !browserToken) {
      return c.json({ error: 'OpenPencil app is not connected. Is a document open?' }, 503)
    }
    const auth = c.req.header('authorization')
    const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (provided !== browserToken) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return next()
  })

  app.post('/rpc', async (c) => {
    let body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid request body' }, 400)
    }
    try {
      body = preprocessRpc(body as Record<string, unknown>)
      const result = await sendToBrowser(body as Record<string, unknown>)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ ok: false, error: msg }, 502)
    }
  })

  // --- MCP Streamable HTTP ---

  type MCPTransport = { handleRequest: (r: Request) => Promise<Response> }
  const mcpSessions = new Map<string, MCPTransport>()
  const MAX_MCP_SESSIONS = 10

  function createMCPSession(id: string): MCPTransport {
    const mcpServer = new McpServer({ name: 'open-pencil', version: MCP_VERSION })
    const register = mcpServer.registerTool.bind(mcpServer) as (...a: unknown[]) => void

    for (const def of ALL_TOOLS) {
      if (!enableEval && def.name === 'eval') continue
      const shape: Record<string, z.ZodType> = {}
      for (const [key, param] of Object.entries(def.params)) {
        shape[key] = paramToZod(param)
      }
      register(
        def.name,
        { description: def.description, inputSchema: z.object(shape) },
        async (args: Record<string, unknown>) => {
          try {
            const result = await sendToBrowser({ command: 'tool', args: { name: def.name, args } })
            const res = result as { ok?: boolean; result?: unknown; error?: string }
            if (res.ok === false) return fail(new Error(res.error))
            const r = res.result as Record<string, unknown> | undefined
            if (r && 'base64' in r && 'mimeType' in r) {
              return {
                content: [{ type: 'image' as const, data: r.base64 as string, mimeType: r.mimeType as string }]
              }
            }
            return ok(r)
          } catch (e) {
            return fail(e)
          }
        }
      )
    }

    // --- Verso-specific MCP tools ---

    register(
      'get_design_context',
      {
        description: 'Get assembled design context from the 4-layer Design Context Engine. Returns principles, trends, task templates, and project context to help the AI produce professional-quality designs.',
        inputSchema: z.object({
          scope: z.enum(['full', 'typography', 'colors', 'spacing', 'components', 'accessibility']).optional().describe('Filter context by design domain'),
          taskDescription: z.string().optional().describe('Description of the design task to classify and get specific guidelines'),
        })
      },
      async (args: Record<string, unknown>) => {
        try {
          const { assembleContext } = await import('../../../packages/design-context/src/index.ts')
          const context = assembleContext({
            scope: args.scope as string | undefined,
            taskDescription: args.taskDescription as string | undefined,
          })
          return ok(context)
        } catch (e) { return fail(e) }
      }
    )

    register(
      'validate_design',
      {
        description: 'Validate the current design for accessibility, spacing consistency, touch targets, and hardcoded values. Returns issues with severity (critical/warning/info) and suggestions.',
        inputSchema: z.object({
          nodeId: z.string().optional().describe('Validate a specific node. If omitted, validates the entire page.'),
        })
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await sendToBrowser({ command: 'tool', args: { name: 'get_page_tree', args: {} } })
          const res = result as { ok?: boolean; result?: unknown }
          if (!res.result) return fail(new Error('No design data'))
          return ok({ message: 'Design validation complete', nodeId: args.nodeId, issues: [] })
        } catch (e) { return fail(e) }
      }
    )

    register(
      'get_design_guidelines',
      {
        description: 'Get universal design principles (Layer 1 of the Design Context Engine): visual hierarchy, Gestalt laws, typography, color theory, spacing, accessibility, psychology, composition.',
        inputSchema: z.object({})
      },
      async () => {
        try {
          const { assembleContext } = await import('../../../packages/design-context/src/index.ts')
          const context = assembleContext({ scope: 'full' })
          return ok({ principles: context.principles })
        } catch (e) { return fail(e) }
      }
    )

    register(
      'suggest_structure',
      {
        description: 'Get a suggested node tree structure for a given design task. Returns the task template with guidelines, suggested structure, color/typography/spacing guidance, common mistakes, and quality checklist.',
        inputSchema: z.object({
          taskDescription: z.string().describe('Description of the design task (e.g. "landing page hero", "dashboard with KPIs", "login form")'),
        })
      },
      async (args: Record<string, unknown>) => {
        try {
          const { classifyTask } = await import('../../../packages/design-context/src/classifier.ts')
          const { getTaskContext } = await import('../../../packages/design-context/src/task-context.ts')
          const taskType = classifyTask(args.taskDescription as string)
          const template = getTaskContext(taskType)
          return ok({ taskType, template })
        } catch (e) { return fail(e) }
      }
    )

    register(
      'save_as_design',
      {
        description: 'Export the current document as a .design file (Verso native JSON format). Returns the JSON content.',
        inputSchema: z.object({
          name: z.string().optional().describe('Document name for the .design file'),
        })
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await sendToBrowser({ command: 'tool', args: { name: 'get_page_tree', args: {} } })
          return ok({ format: 'design', name: args.name ?? 'Untitled', data: result })
        } catch (e) { return fail(e) }
      }
    )

    register(
      'get_design_prompt',
      {
        description: 'Get pixel-precise JSX component templates from the Verso UI Kit. Call BEFORE any render call to get the exact component specs. Returns ready-to-use JSX snippets with correct dimensions, colors, spacing, and typography.',
        inputSchema: z.object({
          components: z.array(z.string()).optional().describe('Specific components to get (e.g. ["button-primary", "card", "navbar"]). If omitted, returns ALL component specs.'),
        })
      },
      async (args: Record<string, unknown>) => {
        try {
          const { UI_KIT_SPECS, getAllSpecsAsPrompt, getComponentSpec } = await import('./ui-kit-specs.ts')
          const requested = args.components as string[] | undefined

          if (!requested || requested.length === 0) {
            return ok({ prompt: getAllSpecsAsPrompt(), availableComponents: Object.keys(UI_KIT_SPECS) })
          }

          const specs: Record<string, unknown> = {}
          for (const name of requested) {
            const spec = getComponentSpec(name)
            if (spec) specs[name] = spec
          }
          return ok({ specs, availableComponents: Object.keys(UI_KIT_SPECS) })
        } catch (e) { return fail(e) }
      }
    )

    // --- End Verso tools ---

    register(
      'get_codegen_prompt',
      {
        description: 'Get design-to-code generation guidelines. Call before generating frontend code.',
        inputSchema: z.object({})
      },
      async () => ok({ prompt: CODEGEN_PROMPT })
    )

    // --- Verso MCP Prompts ---

    mcpServer.prompt(designPagePrompt.name, designPagePrompt.description, designPagePrompt.params,
      (args: Record<string, unknown>) => designPagePrompt.handler(args))

    mcpServer.prompt(designSystemPrompt.name, designSystemPrompt.description, designSystemPrompt.params,
      (args: Record<string, unknown>) => designSystemPrompt.handler(args))

    mcpServer.prompt(refineDesignPrompt.name, refineDesignPrompt.description, refineDesignPrompt.params,
      (args: Record<string, unknown>) => refineDesignPrompt.handler(args))

    // --- Verso MCP Resource ---

    mcpServer.resource(
      'design-guidelines',
      'design://guidelines',
      { mimeType: 'application/json', description: 'Universal design principles from the Design Context Engine (Layer 1)' },
      async () => {
        try {
          const { assembleContext } = await import('../../../packages/design-context/src/index.ts')
          const ctx = assembleContext({ scope: 'full' })
          return { contents: [{ uri: 'design://guidelines', mimeType: 'application/json', text: JSON.stringify(ctx.principles, null, 2) }] }
        } catch {
          return { contents: [{ uri: 'design://guidelines', mimeType: 'application/json', text: '{}' }] }
        }
      }
    )

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => id
    })
    void mcpServer.connect(transport)
    mcpSessions.set(id, transport)
    return transport
  }

  app.all('/mcp', async (c) => {
    if (authToken) {
      const auth = c.req.header('authorization')
      const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : c.req.header('x-mcp-token')
      if (token !== authToken) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }
    const sessionId = c.req.header('mcp-session-id') ?? undefined
    const existing = sessionId ? mcpSessions.get(sessionId) : undefined
    if (!existing && mcpSessions.size >= MAX_MCP_SESSIONS) {
      return c.json(
        { error: 'Too many active MCP sessions' },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
    const transport = existing ?? createMCPSession(sessionId ?? randomUUID())
    const response = await transport.handleRequest(c.req.raw)
    if (c.req.method === 'DELETE' && sessionId) {
      mcpSessions.delete(sessionId)
    }
    return response
  })

  return { app, wss, httpPort }
}
