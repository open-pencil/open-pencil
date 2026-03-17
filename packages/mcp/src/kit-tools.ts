/**
 * UI Kit MCP tools — 5 tools for browsing, querying, and using UI Kit components.
 *
 * These tools read from the design-kits/ directory and are registered
 * alongside the other Verso tools in verso-tools.ts.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { KitMeta, KitRegistry, KitComponent, KitTokens } from '../../../packages/format/src/kit-schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KITS_ROOT = resolve(__dirname, '../../../design-kits')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function loadRegistry(): KitRegistry {
  const registryPath = resolve(KITS_ROOT, 'registry.json')
  if (!existsSync(registryPath)) return { version: '1.0.0', kits: [] }
  return readJSON<KitRegistry>(registryPath)
}

function loadKitMeta(kitName: string): KitMeta | null {
  const kitPath = resolve(KITS_ROOT, 'installed', kitName, 'kit.json')
  if (!existsSync(kitPath)) return null
  return readJSON<KitMeta>(kitPath)
}

function loadKitTokens(kitName: string): KitTokens | null {
  const meta = loadKitMeta(kitName)
  if (!meta) return null
  const tokensPath = resolve(KITS_ROOT, 'installed', kitName, meta.tokens)
  if (!existsSync(tokensPath)) return null
  return readJSON<KitTokens>(tokensPath)
}

function loadComponentDesign(kitName: string, componentFile: string): Record<string, unknown> | null {
  const filePath = resolve(KITS_ROOT, 'installed', kitName, componentFile)
  if (!existsSync(filePath)) return null
  return readJSON<Record<string, unknown>>(filePath)
}

/**
 * Map TaskType (from classifier) to relevant usageContext keywords.
 */
const TASK_TO_CONTEXT: Record<string, string[]> = {
  'landing-hero': ['landing-hero', 'page-hero', 'hero-cta', 'landing-nav', 'landing-footer', 'page-cta', 'feature-grid', 'logo-bar', 'testimonial-section'],
  'dashboard': ['dashboard-kpi', 'stat-row', 'data-list', 'admin-table', 'overview-metric', 'page-nav', 'content-tabs'],
  'form-auth': ['login-form', 'form-field', 'form-submit', 'form-error', 'dialog-action'],
  'pricing': ['pricing-table', 'plan-selection', 'page-cta', 'feature-grid'],
  'settings': ['content-tabs', 'form-field', 'form-submit', 'settings-tabs'],
  'empty-state': ['page-notice', 'hero-cta'],
  'data-table': ['data-list', 'admin-table', 'filter-tabs', 'status-indicator'],
  'navigation': ['page-nav', 'app-header', 'landing-nav', 'action-menu', 'user-menu'],
  'modal-dialog': ['confirmation', 'form-modal', 'detail-view', 'dialog-action'],
  'card-component': ['feature-card', 'content-card', 'stat-card', 'profile-card'],
  'profile-page': ['user-profile', 'content-card', 'page-nav'],
  'onboarding': ['hero-cta', 'feature-grid', 'form-field', 'page-cta'],
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

type OkFn = (data: unknown) => { content: Array<{ type: 'text'; text: string }>; isError?: boolean }
type FailFn = (e: unknown) => { content: Array<{ type: 'text'; text: string }>; isError?: boolean }
type RegisterFn = (...args: unknown[]) => void

export interface RegisterKitToolsOptions {
  register: RegisterFn
  ok: OkFn
  fail: FailFn
}

export function registerKitTools({ register, ok, fail }: RegisterKitToolsOptions): void {
  // --- get_available_kits ---
  register(
    'get_available_kits',
    {
      description: 'List all installed UI Kits with their metadata. Use this to discover which kits are available and their component counts.',
      inputSchema: z.object({
        category: z.string().optional().describe('Filter by category: "general", "dashboard", "landing", "effects"'),
        active_only: z.boolean().optional().describe('If true, only return currently active kits'),
      })
    },
    async (args: Record<string, unknown>) => {
      try {
        const registry = loadRegistry()
        const category = args.category as string | undefined

        const kits = registry.kits
          .map(entry => {
            const meta = loadKitMeta(entry.name)
            if (!meta) return null
            return {
              name: meta.name,
              displayName: meta.displayName,
              description: meta.description,
              category: meta.category,
              componentCount: meta.stats.componentCount,
              variantCount: meta.stats.variantCount,
              style: meta.style,
              tags: meta.tags,
            }
          })
          .filter((k): k is NonNullable<typeof k> => k !== null)
          .filter(k => !category || k.category === category)

        return ok({ kits, totalKits: kits.length })
      } catch (e) { return fail(e) }
    }
  )

  // --- get_kit_components ---
  register(
    'get_kit_components',
    {
      description: 'List all components in a specific UI Kit. Filterable by tag or usage context.',
      inputSchema: z.object({
        kitId: z.string().describe('Kit name (e.g. "shadcn", "aceternity", "tremor")'),
        tag: z.string().optional().describe('Filter by tag (e.g. "interactive", "layout", "data")'),
        usageContext: z.string().optional().describe('Filter by usage context (e.g. "hero-cta", "dashboard-kpi")'),
      })
    },
    async (args: Record<string, unknown>) => {
      try {
        const kitId = args.kitId as string
        const tag = args.tag as string | undefined
        const usageContext = args.usageContext as string | undefined

        const meta = loadKitMeta(kitId)
        if (!meta) return fail(new Error(`Kit "${kitId}" not found`))

        let components = meta.components
        if (tag) components = components.filter(c => c.tags.includes(tag))
        if (usageContext) components = components.filter(c => c.usageContext.includes(usageContext))

        return ok({
          kit: meta.displayName,
          components: components.map(c => ({
            id: c.id,
            name: c.name,
            variants: c.variants,
            sizes: c.sizes,
            description: c.description,
            tags: c.tags,
            usageContext: c.usageContext,
          })),
          totalComponents: components.length,
        })
      } catch (e) { return fail(e) }
    }
  )

  // --- get_component_spec ---
  register(
    'get_component_spec',
    {
      description: 'Get the full .design spec of a specific component from a UI Kit. Returns the component tree with resolved variables, ready to be used as a template for rendering.',
      inputSchema: z.object({
        kitId: z.string().describe('Kit name (e.g. "shadcn")'),
        componentId: z.string().describe('Component ID (e.g. "button", "card", "hero-section")'),
        variant: z.string().optional().describe('Specific variant to return (e.g. "primary", "ghost"). If omitted, returns all variants.'),
        size: z.string().optional().describe('Specific size (e.g. "sm", "md", "lg"). If omitted, returns default.'),
      })
    },
    async (args: Record<string, unknown>) => {
      try {
        const kitId = args.kitId as string
        const componentId = args.componentId as string
        const variant = args.variant as string | undefined
        const size = args.size as string | undefined

        const meta = loadKitMeta(kitId)
        if (!meta) return fail(new Error(`Kit "${kitId}" not found`))

        const compEntry = meta.components.find(c => c.id === componentId)
        if (!compEntry) return fail(new Error(`Component "${componentId}" not found in kit "${kitId}"`))

        const design = loadComponentDesign(kitId, compEntry.file)
        if (!design) return fail(new Error(`Design file not found for "${componentId}"`))

        const tokens = loadKitTokens(kitId)

        // Filter children by variant/size if specified
        let children = (design.children ?? []) as Array<Record<string, unknown>>
        if (variant || size) {
          children = children.filter(child => {
            const name = (child.name as string ?? '').toLowerCase()
            const matchVariant = !variant || name.includes(variant.toLowerCase())
            const matchSize = !size || name.includes(size.toLowerCase())
            return matchVariant && matchSize
          })
        }

        return ok({
          kit: meta.displayName,
          component: compEntry.name,
          variants: compEntry.variants,
          sizes: compEntry.sizes,
          design: {
            ...design,
            children,
          },
          tokens: tokens ?? {},
        })
      } catch (e) { return fail(e) }
    }
  )

  // --- suggest_components ---
  register(
    'suggest_components',
    {
      description: 'Suggest the best components from all installed kits for a given design task. Uses the Design Context Engine classifier to match task type to component usage contexts.',
      inputSchema: z.object({
        taskDescription: z.string().describe('Description of the design task (e.g. "SaaS landing page", "analytics dashboard")'),
        elementType: z.string().optional().describe('Specific element type needed (e.g. "button", "card", "nav", "hero")'),
      })
    },
    async (args: Record<string, unknown>) => {
      try {
        const taskDescription = args.taskDescription as string
        const elementType = args.elementType as string | undefined

        // Classify the task
        const { classifyTask } = await import('../../../packages/design-context/src/classifier.ts')
        const taskType = classifyTask(taskDescription)
        const relevantContexts = TASK_TO_CONTEXT[taskType] ?? []

        // Load all installed kits
        const registry = loadRegistry()
        const suggestions: Array<{
          kitName: string
          kitDisplayName: string
          component: string
          componentName: string
          variants: string[] | undefined
          matchedContexts: string[]
          relevance: 'high' | 'medium' | 'low'
        }> = []

        for (const entry of registry.kits) {
          const meta = loadKitMeta(entry.name)
          if (!meta) continue

          for (const comp of meta.components) {
            // Filter by element type if specified
            if (elementType && !comp.id.includes(elementType) && !comp.name.toLowerCase().includes(elementType.toLowerCase())) {
              continue
            }

            // Score by matching usage contexts
            const matched = comp.usageContext.filter(ctx => relevantContexts.includes(ctx))
            const tagMatches = comp.tags.filter(t => taskDescription.toLowerCase().includes(t))

            if (matched.length > 0 || tagMatches.length > 0 || !elementType) {
              const relevance = matched.length >= 2 ? 'high' : matched.length === 1 ? 'medium' : 'low'
              suggestions.push({
                kitName: meta.name,
                kitDisplayName: meta.displayName,
                component: comp.id,
                componentName: comp.name,
                variants: comp.variants,
                matchedContexts: matched,
                relevance,
              })
            }
          }
        }

        // Sort by relevance
        const order = { high: 0, medium: 1, low: 2 }
        suggestions.sort((a, b) => order[a.relevance] - order[b.relevance])

        return ok({
          taskType,
          elementType: elementType ?? 'all',
          suggestions: elementType ? suggestions : suggestions.filter(s => s.relevance !== 'low'),
          totalSuggestions: suggestions.length,
        })
      } catch (e) { return fail(e) }
    }
  )

  // --- insert_kit_component ---
  register(
    'insert_kit_component',
    {
      description: 'Get a kit component ready for insertion on the canvas. Returns the resolved .design tree that can be passed to the render tool.',
      inputSchema: z.object({
        kitId: z.string().describe('Kit name'),
        componentId: z.string().describe('Component ID'),
        variant: z.string().optional().describe('Variant to use'),
        size: z.string().optional().describe('Size to use'),
        overrides: z.record(z.string()).optional().describe('Variable overrides (e.g. {"btn.primary.bg": "#FF0000"})'),
      })
    },
    async (args: Record<string, unknown>) => {
      try {
        const kitId = args.kitId as string
        const componentId = args.componentId as string
        const variant = args.variant as string | undefined
        const size = args.size as string | undefined
        const overrides = args.overrides as Record<string, string> | undefined

        const meta = loadKitMeta(kitId)
        if (!meta) return fail(new Error(`Kit "${kitId}" not found`))

        const compEntry = meta.components.find(c => c.id === componentId)
        if (!compEntry) return fail(new Error(`Component "${componentId}" not found in kit "${kitId}"`))

        const design = loadComponentDesign(kitId, compEntry.file)
        if (!design) return fail(new Error(`Design file not found for "${componentId}"`))

        const tokens = loadKitTokens(kitId) ?? {}

        // Merge overrides into variables
        const variables = { ...(design.variables as Record<string, unknown> ?? {}) }
        if (overrides) {
          for (const [key, value] of Object.entries(overrides)) {
            if (key in variables) {
              (variables[key] as Record<string, unknown>).value = value
            }
          }
        }

        // Filter to the requested variant
        let children = (design.children ?? []) as Array<Record<string, unknown>>
        if (variant || size) {
          children = children.filter(child => {
            const name = (child.name as string ?? '').toLowerCase()
            const matchVariant = !variant || name.includes(variant.toLowerCase())
            const matchSize = !size || name.includes(size.toLowerCase())
            return matchVariant && matchSize
          })
          if (children.length === 0) {
            // Fallback to first child
            children = [(design.children as Array<Record<string, unknown>>)[0]].filter(Boolean)
          }
        }

        return ok({
          kit: meta.displayName,
          component: compEntry.name,
          variant: variant ?? 'default',
          size: size ?? 'md',
          designTree: {
            variables,
            children,
          },
          tokens,
          instruction: 'Use the children array as the component tree for the render tool. Variables starting with $ reference the tokens.',
        })
      } catch (e) { return fail(e) }
    }
  )
}
