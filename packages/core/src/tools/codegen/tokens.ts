import { colorToHex } from '#core/color'
import type { Variable, VariableCollection, VariableValue } from '#core/scene-graph'
import { defineTool } from '#core/tools/schema'
import type { Color } from '#core/types'

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
  return typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value
}

function isAlias(value: VariableValue): value is { aliasId: string } {
  return typeof value === 'object' && 'aliasId' in value
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
  values: Partial<Record<string, string>>
}

function buildTokens(
  variables: Variable[],
  collections: VariableCollection[],
  allVars: Map<string, Variable>
): { tokens: TokenEntry[]; modes: { id: string; name: string; collectionName: string }[] } {
  const collectionMap = new Map<string, VariableCollection>()
  for (const collection of collections) collectionMap.set(collection.id, collection)

  const modes: { id: string; name: string; collectionName: string }[] = []
  const seenModes = new Set<string>()
  for (const collection of collections) {
    for (const mode of collection.modes) {
      if (!seenModes.has(mode.modeId)) {
        seenModes.add(mode.modeId)
        modes.push({ id: mode.modeId, name: mode.name, collectionName: collection.name })
      }
    }
  }

  const tokens: TokenEntry[] = []
  for (const variable of variables) {
    const collection = collectionMap.get(variable.collectionId)
    const prefix = collection ? slugify(collection.name) : 'token'
    const cssVar = `--${prefix}-${slugify(variable.name)}`

    const values: Record<string, string> = {}
    for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
      values[modeId] = formatCSSValue(value, allVars)
    }

    tokens.push({ name: variable.name, cssVar, type: variable.type, values })
  }

  return { tokens, modes }
}

function renderCSS(
  tokens: TokenEntry[],
  modes: { id: string; name: string; collectionName: string }[]
): string {
  if (tokens.length === 0) return '/* No design tokens found */\n'

  const defaultModeId = modes[0]?.id ?? ''
  const lines: string[] = [':root {']

  for (const token of tokens) {
    const value = token.values[defaultModeId] ?? Object.values(token.values)[0] ?? ''
    lines.push(`  ${token.cssVar}: ${value};`)
  }
  lines.push('}')

  for (const mode of modes.slice(1)) {
    const className = slugify(mode.name)
    lines.push('')
    lines.push(`/* ${mode.collectionName} / ${mode.name} */`)
    lines.push(`.${className} {`)
    for (const token of tokens) {
      const value = token.values[mode.id]
      if (value !== undefined) lines.push(`  ${token.cssVar}: ${value};`)
    }
    lines.push('}')
  }

  return `${lines.join('\n')}\n`
}

function renderTailwindTheme(tokens: TokenEntry[], modes: { id: string; name: string }[]): string {
  const defaultModeId = modes[0]?.id ?? ''
  const colors: Record<string, string> = {}
  const spacing: Record<string, string> = {}

  for (const token of tokens) {
    const key = toCamelCase(token.name)
    const value = token.values[defaultModeId] ?? Object.values(token.values)[0] ?? ''
    if (token.type === 'COLOR') colors[key] = value
    else if (token.type === 'FLOAT') spacing[key] = `${value}px`
  }

  const theme: Record<string, unknown> = {}
  if (Object.keys(colors).length > 0) theme.colors = colors
  if (Object.keys(spacing).length > 0) theme.spacing = spacing

  return `// Auto-extracted from Figma design tokens
export const designTokens = ${JSON.stringify(theme, null, 2)} as const
`
}

function renderJSON(tokens: TokenEntry[], modes: { id: string; name: string }[]): string {
  const result: Record<string, Record<string, string>> = {}

  for (const mode of modes) {
    const modeTokens: Record<string, string> = {}
    for (const token of tokens) {
      const value = token.values[mode.id]
      if (value !== undefined) modeTokens[token.cssVar] = value
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
    for (const variable of variables) allVars.set(variable.id, variable)

    if (args.collection) {
      const query = args.collection.toLowerCase()
      const matchingIds = new Set(
        collections
          .filter((collection) => collection.name.toLowerCase().includes(query))
          .map((collection) => collection.id)
      )
      variables = variables.filter((variable) => matchingIds.has(variable.collectionId))
    }

    if (args.type) {
      variables = variables.filter((variable) => variable.type === args.type)
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
