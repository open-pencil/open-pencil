import { colorToHex } from '../color'

import { defineTool } from './schema'

import type { Color } from '../types'
import type { FigmaAPI } from '../figma-api'
import type { Variable, VariableCollection, VariableValue, SceneNode } from '../scene-graph'

function slugify(name: string): string {
  return name
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function toCamelCase(name: string): string {
  return slugify(name).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function isColor(value: VariableValue): value is Color {
  return typeof value === 'object' && value !== null && 'r' in value && 'g' in value && 'b' in value
}

function isAlias(value: VariableValue): value is { aliasId: string } {
  return typeof value === 'object' && value !== null && 'aliasId' in value
}

function resolveValue(
  value: VariableValue,
  variables: Map<string, Variable>,
  visited = new Set<string>()
): VariableValue {
  if (!isAlias(value)) return value
  if (visited.has(value.aliasId)) return value
  visited.add(value.aliasId)
  const target = variables.get(value.aliasId)
  if (!target) return value
  const modeId = Object.keys(target.valuesByMode)[0]
  if (!modeId) return value
  return resolveValue(target.valuesByMode[modeId], variables, visited)
}

function formatCSSValue(value: VariableValue, variables: Map<string, Variable>): string {
  const resolved = resolveValue(value, variables)
  if (isColor(resolved)) return colorToHex(resolved)
  if (typeof resolved === 'number') return String(resolved)
  if (typeof resolved === 'string') return resolved
  if (typeof resolved === 'boolean') return resolved ? '1' : '0'
  if (isAlias(resolved)) return `/* unresolved alias: ${resolved.aliasId} */`
  return String(resolved)
}

interface TokenEntry {
  name: string
  cssVar: string
  type: string
  values: Record<string, string>
}

function buildTokens(
  variables: Variable[],
  collections: VariableCollection[],
  allVars: Map<string, Variable>
): { tokens: TokenEntry[]; modes: { id: string; name: string; collectionName: string }[] } {
  const collectionMap = new Map<string, VariableCollection>()
  for (const c of collections) collectionMap.set(c.id, c)

  const modes: { id: string; name: string; collectionName: string }[] = []
  const seenModes = new Set<string>()
  for (const c of collections) {
    for (const m of c.modes) {
      if (!seenModes.has(m.modeId)) {
        seenModes.add(m.modeId)
        modes.push({ id: m.modeId, name: m.name, collectionName: c.name })
      }
    }
  }

  const tokens: TokenEntry[] = []
  for (const v of variables) {
    const col = collectionMap.get(v.collectionId)
    const prefix = col ? slugify(col.name) : 'token'
    const cssVar = `--${prefix}-${slugify(v.name)}`

    const values: Record<string, string> = {}
    for (const [modeId, val] of Object.entries(v.valuesByMode)) {
      values[modeId] = formatCSSValue(val, allVars)
    }

    tokens.push({ name: v.name, cssVar, type: v.type, values })
  }

  return { tokens, modes }
}

function renderCSS(
  tokens: TokenEntry[],
  modes: { id: string; name: string; collectionName: string }[]
): string {
  if (tokens.length === 0) return '/* No design tokens found */\n'

  const defaultModeId = modes[0]?.id
  const lines: string[] = [':root {']

  for (const t of tokens) {
    const val = t.values[defaultModeId ?? ''] ?? Object.values(t.values)[0] ?? ''
    lines.push(`  ${t.cssVar}: ${val};`)
  }
  lines.push('}')

  for (const mode of modes.slice(1)) {
    const className = slugify(mode.name)
    lines.push('')
    lines.push(`/* ${mode.collectionName} / ${mode.name} */`)
    lines.push(`.${className} {`)
    for (const t of tokens) {
      const val = t.values[mode.id]
      if (val !== undefined) lines.push(`  ${t.cssVar}: ${val};`)
    }
    lines.push('}')
  }

  return lines.join('\n') + '\n'
}

function renderTailwindTheme(
  tokens: TokenEntry[],
  modes: { id: string; name: string }[]
): string {
  const defaultModeId = modes[0]?.id
  const colors: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const other: Record<string, string> = {}

  for (const t of tokens) {
    const key = toCamelCase(t.name)
    const val = t.values[defaultModeId ?? ''] ?? Object.values(t.values)[0] ?? ''
    if (t.type === 'COLOR') colors[key] = val
    else if (t.type === 'FLOAT') spacing[key] = `${val}px`
    else other[key] = val
  }

  const theme: Record<string, unknown> = {}
  if (Object.keys(colors).length > 0) theme.colors = colors
  if (Object.keys(spacing).length > 0) theme.spacing = spacing

  return `// Auto-extracted from Figma design tokens
export const designTokens = ${JSON.stringify(theme, null, 2)} as const
`
}

function renderJSON(
  tokens: TokenEntry[],
  modes: { id: string; name: string }[]
): string {
  const result: Record<string, Record<string, string>> = {}

  for (const mode of modes) {
    const modeTokens: Record<string, string> = {}
    for (const t of tokens) {
      const val = t.values[mode.id]
      if (val !== undefined) modeTokens[t.cssVar] = val
    }
    result[mode.name] = modeTokens
  }

  return JSON.stringify(result, null, 2)
}

export const designToTokens = defineTool({
  name: 'design_to_tokens',
  description:
    'Extract design tokens from Figma variables as CSS custom properties, Tailwind theme config, or JSON. Resolves aliases, handles multiple modes (light/dark).',
  params: {
    format: {
      type: 'string',
      description: 'Output format',
      enum: ['css', 'tailwind', 'json'],
      default: 'css'
    },
    collection: {
      type: 'string',
      description: 'Filter by collection name (substring, case-insensitive)'
    },
    type: {
      type: 'string',
      description: 'Filter by variable type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    }
  },
  execute: (figma, args) => {
    const format = args.format ?? 'css'

    let variables = figma.getLocalVariables()
    const collections = figma.getLocalVariableCollections()
    const allVars = new Map<string, Variable>()
    for (const v of variables) allVars.set(v.id, v)

    if (args.collection) {
      const q = args.collection.toLowerCase()
      const matchingIds = new Set(
        collections.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id)
      )
      variables = variables.filter((v) => matchingIds.has(v.collectionId))
    }

    if (args.type) {
      variables = variables.filter((v) => v.type === args.type)
    }

    if (variables.length === 0) {
      return { output: '/* No matching variables found */', tokenCount: 0 }
    }

    const { tokens, modes } = buildTokens(variables, collections, allVars)

    let output: string
    if (format === 'tailwind') output = renderTailwindTheme(tokens, modes)
    else if (format === 'json') output = renderJSON(tokens, modes)
    else output = renderCSS(tokens, modes)

    return { output, tokenCount: tokens.length, modeCount: modes.length }
  }
})

interface ComponentInfo {
  id: string
  name: string
  type: string
  width: number
  height: number
  variants: string[]
  instanceCount: number
  propCandidates: string[]
  usedOnScreens: string[]
}

interface ScreenInfo {
  id: string
  name: string
  width: number
  height: number
  componentRefs: { id: string; name: string; count: number }[]
  topLevelSections: number
}

function collectInstanceCounts(
  figma: FigmaAPI,
  componentIds: Set<string>
): Map<string, number> {
  const counts = new Map<string, number>()
  const page = figma.currentPage

  page.findAll((node) => {
    if (node.type !== 'INSTANCE') return false
    const raw = figma.graph.getNode(node.id)
    if (!raw?.componentId) return false
    if (componentIds.has(raw.componentId)) {
      counts.set(raw.componentId, (counts.get(raw.componentId) ?? 0) + 1)
    }
    return false
  })

  return counts
}

function detectPropCandidates(node: SceneNode, graph: import('../scene-graph').SceneGraph): string[] {
  const props: string[] = []

  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    if (child.type === 'TEXT' && child.text) {
      props.push(`text:${child.name}`)
    }
    if (child.fills.some((f) => f.visible && f.type === 'SOLID')) {
      const hasBoundVar = Object.keys(child.boundVariables).length > 0
      if (hasBoundVar) props.push(`color:${child.name}`)
    }
    if (child.type === 'FRAME' || child.type === 'GROUP') {
      props.push(`slot:${child.name}`)
    }
  }

  return props
}

function detectVariants(
  componentNode: SceneNode,
  graph: import('../scene-graph').SceneGraph
): string[] {
  if (componentNode.type !== 'COMPONENT_SET') return []

  const variants: string[] = []
  for (const childId of componentNode.childIds) {
    const child = graph.getNode(childId)
    if (child?.type === 'COMPONENT') variants.push(child.name)
  }
  return variants
}

function buildScreenInfo(
  figma: FigmaAPI,
  frameNode: SceneNode,
  componentIds: Set<string>
): ScreenInfo {
  const refs = new Map<string, { name: string; count: number }>()
  let topLevelSections = 0

  const walk = (nodeId: string) => {
    const node = figma.graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'SECTION') topLevelSections++
    if (node.type === 'INSTANCE' && node.componentId && componentIds.has(node.componentId)) {
      const entry = refs.get(node.componentId)
      if (entry) entry.count++
      else {
        const comp = figma.graph.getNode(node.componentId)
        refs.set(node.componentId, { name: comp?.name ?? node.componentId, count: 1 })
      }
    }
    for (const childId of node.childIds) walk(childId)
  }

  for (const childId of frameNode.childIds) walk(childId)

  return {
    id: frameNode.id,
    name: frameNode.name,
    width: frameNode.width,
    height: frameNode.height,
    componentRefs: [...refs.entries()].map(([id, { name, count }]) => ({ id, name, count })),
    topLevelSections
  }
}

export const designToComponentMap = defineTool({
  name: 'design_to_component_map',
  description:
    'Analyze the document and return a structured component decomposition: components (with variants, props, instance counts), screens, and a dependency overview.',
  params: {
    page: {
      type: 'string',
      description: 'Page name to analyze (default: current page)'
    }
  },
  execute: (figma, args) => {
    if (args.page) {
      const target = figma.root.children.find((p) => p.name === args.page)
      if (target) figma.currentPage = target
      else return { error: `Page "${args.page}" not found` }
    }

    const page = figma.currentPage
    const components: ComponentInfo[] = []
    const componentIds = new Set<string>()

    page.findAll((node) => {
      if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
      const raw = figma.graph.getNode(node.id)
      if (!raw) return false

      componentIds.add(raw.id)
      components.push({
        id: raw.id,
        name: raw.name,
        type: raw.type,
        width: raw.width,
        height: raw.height,
        variants: detectVariants(raw, figma.graph),
        instanceCount: 0,
        propCandidates: detectPropCandidates(raw, figma.graph),
        usedOnScreens: []
      })
      return false
    })

    const instanceCounts = collectInstanceCounts(figma, componentIds)
    for (const comp of components) {
      comp.instanceCount = instanceCounts.get(comp.id) ?? 0
    }

    const screens: ScreenInfo[] = []
    const topFrames = page.children.filter((child) => {
      const raw = figma.graph.getNode(child.id)
      if (!raw) return false
      if (raw.type === 'COMPONENT' || raw.type === 'COMPONENT_SET') return false
      if (raw.type === 'SECTION') return false
      return raw.width >= 200 && raw.height >= 200
    })

    for (const frame of topFrames) {
      const raw = figma.graph.getNode(frame.id)
      if (!raw) continue
      const screen = buildScreenInfo(figma, raw, componentIds)
      screens.push(screen)

      for (const ref of screen.componentRefs) {
        const comp = components.find((c) => c.id === ref.id)
        if (comp) comp.usedOnScreens.push(screen.name)
      }
    }

    const sections: { id: string; name: string; childCount: number }[] = []
    for (const child of page.children) {
      const raw = figma.graph.getNode(child.id)
      if (raw?.type === 'SECTION') {
        sections.push({ id: raw.id, name: raw.name, childCount: raw.childIds.length })
      }
    }

    return {
      componentCount: components.length,
      screenCount: screens.length,
      components: components.sort((a, b) => b.instanceCount - a.instanceCount),
      screens,
      sections
    }
  }
})

let _codegenPrompt: string | null = null

export async function loadCodegenPrompt(): Promise<string> {
  if (_codegenPrompt) return _codegenPrompt
  const { readFile } = await import('node:fs/promises')
  const { dirname, join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  _codegenPrompt = await readFile(join(__dirname, 'prompts', 'codegen.md'), 'utf-8')
  return _codegenPrompt
}

export const getCodegenPrompt = defineTool({
  name: 'get_codegen_prompt',
  description:
    'Get the design-to-code generation guidelines. Call this before generating frontend code from a Figma design to understand the recommended workflow and patterns.',
  params: {},
  execute: async () => {
    const prompt = await loadCodegenPrompt()
    return { prompt }
  }
})
