/**
 * UI Kit JSX Specs — dynamically loaded from installed UI Kits.
 *
 * Reads .design files from design-kits/installed/ and converts them into
 * JSX-like component specs for the AI render workflow.
 *
 * Falls back to built-in shadcn specs if no kits are installed.
 *
 * Used by:
 * - get_design_prompt MCP tool (returns specs for specific components)
 * - design-page prompt (injects all specs into the workflow)
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { KitMeta, KitRegistry } from '../../../packages/format/src/kit-schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KITS_ROOT = resolve(__dirname, '../../../design-kits')

export interface ComponentSpec {
  name: string
  description: string
  jsx: string
  variants?: Record<string, string>
  kit?: string
}

// ---------------------------------------------------------------------------
// Dynamic kit loading
// ---------------------------------------------------------------------------

interface DesignChild {
  id?: string
  name?: string
  type?: string
  reusable?: boolean
  width?: number | string
  height?: number | string
  fill?: string
  cornerRadius?: number
  layout?: string
  alignItems?: string
  justifyContent?: string
  padding?: number[]
  gap?: number
  content?: string
  fontSize?: number | string
  fontWeight?: string | number
  stroke?: Record<string, unknown>
  children?: DesignChild[]
  [key: string]: unknown
}

/**
 * Convert a .design node tree to a simplified JSX-like representation.
 */
function designNodeToJsx(node: DesignChild, indent: number = 0): string {
  const pad = '  '.repeat(indent)
  const type = node.type ?? 'frame'

  if (type === 'text') {
    const attrs: string[] = [`name="${node.name ?? 'Text'}"`]
    if (node.fontSize) attrs.push(`size={${JSON.stringify(node.fontSize)}}`)
    if (node.fontWeight) attrs.push(`weight="${node.fontWeight}"`)
    if (node.fill) attrs.push(`color="${node.fill}"`)
    const content = node.content ?? 'Text'
    return `${pad}<Text ${attrs.join(' ')}>${content}</Text>`
  }

  // Frame/rectangle/ellipse
  const tag = type === 'ellipse' ? 'Ellipse' : type === 'rectangle' ? 'Rectangle' : 'Frame'
  const attrs: string[] = [`name="${node.name ?? tag}"`]

  if (node.width && node.width !== 'fit_content') {
    attrs.push(node.width === 'fill' ? 'w="fill"' : `w={${node.width}}`)
  }
  if (node.height && node.height !== 'fit_content') {
    attrs.push(`h={${node.height}}`)
  }
  if (node.fill && node.fill !== 'transparent') attrs.push(`bg="${node.fill}"`)
  if (node.cornerRadius) attrs.push(`rounded={${node.cornerRadius}}`)
  if (node.layout) attrs.push(`flex="${node.layout === 'horizontal' ? 'row' : 'col'}"`)
  if (node.alignItems) attrs.push(`items="${node.alignItems}"`)
  if (node.justifyContent && node.justifyContent !== 'start') attrs.push(`justify="${node.justifyContent}"`)
  if (node.gap) attrs.push(`gap={${node.gap}}`)
  if (node.padding) {
    if (node.padding.length === 4) {
      attrs.push(`p={[${node.padding.join(',')}]}`)
    } else if (node.padding.length === 2) {
      attrs.push(`py={${node.padding[0]}} px={${node.padding[1]}}`)
    }
  }
  if (node.stroke) {
    const s = node.stroke as Record<string, unknown>
    if (s.fill) attrs.push(`stroke="${s.fill}"`)
    if (s.thickness) attrs.push(`strokeWidth={${s.thickness}}`)
  }

  const children = node.children ?? []
  if (children.length === 0) {
    return `${pad}<${tag} ${attrs.join(' ')} />`
  }

  const childrenJsx = children.map(c => designNodeToJsx(c, indent + 1)).join('\n')
  return `${pad}<${tag} ${attrs.join(' ')}>\n${childrenJsx}\n${pad}</${tag}>`
}

/**
 * Load all component specs from installed kits.
 */
function loadKitSpecs(): Record<string, ComponentSpec> {
  const specs: Record<string, ComponentSpec> = {}

  try {
    const registryPath = resolve(KITS_ROOT, 'registry.json')
    if (!existsSync(registryPath)) return specs

    const registry: KitRegistry = JSON.parse(readFileSync(registryPath, 'utf-8'))

    for (const entry of registry.kits) {
      const kitPath = resolve(KITS_ROOT, 'installed', entry.name, 'kit.json')
      if (!existsSync(kitPath)) continue

      const meta: KitMeta = JSON.parse(readFileSync(kitPath, 'utf-8'))

      for (const comp of meta.components) {
        const designPath = resolve(KITS_ROOT, 'installed', entry.name, comp.file)
        if (!existsSync(designPath)) continue

        const design = JSON.parse(readFileSync(designPath, 'utf-8')) as { children?: DesignChild[] }
        const children = design.children ?? []

        if (children.length === 0) continue

        // First reusable child is the default spec
        const defaultChild = children[0]
        const specKey = `${entry.name}/${comp.id}`

        // Build variants from remaining children
        const variants: Record<string, string> = {}
        for (const child of children.slice(1)) {
          const variantName = (child.name ?? child.id ?? 'variant')
            .replace(new RegExp(`^${comp.name}\\s*/\\s*`, 'i'), '')
            .replace(/\s*\/\s*/g, '-')
            .toLowerCase()
            .trim()
          variants[variantName] = designNodeToJsx(child)
        }

        specs[specKey] = {
          name: `${comp.name} (${meta.displayName})`,
          description: comp.description,
          jsx: designNodeToJsx(defaultChild),
          ...(Object.keys(variants).length > 0 ? { variants } : {}),
          kit: meta.displayName,
        }

        // Also register without kit prefix for backward compat
        const simpleKeys = [comp.id, comp.name.toLowerCase().replace(/\s+/g, '-')]
        for (const key of simpleKeys) {
          if (!(key in specs)) {
            specs[key] = specs[specKey]
          }
        }
      }
    }
  } catch {
    // If kit loading fails, return empty — fallback will handle it
  }

  return specs
}

// ---------------------------------------------------------------------------
// Cached specs (loaded once, then cached)
// ---------------------------------------------------------------------------

let _cachedSpecs: Record<string, ComponentSpec> | null = null

function getSpecs(): Record<string, ComponentSpec> {
  if (!_cachedSpecs) {
    _cachedSpecs = loadKitSpecs()
  }
  return _cachedSpecs
}

/** Force reload of specs (useful after kit activation changes) */
export function invalidateSpecsCache(): void {
  _cachedSpecs = null
}

// ---------------------------------------------------------------------------
// Public API (backward compatible)
// ---------------------------------------------------------------------------

/** All loaded component specs */
export const UI_KIT_SPECS: Record<string, ComponentSpec> = new Proxy({} as Record<string, ComponentSpec>, {
  get(_, prop: string) {
    return getSpecs()[prop]
  },
  ownKeys() {
    return Object.keys(getSpecs())
  },
  has(_, prop: string) {
    return prop in getSpecs()
  },
  getOwnPropertyDescriptor(_, prop: string) {
    const specs = getSpecs()
    if (prop in specs) {
      return { configurable: true, enumerable: true, value: specs[prop] }
    }
    return undefined
  },
})

/** Get all component names */
export function getComponentNames(): string[] {
  return Object.keys(getSpecs())
}

/** Get a specific component spec */
export function getComponentSpec(name: string): ComponentSpec | null {
  return getSpecs()[name] ?? null
}

/** Get all specs as a formatted prompt string */
export function getAllSpecsAsPrompt(): string {
  const specs = getSpecs()
  const lines: string[] = ['# UI Kit Component Specs\n']

  // Group by kit
  const byKit = new Map<string, Array<[string, ComponentSpec]>>()
  for (const [key, spec] of Object.entries(specs)) {
    // Skip alias entries (simple keys pointing to same spec)
    if (key.includes('/')) {
      const kit = spec.kit ?? 'Default'
      if (!byKit.has(kit)) byKit.set(kit, [])
      byKit.get(kit)!.push([key, spec])
    }
  }

  // If no kits loaded, show all (backward compat)
  if (byKit.size === 0) {
    for (const [key, spec] of Object.entries(specs)) {
      lines.push(`## ${spec.name} (\`${key}\`)`)
      lines.push(spec.description)
      lines.push('```jsx')
      lines.push(spec.jsx)
      lines.push('```')
      if (spec.variants) {
        for (const [vName, vJsx] of Object.entries(spec.variants)) {
          lines.push(`### Variant: ${vName}`)
          lines.push('```jsx')
          lines.push(vJsx)
          lines.push('```')
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  for (const [kit, entries] of byKit) {
    lines.push(`\n# ${kit}\n`)
    for (const [key, spec] of entries) {
      lines.push(`## ${spec.name} (\`${key}\`)`)
      lines.push(spec.description)
      lines.push('```jsx')
      lines.push(spec.jsx)
      lines.push('```')
      if (spec.variants) {
        for (const [vName, vJsx] of Object.entries(spec.variants)) {
          lines.push(`### Variant: ${vName}`)
          lines.push('```jsx')
          lines.push(vJsx)
          lines.push('```')
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
