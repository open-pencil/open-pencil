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

function ok(data: unknown): MCPResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(e: unknown): MCPResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

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

// --- Verso-specific tools ---

register(
  'get_design_context',
  {
    description: 'Get assembled design context from the 4-layer Design Context Engine. Returns universal principles, trend patterns, reference designs, and task-specific templates.',
    inputSchema: z.object({
      scope: z.enum(['full', 'typography', 'colors', 'spacing', 'components', 'accessibility']).optional().describe('Filter context by design domain'),
      taskDescription: z.string().optional().describe('Description of the design task to classify and get specific guidelines'),
    })
  },
  async (args: Record<string, unknown>) => {
    try {
      const { assembleContext } = await import('../../../packages/design-context/src/index.ts')
      const { classifyTask } = await import('../../../packages/design-context/src/classifier.ts')

      const taskDescription = args.taskDescription as string | undefined
      const scope = args.scope as string | undefined

      // Map scope to universalCategories filter
      const universalCategories = scope && scope !== 'full' ? [scope] : undefined

      // Classify task description to get the right template
      const taskType = taskDescription ? classifyTask(taskDescription) : undefined

      const context = assembleContext({
        universalCategories,
        taskType,
      })
      return ok({ ...context, classifiedTaskType: taskType ?? null })
    } catch (e) { return fail(e) }
  }
)

register(
  'validate_design',
  {
    description: 'Validate the current design for accessibility, spacing consistency, touch targets, and hardcoded values. Returns issues with severity and suggestions.',
    inputSchema: z.object({
      nodeId: z.string().optional().describe('Validate a specific node. If omitted, validates the entire page.'),
    })
  },
  async (args: Record<string, unknown>) => {
    try {
      const result = await sendToBrowser({ command: 'tool', args: { name: 'get_page_tree', args: {} } })
      const res = result as { ok?: boolean; result?: unknown }
      if (!res.result) return fail(new Error('No design data available'))

      const { validateDesign } = await import('../../../packages/design-context/src/validator.ts')
      const nodes = Array.isArray(res.result) ? res.result : [res.result]
      const issues = validateDesign(nodes)

      return ok({
        message: 'Design validation complete',
        nodeId: args.nodeId ?? null,
        issueCount: issues.length,
        issues,
      })
    } catch (e) { return fail(e) }
  }
)

register(
  'get_design_guidelines',
  {
    description: 'Get universal design principles (Layer 1): visual hierarchy, Gestalt laws, typography, color theory, spacing, accessibility, psychology, composition.',
    inputSchema: z.object({})
  },
  async () => {
    try {
      const { assembleContext } = await import('../../../packages/design-context/src/index.ts')
      const context = assembleContext()
      return ok({ universal: context.universal })
    } catch (e) { return fail(e) }
  }
)

register(
  'suggest_structure',
  {
    description: 'Get a suggested node tree structure for a design task. Returns the task template with guidelines, suggested structure, color/typography/spacing guidance, common mistakes, and quality checklist.',
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
    description: 'Export the current document as a .design file (Verso native JSON format).',
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
    description: 'Get pixel-precise JSX component templates from the Verso UI Kit. Call BEFORE any render call to get the exact component specs.',
    inputSchema: z.object({
      components: z.array(z.string()).optional().describe('Specific components to get. If omitted, returns ALL specs.'),
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

register(
  'get_codegen_prompt',
  {
    description: 'Get design-to-code generation guidelines. Call before generating frontend code.',
    inputSchema: z.object({})
  },
  async () => ok({ prompt: CODEGEN_PROMPT })
)

// --- Verso Prompts (shared from verso-prompts.ts) ---

import { designPagePrompt, designSystemPrompt, refineDesignPrompt } from './verso-prompts.ts'

mcpServer.prompt(designPagePrompt.name, designPagePrompt.description, designPagePrompt.params,
  (args: Record<string, unknown>) => designPagePrompt.handler(args))

mcpServer.prompt(designSystemPrompt.name, designSystemPrompt.description, designSystemPrompt.params,
  (args: Record<string, unknown>) => designSystemPrompt.handler(args))

mcpServer.prompt(refineDesignPrompt.name, refineDesignPrompt.description, refineDesignPrompt.params,
  (args: Record<string, unknown>) => refineDesignPrompt.handler(args))

// --- Verso Resource ---

mcpServer.resource(
  'design-guidelines',
  'design://guidelines',
  { mimeType: 'application/json', description: 'Universal design principles from the Design Context Engine (Layer 1)' },
  async () => {
    try {
      const { assembleContext } = await import('../../../packages/design-context/src/index.ts')
      const ctx = assembleContext()
      return { contents: [{ uri: 'design://guidelines', mimeType: 'application/json', text: JSON.stringify(ctx.universal, null, 2) }] }
    } catch {
      return { contents: [{ uri: 'design://guidelines', mimeType: 'application/json', text: '{}' }] }
    }
  }
)

// ---------------------------------------------------------------------------
// Connect via stdio
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()
await mcpServer.connect(transport)

process.stderr.write(`Verso MCP server (stdio) v${MCP_VERSION}\n`)
process.stderr.write(`  App bridge: ${appUrl}\n`)
process.stderr.write(`  Tools: ${ALL_TOOLS.length} OpenPencil + 6 Verso\n`)
