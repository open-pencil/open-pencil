/**
 * Verso-specific MCP tools — shared between server.ts (HTTP) and stdio.ts (stdio).
 *
 * Extracts all Verso tool registrations into a single module to avoid duplication.
 * Each transport calls `registerVersoTools()` with its own `sendToBrowser` function.
 */

import { z } from 'zod'
import { CODEGEN_PROMPT } from '@verso/core'

import { designPagePrompt, designSystemPrompt, refineDesignPrompt } from './verso-prompts'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type MCPContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
export type MCPResult = { content: MCPContent[]; isError?: boolean }

export function ok(data: unknown): MCPResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function fail(e: unknown): MCPResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

type RegisterFn = (...args: unknown[]) => void
type SendToBrowserFn = (body: Record<string, unknown>) => Promise<unknown>

interface McpServerLike {
  prompt: (...args: unknown[]) => void
  resource: (...args: unknown[]) => void
}

export interface RegisterVersoToolsOptions {
  register: RegisterFn
  sendToBrowser: SendToBrowserFn
  mcpServer: McpServerLike
}

/**
 * Register all Verso-specific MCP tools, prompts, and resources on a server.
 */
export function registerVersoTools({ register, sendToBrowser, mcpServer }: RegisterVersoToolsOptions): void {
  // --- get_design_context ---
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

        const universalCategories = scope && scope !== 'full' ? [scope] : undefined
        const taskType = taskDescription ? classifyTask(taskDescription) : undefined

        const context = assembleContext({
          universalCategories,
          taskType,
        })
        return ok({ ...context, classifiedTaskType: taskType ?? null })
      } catch (e) { return fail(e) }
    }
  )

  // --- validate_design ---
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

  // --- get_design_guidelines ---
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

  // --- suggest_structure ---
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

  // --- save_as_design ---
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

  // --- get_design_prompt ---
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

  // --- get_codegen_prompt ---
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
        const ctx = assembleContext()
        return { contents: [{ uri: 'design://guidelines', mimeType: 'application/json', text: JSON.stringify(ctx.universal, null, 2) }] }
      } catch {
        return { contents: [{ uri: 'design://guidelines', mimeType: 'application/json', text: '{}' }] }
      }
    }
  )
}
